import { EventBus } from 'ah-event-bus';
import { FlowDTRegistry, IFlowDTKey } from '../FlowDTRegistry';
import { FlowEdgeManager } from '../FlowEdgeManager';
import { FlowEdgeSerializer, IFlowEdgeSerializerData } from '../FlowEdgeSerializer';
import { FlowNodeManager } from '../FlowNodeManager';
import { FlowNodeSerializer, IFlowNodeSerializerData } from '../FlowNodeSerializer';
import { FlowNodeTypeRegistry, IFlowNodeClassNames, IFlowNodeTypeRegisterData } from '../FlowNodeTypeRegistry';
import { IFlowHost } from '../IFlowHost';
import { IFlowNode, IFlowNodeInput, IFlowNodeMeta, IFlowNodeOutput } from '../IFlowNode';
import { Util } from '../Util';
import { getInternalRandomString } from '../getInternalRandomString';

declare module '../FlowNodeTypeRegistry' {
  interface IFlowNodeMetaMap {
    ComponentNode: IFlowNodeMeta<
      'ComponentNode',
      {
        componentID: 'String'; // 组件 ID, inline:// 开头的是内联组件
      },
      {
        host: 'FlowHost';
      }
    >;
  }
}

export type IComponentDef = {
  ID: string;
  name?: string;
  input: Record<string, IFlowNodeInput<IFlowDTKey>>;
  output: Record<string, IFlowNodeOutput<IFlowDTKey>>;
  nodes: IFlowNodeSerializerData<IFlowNodeClassNames>[];
  edges: IFlowEdgeSerializerData<IFlowNodeClassNames, IFlowNodeClassNames>[];
};

export const ComponentNodeRegisterData: IFlowNodeTypeRegisterData<'ComponentNode'> = {
  define: {
    className: 'ComponentNode',
    cnName: '组件实例',
    input: {
      componentID: { dataType: 'String' },
    },
    output: {
      host: { dataType: 'FlowHost' },
    },
  },
  setup(ctx) {
    const { input: originInputDef, output: originOutputDef } = Util.cloneNodeDefine(ctx._define);

    const subHost = new Proxy(ctx.host, {
      get(target, p, receiver) {
        return (subHostStub as any)[p] || Reflect.get(target, p, receiver);
      },
    });

    const subHostStub: Partial<IFlowHost> = {
      ID: ctx.ID + '/' + getInternalRandomString(),
      event: new EventBus(),
      flowNodeManager: new FlowNodeManager(subHost),
      flowEdgeManager: new FlowEdgeManager(subHost),
    };

    // 向下传播事件(_capture)
    const removeCaptureDelegateListen = ctx.host.event.delegate((_type, _ev) => {
      if (_ev && _ev._capture) subHost.event.emit(_type, _ev);
    });

    ctx.output.host = subHost;

    let subInputNode: IFlowNode<'ComponentInputNode'> | undefined;
    let subOutputNode: IFlowNode<'ComponentOutputNode'> | undefined;

    function disposeSubHostContent() {
      subHostStub.event?.clear();
      subHostStub.flowNodeManager!.all.forEach(t => t.dispose());
      subHostStub.flowEdgeManager!.all.forEach(t => t.dispose());
    }

    function reloadAll() {
      disposeSubHostContent();

      const { componentID } = ctx.input;
      if (!componentID) return;

      const compDef = getComponentDef(ctx.host, componentID);
      if (!compDef) return;

      // 事件冒泡
      subHost.event.delegate((_type, _ev) => {
        if (_ev && _ev._bubble) ctx.host.event.emit(_type, _ev);
      });

      // 恢复节点
      for (const desc of compDef.nodes) {
        FlowNodeSerializer.restore(subHost, desc);
      }

      // 恢复连接
      for (const desc of compDef.edges) {
        FlowEdgeSerializer.restore(subHost, desc);
      }

      // 绑定输入
      subInputNode =
        subHost.flowNodeManager.all.find(n => Util.isFlowNode('ComponentInputNode', n)) ||
        FlowNodeTypeRegistry.Default.factory('ComponentInputNode')(subHost, getInternalRandomString(), '输入');

      // 绑定输出
      subOutputNode =
        subHost.flowNodeManager.all.find(n => Util.isFlowNode('ComponentOutputNode', n)) ||
        FlowNodeTypeRegistry.Default.factory('ComponentOutputNode')(subHost, getInternalRandomString(), '输出');

      // 恢复 io
      const newInputDef = { ...originInputDef, ...compDef.input };
      const newOutputDef = { ...originOutputDef, ...compDef.output };
      ctx.updateDefine({ input: newInputDef as any, output: newOutputDef as any });

      // 内部 output 节点 -> 自身 output
      subOutputNode!.event.listen('input:change', ev => {
        (ctx.output as any)[ev.key] = ev.value;
      });

      // 立刻给自身 input 设置初始值
      for (const [ioKey, ioDef] of Object.entries<IFlowNodeInput<IFlowDTKey>>(compDef.input)) {
        const dt = FlowDTRegistry.Default.get(ioDef.dataType);

        let value = typeof (ctx.input as any)[ioKey] !== 'undefined' ? (ctx.input as any)[ioKey] : ioDef.defaultValue;
        value = dt?.wrap ? dt.wrap(value) : value;

        // 这里要用 skipEqualCheck。因为自身 input 有可能在 restore 阶段已经有值了，不用 skipEqualCheck 会导致 listen input:change 不触发
        ctx.setInput(ioKey as any, value, { skipEqualCheck: true });
      }
    }

    // 自身 input -> 内部输入节点 output
    ctx.event.listen('input:change', ev => {
      if (subInputNode) {
        (subInputNode.output as any)[ev.key] = ev.value;
      }
    });

    const removeCompDefListen = ctx.host.event.listen('afterComponentDefChange', ev => {
      if (ev.component === ctx.input.componentID) reloadAll();
    });

    ctx.event.listen('input:change:componentID', reloadAll);
    reloadAll();

    return () => {
      removeCaptureDelegateListen();
      removeCompDefListen();

      disposeSubHostContent();
    };
  },
};

function getComponentDef(host: IFlowHost, ID: string): IComponentDef | undefined {
  if (ID.startsWith('inline://')) {
    return JSON.parse(decodeURIComponent(ID.slice('inline://'.length)));
  }

  return host.componentDefs.find(d => d.ID === ID);
}

FlowNodeTypeRegistry.Default.register('ComponentNode', ComponentNodeRegisterData);
