import { IFlowNodeClassNames } from './FlowNodeTypeRegistry';
import { IFlowEdge } from './IFlowEdge';
import { IFlowHost } from './IFlowHost';
import { IFlowNode } from './IFlowNode';

export const createFlowEdge = <
  C1 extends IFlowNodeClassNames,
  K1 extends keyof IFlowNode<C1>['output'],
  C2 extends IFlowNodeClassNames,
  K2 extends keyof IFlowNode<C2>['input'],
>(
  host: IFlowHost,
  from: IFlowEdge<C1, K1, C2, K2>['from'],
  to: IFlowEdge<C1, K1, C2, K2>['to'],
  ID: string
): IFlowEdge<C1, K1, C2, K2> => {
  // 构造 edge 时，立即传值
  to.node.setInput(to.ioKey, from.node.output[from.ioKey]);

  const handleOutputChange = ({ value }: any) => {
    to.node.setInput(to.ioKey, value); // 用 setInput 绕过 inputProxy，节约一次调用
  };

  // 监听 output 变化
  const removeOutListener = from.node.event.listen(`output:change:${from.ioKey as any}` as any, handleOutputChange);

  const dispose = () => {
    removeOutListener();
    host.flowEdgeManager.remove(edge);
    from.node.event.emit('connect:change:output', { action: 'remove', ioKey: from.ioKey, source: from.node } as any);
    to.node.event.emit('connect:change:input', { action: 'remove', ioKey: to.ioKey, source: to.node } as any);
  };

  const edge: IFlowEdge<C1, K1, C2, K2> = { ID, host, from, to, dispose };
  host.flowEdgeManager.add(edge);

  from.node.event.emit('connect:change:output', { action: 'add', ioKey: from.ioKey, source: from.node } as any);
  to.node.event.emit('connect:change:input', { action: 'add', ioKey: to.ioKey, source: to.node } as any);

  return edge;
};
