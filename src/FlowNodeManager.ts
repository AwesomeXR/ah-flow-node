import { IDefaultFlowNode, IFlowNodeClassNames } from './FlowNodeTypeRegistry';
import { IFlowNode } from './IFlowNode';
import { IFlowHost } from './IFlowHost';

export class FlowNodeManager {
  private _store = new Map<string, IDefaultFlowNode>();
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
  add<C extends IFlowNodeClassNames>(node: IFlowNode<C>) {
    if (this._store.has(node.ID)) throw new Error('node ID duplicated: ' + node.ID);
    this._store.set(node.ID, node as any);
    this.host.event.emit('afterNodeAdd', { node: node as any as IDefaultFlowNode });
  }

  /** @private internal use */
  remove<C extends IFlowNodeClassNames>(node: IFlowNode<C>) {
    this._store.delete(node.ID);
    this.host.event.emit('afterNodeRemove', { node: node as any as IDefaultFlowNode });
  }

  get(ID: string): IDefaultFlowNode;
  get<C extends IFlowNodeClassNames>(ID: string, className: C): IFlowNode<C>;
  get(ID: string, className?: string): any {
    const node = this._store.get(ID);
    if (!node) return;
    if (className && node._define.className !== className) return;
    return node;
  }

  /**
   * @param pattern ID | name
   * @returns
   */
  lookup(pattern: string): IDefaultFlowNode | undefined;
  lookup<C extends IFlowNodeClassNames>(pattern: string, className: C): IFlowNode<C> | undefined;
  lookup(pattern: string, className?: string): any {
    for (const node of this._store.values()) {
      const isPatternMatch = node.ID === pattern || node.name === pattern;
      const isMatch = className ? isPatternMatch && node._define.className === className : isPatternMatch;
      if (isMatch) return node;
    }
  }
}
