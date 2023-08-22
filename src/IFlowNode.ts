import { EventBus } from 'ah-event-bus';
import { GetFlowDTType, IFlowDTKey } from './FlowDTRegistry';
import { IFlowNodeClassNames, IFlowNodeMetaMap } from './FlowNodeTypeRegistry';
import { IFlowHost, IFlowHostEventData } from './IFlowHost';
import { ILogger } from './ILogger';

/** FlowNode IO.Input 定义 */
export interface IFlowNodeInput<T extends IFlowDTKey> {
  title?: string;
  dataType: T;
  defaultValue?: GetFlowDTType<T>;
  options?: Array<{ label: string; value: GetFlowDTType<T> }>;
  min?: any;
  max?: any;
  step?: any;
  accept?: string;
}

/** FlowNode IO.Output 定义 */
export interface IFlowNodeOutput<T extends IFlowDTKey> {
  title?: string;
  dataType: T;
}

export type IFlowNodeMeta<
  C extends string,
  Input extends Record<string, IFlowDTKey>,
  Output extends Record<string, IFlowDTKey>,
> = { className: C; input: Input; output: Output };

export type IFlowNodeDefineFromMeta<M extends IFlowNodeMeta<any, any, any>> = {
  className: M['className'];
  cnName?: string;

  /** host 范围内单例 */
  singleton?: boolean;

  input: {
    [K in keyof M['input']]: M['input'][K] extends IFlowDTKey ? IFlowNodeInput<M['input'][K]> : never;
  };
  output: {
    [K in keyof M['output']]: M['output'][K] extends IFlowDTKey ? IFlowNodeOutput<M['output'][K]> : never;
  };
};

export type IFlowNodeDefine<C extends IFlowNodeClassNames> = IFlowNodeDefineFromMeta<IFlowNodeMetaMap[C]>;

export type GetFlowNodeMeta<T> = T extends IFlowNodeDefine<infer R> ? R : any;

export type IFlowNodeEventFromMeta<M extends IFlowNodeMeta<any, any, any>> = {
  // input:change:xxx
  [K in keyof M['input'] as K extends string ? `input:change:${K}` : never]: M['input'][K] extends IFlowDTKey
    ? IFlowHostEventData<{
        key: K;
        value?: GetFlowDTType<M['input'][K]>;
        lastValue?: GetFlowDTType<M['input'][K]>;
        source: IFlowNodeFromMeta<M>;
      }>
    : never;
} & {
  // output:change:xxx
  [K in keyof M['output'] as K extends string ? `output:change:${K}` : never]: M['output'][K] extends IFlowDTKey
    ? IFlowHostEventData<{
        key: K;
        value?: GetFlowDTType<M['output'][K]>;
        lastValue?: GetFlowDTType<M['output'][K]>;
        source: IFlowNodeFromMeta<M>;
      }>
    : never;
} & {
  'input:change': IFlowHostEventData<{
    key: keyof M['input'];
    value: any;
    lastValue?: any;
    source: IFlowNodeFromMeta<M>;
  }>;
  'output:change': IFlowHostEventData<{
    key: keyof M['output'];
    value: any;
    lastValue?: any;
    source: IFlowNodeFromMeta<M>;
  }>;
  'props:change': IFlowHostEventData<{
    key: 'name' | 'enabled';
    value: any;
    lastValue?: any;
    source: IFlowNodeFromMeta<M>;
  }>;
  'define:change': IFlowHostEventData<{ source: IFlowNodeFromMeta<M> }>;

  'connect:change:input': IFlowHostEventData<{
    action: 'add' | 'remove';
    ioKey: keyof M['input'];
    source: IFlowNodeFromMeta<M>;
  }>;
  'connect:change:output': IFlowHostEventData<{
    action: 'add' | 'remove';
    ioKey: keyof M['output'];
    source: IFlowNodeFromMeta<M>;
  }>;
};

export type IFlowNodeEvent<C extends IFlowNodeClassNames> = IFlowNodeEventFromMeta<IFlowNodeMetaMap[C]>;

export type IFlowNodeFromMeta<M extends IFlowNodeMeta<any, any, any>> = {
  _define: IFlowNodeDefineFromMeta<M>;

  ID: string;
  name: string;
  logger: ILogger;

  host: IFlowHost;
  enabled: boolean;
  disposed: boolean;

  event: EventBus<IFlowNodeEventFromMeta<M>>;

  input: {
    [K in keyof M['input']]?: M['input'][K] extends IFlowDTKey ? GetFlowDTType<M['input'][K]> : never;
  };
  getInput<K extends keyof M['input']>(ioKey: K): M['input'][K] extends IFlowDTKey ? GetFlowDTType<M['input'][K]> : any;
  setInput<K extends keyof M['input']>(
    ioKey: K,
    value?: M['input'][K] extends IFlowDTKey ? GetFlowDTType<M['input'][K]> : never,
    opt?: { silence?: boolean; skipEqualCheck?: boolean }
  ): void;

  output: {
    [K in keyof M['output']]?: M['output'][K] extends IFlowDTKey ? GetFlowDTType<M['output'][K]> : never;
  };
  setOutput<K extends keyof M['output']>(
    ioKey: K,
    value?: M['output'][K] extends IFlowDTKey ? GetFlowDTType<M['output'][K]> : never
  ): void;

  dispose(): void;
  clearInternalInput: (key: keyof M['input']) => void;

  updateDefine(newDefine: Partial<IFlowNodeDefineFromMeta<M>>): void;
};

/** FlowNode 实例类型 */
export type IFlowNode<C extends IFlowNodeClassNames> = IFlowNodeFromMeta<IFlowNodeMetaMap[C]>;
