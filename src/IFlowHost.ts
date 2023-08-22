import { EventBus } from 'ah-event-bus';
import { FlowEdgeManager } from './FlowEdgeManager';
import { FlowNodeManager } from './FlowNodeManager';
import { ILogger } from './ILogger';
import { IDefaultFlowNode } from './FlowNodeTypeRegistry';
import { IDefaultFlowEdge } from './IFlowEdge';
import { GetEventBusDelegateMeta } from './TypeUtil';
import { type IComponentDef } from './BuiltinNode/ComponentNode';

type _EvtFromNode = GetEventBusDelegateMeta<IDefaultFlowNode['event'], 'node:'>;

export type IFlowHostEventData<T> = {
  /** 捕获，向下传播 */
  _capture?: boolean;

  /** 冒泡，向上传播 */
  _bubble?: boolean;
} & T;

/** 可以外部声明合并 */
export interface IFlowHostEvent extends _EvtFromNode {
  afterNodeAdd: IFlowHostEventData<{ node: IDefaultFlowNode }>;
  afterNodeRemove: IFlowHostEventData<{ node: IDefaultFlowNode }>;

  afterEdgeAdd: IFlowHostEventData<{ edge: IDefaultFlowEdge }>;
  afterEdgeRemove: IFlowHostEventData<{ edge: IDefaultFlowEdge }>;

  afterComponentDefChange: IFlowHostEventData<{ component: string }>;

  /** 遍历节点，可用于跨层级查找 */
  travelNode: IFlowHostEventData<{ tap: (n: IDefaultFlowNode) => any }>;
}

/** 可以外部声明合并 */
export interface IFlowHost {
  ID: string;

  flowNodeManager: FlowNodeManager;
  flowEdgeManager: FlowEdgeManager;

  logger: ILogger;
  event: EventBus<IFlowHostEvent>;

  componentDefs: IComponentDef[];
}
