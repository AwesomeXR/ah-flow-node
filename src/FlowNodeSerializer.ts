import { FlowDTRegistry } from './FlowDTRegistry';
import { FlowNodeTypeRegistry, IDefaultFlowNode, IFlowNodeClassNames } from './FlowNodeTypeRegistry';
import { IFlowHost } from './IFlowHost';
import { IFlowNode, IFlowNodeInput } from './IFlowNode';

export interface IFlowNodeSerializerData<T extends IFlowNodeClassNames> {
  [index: string]: any;

  className: T;
  ID: string;
  name: string;
  enabled?: boolean;

  inputValues?: Record<string, any>;
}

function save(node: IDefaultFlowNode): IFlowNodeSerializerData<IFlowNodeClassNames>;
function save<C extends IFlowNodeClassNames>(node: IFlowNode<C>): IFlowNodeSerializerData<C>;
function save(_node: any) {
  const node = _node as IDefaultFlowNode;

  const desc: IFlowNodeSerializerData<IFlowNodeClassNames> = {
    className: node._define.className as any,
    ID: node.ID,
    name: node.name,
    enabled: node.enabled,
  };

  desc.inputValues = {};
  for (const [inKey, _ioDef] of Object.entries(node._define.input)) {
    const ioDef = _ioDef as IFlowNodeInput<any>;

    // 忽略已连接的端口
    const isConnected = node.host.flowEdgeManager.all.some(
      edge => edge.to.node.ID === node.ID && edge.to.ioKey == inKey
    );
    if (isConnected) continue;

    const dtDef = FlowDTRegistry.Default.get(ioDef.dataType);

    // 没有注册类型则不序列化
    if (!dtDef || !dtDef.serializer) continue;

    const toSeqValue = (node.input as any)[inKey];
    if (typeof toSeqValue === 'undefined') continue;

    const seqValue = dtDef.serializer === 'JSON' ? toSeqValue : dtDef.serializer.save(toSeqValue);
    desc.inputValues[inKey] = seqValue;
  }

  return desc;
}

export const FlowNodeSerializer = {
  save,
  restore<C extends IFlowNodeClassNames>(host: IFlowHost, desc: IFlowNodeSerializerData<C>): IFlowNode<C> | null {
    const reg = FlowNodeTypeRegistry.Default.get(desc.className);
    if (!reg) return null;

    try {
      const initInputs = {} as any;

      if (desc.inputValues) {
        for (const inKey of Object.keys(desc.inputValues)) {
          const toParseValue = desc.inputValues[inKey];
          if (typeof toParseValue === 'undefined') continue;

          const ioDef = (reg.define.input as any)[inKey] as IFlowNodeInput<any>;
          const dtDef = ioDef ? FlowDTRegistry.Default.get(ioDef.dataType) : undefined;

          if (ioDef && dtDef && dtDef.serializer) {
            // 有 input data type serializer 定义，进入处理逻辑

            try {
              initInputs[inKey] = dtDef.serializer === 'JSON' ? toParseValue : dtDef.serializer.restore(toParseValue);
            } catch (err) {
              console.error(err);
            }
          } else {
            // 原样复制
            initInputs[inKey] = toParseValue;
          }
        }
      }

      const node = FlowNodeTypeRegistry.Default.factory(desc.className)(
        host,
        desc.ID,
        desc.name,
        initInputs,
        typeof desc.enabled === 'undefined' ? true : desc.enabled
      );

      return node;
    } catch (err) {
      console.error(err);
      host.logger.error(
        'node restore error: class=%s, ID=%s, name=%s, msg=`%s`',
        desc.className,
        desc.ID,
        desc.name,
        err
      );

      return null;
    }
  },
};
