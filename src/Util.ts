import { type IComponentDef } from './BuiltinNode/ComponentNode';
import { FlowDTRegistry, IFlowDTKey } from './FlowDTRegistry';
import { FlowEdgeSerializer, IFlowEdgeSerializerData } from './FlowEdgeSerializer';
import { FlowNodeSerializer, IFlowNodeSerializerData } from './FlowNodeSerializer';
import { IDefaultFlowNode, IFlowNodeClassNames } from './FlowNodeTypeRegistry';
import { IDefaultFlowEdge } from './IFlowEdge';
import { IFlowHost } from './IFlowHost';
import { IFlowNode, IFlowNodeDefineFromMeta, IFlowNodeInput, IFlowNodeMeta, IFlowNodeOutput } from './IFlowNode';
import { FilterString } from './TypeUtil';
import { createFlowEdge } from './createFlowEdge';
import { getInternalRandomString } from './getInternalRandomString';

export const Util = {
  /** 收集松散的 flow edges */
  calcLoosedFlowEdges(nodes: IDefaultFlowNode[], edges: IDefaultFlowEdge[]): IDefaultFlowEdge[] {
    const epKeyCache = new Set<string>();

    for (const node of nodes) {
      Object.keys(node._define.input).forEach(ioKey => epKeyCache.add([node.ID, 'input', ioKey].join('.')));
      Object.keys(node._define.output).forEach(ioKey => epKeyCache.add([node.ID, 'output', ioKey].join('.')));
    }

    const loosedEdges: IDefaultFlowEdge[] = [];
    for (const edge of edges) {
      const k1 = [edge.from.node.ID, 'output', edge.from.ioKey].join('.');
      const k2 = [edge.to.node.ID, 'input', edge.to.ioKey].join('.');

      if (epKeyCache.has(k1) && epKeyCache.has(k2)) continue;

      loosedEdges.push(edge);
    }

    return loosedEdges;
  },

  cleanLoosedFlowEdges(host: IFlowHost) {
    const toRemoveEdges = this.calcLoosedFlowEdges(host.flowNodeManager.all, host.flowEdgeManager.all);
    if (toRemoveEdges.length === 0) return;

    toRemoveEdges.forEach((edge, i) => {
      host.logger.info('[%s/%s] remove edge %s', i + 1, toRemoveEdges.length, edge.ID);
      host.flowEdgeManager.remove(edge);
    });
  },

  // type guard
  isFlowNode<C extends IFlowNodeClassNames>(className: C, node: any): node is IFlowNode<C> {
    return (node as IDefaultFlowNode)._define.className === className;
  },

  createNodeFlusher<C extends IFlowNodeClassNames>(
    node: IFlowNode<C>,
    handler: Record<keyof IFlowNode<C>['input'], () => any>
  ) {
    const bindInputEvent = () => {
      const _removes: (() => void)[] = [];

      Object.keys(handler).map(_key => {
        const key = _key as FilterString<keyof IFlowNode<C>['input']>;
        const _r = node.event.listen(('input:change:' + key) as any, handler[key]);
        _removes.push(_r);
      });

      return () => _removes.forEach(fn => fn());
    };

    const keys = Object.keys(handler) as any as (keyof IFlowNode<C>['input'])[];

    return { keys, handler, bindInputEvent };
  },

  cloneByDataType(dataType: IFlowDTKey, value: any) {
    if (typeof value === 'undefined') return value;

    const dt = FlowDTRegistry.Default.get(dataType);
    if (!dt) throw new Error(`dataType ${dataType} not found`);

    if (dt.serializer && dt.serializer !== 'JSON') {
      return dt.serializer.restore(dt.serializer.save(value));
    }

    // fallback to JSON
    return JSON.parse(JSON.stringify(value));
  },

  /** 深复制 input define 数据 */
  cloneNodeInputDefine(inputDef: Record<string, IFlowNodeInput<IFlowDTKey>>) {
    const newDef: typeof inputDef = JSON.parse(JSON.stringify(inputDef));

    // 重写 input defaultValue
    for (const [key, ioDef] of Object.entries(inputDef)) {
      if (typeof ioDef.defaultValue !== 'undefined') {
        const dt = FlowDTRegistry.Default.get(ioDef.dataType);

        if (dt) {
          if (dt.serializer && dt.serializer !== 'JSON') {
            newDef[key].defaultValue = dt.serializer.restore(dt.serializer.save(ioDef.defaultValue));
          } else if (dt.wrap) {
            // 此时 newData input 是 JSON 序列化之后的数据，可通过 wrap 变成特定对象
            newDef[key].defaultValue = dt.wrap(newDef[key].defaultValue);
          }
        }
      }
    }

    return newDef;
  },

  /** 深复制 node define 数据 */
  cloneNodeDefine(data: IFlowNodeDefineFromMeta<IFlowNodeMeta<string, any, any>>): typeof data {
    const newData: typeof data = JSON.parse(JSON.stringify(data));
    newData.input = this.cloneNodeInputDefine(data.input);
    return newData;
  },

  calcNodeCloneData(host: IFlowHost, nodes: IDefaultFlowNode[]) {
    const ret: {
      nodes: IFlowNodeSerializerData<IFlowNodeClassNames>[];
      edges: IFlowEdgeSerializerData<IFlowNodeClassNames, IFlowNodeClassNames>[];
    } = { nodes: [], edges: [] };

    ret.nodes.push(...nodes.map(n => FlowNodeSerializer.save(n)));

    // calc edges
    for (let i = 0; i < nodes.length; i++) {
      const na = nodes[i];

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;

        const nb = nodes[j];

        const toCopyEdges = host.flowEdgeManager.all.filter(
          edge => edge.from.node.ID === na.ID && edge.to.node.ID === nb.ID
        );

        ret.edges.push(...toCopyEdges.map(d => FlowEdgeSerializer.save(d)));
      }
    }

    return ret;
  },

  resetSerializerDataID(
    nodes: IFlowNodeSerializerData<IFlowNodeClassNames>[],
    edges: IFlowEdgeSerializerData<IFlowNodeClassNames, IFlowNodeClassNames>[]
  ) {
    let nodeIDTransformMap = new Map<string, string>();

    for (const desc of nodes) {
      const newID = getInternalRandomString(); // 重新生成 ID
      nodeIDTransformMap.set(desc.ID, newID);

      desc.ID = newID;
      desc.name += '_副本';
    }

    // calc edges
    edges.forEach(desc => {
      const fromNodeID = nodeIDTransformMap.get(desc.from.nodeID);
      const toNodeID = nodeIDTransformMap.get(desc.to.nodeID);

      if (!fromNodeID || !toNodeID) return;

      const newID = getInternalRandomString(); // 重新生成 ID
      desc.ID = newID;

      // 改写两端 ID
      desc.from.nodeID = fromNodeID;
      desc.to.nodeID = toNodeID;
    });

    return nodeIDTransformMap;
  },

  /** 提取成组件 */
  extractAsComponent(
    nodes: IDefaultFlowNode[],
    edges: IDefaultFlowEdge[],
    ID = getInternalRandomString(),
    name = '组件_' + ID
  ): IComponentDef {
    let input: Record<string, IFlowNodeInput<IFlowDTKey>> = {};
    let output: Record<string, IFlowNodeOutput<IFlowDTKey>> = {};

    const inNode = nodes.find(n => this.isFlowNode('ComponentInputNode', n));
    if (inNode) input = this.cloneNodeInputDefine(inNode._define.output);

    const outNode = nodes.find(n => this.isFlowNode('ComponentOutputNode', n));
    if (outNode) output = JSON.parse(JSON.stringify(outNode._define.input));

    const _nodes = nodes.map(t => FlowNodeSerializer.save(t));
    const _edges = edges.map(t => FlowEdgeSerializer.save(t));

    return { ID, name, input, output, nodes: _nodes, edges: _edges };
  },

  quickConnect(fromID: string, fromKey: string, toID: string, toKey: string) {
    const desc: IFlowEdgeSerializerData<any, any> = {
      ID: getInternalRandomString(),
      from: { nodeID: fromID, ioKey: fromKey },
      to: { nodeID: toID, ioKey: toKey },
    };

    const create = (host: IFlowHost) => {
      const fromNode = host.flowNodeManager.get(fromID);
      const toNode = host.flowNodeManager.get(toID);
      if (!fromNode || !toNode) throw new Error('node not found');

      const fromIO = fromNode._define.output[fromKey];
      const toIO = toNode._define.input[toKey];
      if (!fromIO || !toIO) throw new Error('io not found');

      return createFlowEdge<any, any, any, any>(
        host,
        { node: fromNode, ioKey: fromKey } as any,
        { node: toNode, ioKey: toKey } as any,
        desc.ID
      );
    };

    return { desc, create };
  },
};
