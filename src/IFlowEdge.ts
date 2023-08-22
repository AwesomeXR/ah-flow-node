import { IFlowNodeMetaMap } from './FlowNodeTypeRegistry';
import { IFlowNodeClassNames } from './FlowNodeTypeRegistry';
import { IFlowHost } from './IFlowHost';
import { IFlowNode, IFlowNodeFromMeta, IFlowNodeMeta } from './IFlowNode';

export type IFlowEdgeFromMeta<
  M1 extends IFlowNodeMeta<any, any, any>,
  K1 extends keyof M1['output'],
  M2 extends IFlowNodeMeta<any, any, any>,
  K2 extends keyof M2['input'],
> = {
  readonly host: IFlowHost;
  readonly ID: string;

  readonly from: { readonly node: IFlowNodeFromMeta<M1>; readonly ioKey: K1 };
  readonly to: { readonly node: IFlowNodeFromMeta<M2>; readonly ioKey: K2 };

  dispose: () => any;
};

export type IFlowEdge<
  C1 extends IFlowNodeClassNames,
  K1 extends keyof IFlowNode<C1>['output'],
  C2 extends IFlowNodeClassNames,
  K2 extends keyof IFlowNode<C2>['input'],
> = IFlowEdgeFromMeta<IFlowNodeMetaMap[C1], K1, IFlowNodeMetaMap[C2], K2>;

export type IDefaultFlowEdge = IFlowEdge<
  IFlowNodeClassNames,
  keyof IFlowNode<IFlowNodeClassNames>['output'],
  IFlowNodeClassNames,
  keyof IFlowNode<IFlowNodeClassNames>['input']
>;
