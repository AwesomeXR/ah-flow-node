import { createFlowEdge } from './createFlowEdge';
import { IFlowNodeClassNames } from './FlowNodeTypeRegistry';
import { IFlowEdge } from './IFlowEdge';
import { IFlowHost } from './IFlowHost';
import { IFlowNode } from './IFlowNode';

export interface IFlowEdgeSerializerData<C1 extends IFlowNodeClassNames, C2 extends IFlowNodeClassNames> {
  [index: string]: any;
  ID: string;
  from: { nodeID: string; ioKey: keyof IFlowNode<C1>['output'] };
  to: { nodeID: string; ioKey: keyof IFlowNode<C2>['input'] };
}

export const FlowEdgeSerializer = {
  save<
    C1 extends IFlowNodeClassNames,
    K1 extends keyof IFlowNode<C1>['output'],
    C2 extends IFlowNodeClassNames,
    K2 extends keyof IFlowNode<C2>['input'],
  >(edge: IFlowEdge<C1, K1, C2, K2>) {
    const desc: IFlowEdgeSerializerData<C1, C2> = {
      ID: edge.ID,
      from: { nodeID: edge.from.node.ID, ioKey: edge.from.ioKey },
      to: { nodeID: edge.to.node.ID, ioKey: edge.to.ioKey },
    };

    return desc;
  },

  restore<
    C1 extends IFlowNodeClassNames,
    K1 extends keyof IFlowNode<C1>['output'],
    C2 extends IFlowNodeClassNames,
    K2 extends keyof IFlowNode<C2>['input'],
  >(host: IFlowHost, desc: IFlowEdgeSerializerData<C1, C2>): IFlowEdge<C1, K1, C2, K2> | null {
    const fromNode = host.flowNodeManager.get(desc.from.nodeID);
    const toNode = host.flowNodeManager.get(desc.to.nodeID);

    if (!fromNode || !toNode) return null;

    try {
      const edge = createFlowEdge<C1, K1, C2, K2>(
        host,
        { node: fromNode as any, ioKey: desc.from.ioKey as any },
        { node: toNode as any, ioKey: desc.to.ioKey as any },
        desc.ID
      );

      return edge;
    } catch (err) {
      console.error(err);
      return null;
    }
  },
};
