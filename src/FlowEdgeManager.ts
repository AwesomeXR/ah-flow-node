import { IFlowNodeClassNames } from './FlowNodeTypeRegistry';
import { IFlowEdge, IDefaultFlowEdge } from './IFlowEdge';
import { IFlowNode } from './IFlowNode';
import { IFlowHost } from './IFlowHost';

export class FlowEdgeManager {
  private _store = new Map<string, IDefaultFlowEdge>();
  private _host!: IFlowHost;

  constructor(private _getHost: IFlowHost | (() => IFlowHost)) {}

  get host() {
    if (this._host) return this._host;
    this._host = typeof this._getHost === 'function' ? this._getHost() : this._getHost;
    return this._host;
  }

  get all() {
    return [...this._store.values()];
  }

  /** @private internal use */
  add<
    C1 extends IFlowNodeClassNames,
    K1 extends keyof IFlowNode<C1>['output'],
    C2 extends IFlowNodeClassNames,
    K2 extends keyof IFlowNode<C2>['input'],
  >(edge: IFlowEdge<C1, K1, C2, K2>) {
    if (this._store.has(edge.ID)) throw new Error('edge ID duplicated: ' + edge.ID);
    this._store.set(edge.ID, edge as any);

    this.host.event.emit('afterEdgeAdd', { edge: edge as any });
  }

  /** @private internal use */
  remove<
    C1 extends IFlowNodeClassNames,
    K1 extends keyof IFlowNode<C1>['output'],
    C2 extends IFlowNodeClassNames,
    K2 extends keyof IFlowNode<C2>['input'],
  >(edge: IFlowEdge<C1, K1, C2, K2>) {
    this._store.delete(edge.ID);
    this.host.event.emit('afterEdgeRemove', { edge: edge as any });
  }

  get(ID: string): IDefaultFlowEdge | undefined;
  get(fromNode: string, fromIoKey: string, toNode: string, toIoKey: string): IDefaultFlowEdge | undefined;
  get(...args: string[]) {
    if (args.length === 1) return this._store.get(args[0]);

    const [fromNode, fromIoKey, toNode, toIoKey] = args;

    return this.all.find(e => {
      return (
        e.from.node.ID === fromNode && e.from.ioKey === fromIoKey && e.to.node.ID === toNode && e.to.ioKey === toIoKey
      );
    });
  }

  filter(fromNodeID?: string, fromIoKey?: string, toNodeID?: string, toIoKey?: string) {
    return this.all.filter(
      edge =>
        (fromNodeID ? edge.from.node.ID === fromNodeID : true) &&
        (fromIoKey ? edge.from.ioKey === fromIoKey : true) &&
        (toNodeID ? edge.to.node.ID === toNodeID : true) &&
        (toIoKey ? edge.to.ioKey === toIoKey : true)
    );
  }
}
