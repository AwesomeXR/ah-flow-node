import { IFlowHost } from './IFlowHost';
import { IFlowNodeInput, IFlowNodeOutput } from './IFlowNode';
import { FilterString } from './TypeUtil';

/** 端口类型表: 外部声明合并 */
export interface IFlowDTMap {
  String: string;
  Number: number;
  Boolean: boolean;
  JSON: any;

  'Array<String>': string[];
  'Array<Number>': number[];
  'Array<Boolean>': boolean[];

  FlowHost: IFlowHost;

  InputDefs: { key: string; def: IFlowNodeInput<IFlowDTKey> }[];
  OutputDefs: { key: string; def: IFlowNodeOutput<IFlowDTKey> }[];
}

export type IFlowDTKey = FilterString<keyof IFlowDTMap>;
export type GetFlowDTType<K extends IFlowDTKey> = IFlowDTMap[K];

/** 可外部合并 */
export interface IFlowDTRegisterData {
  title?: string;
  serializer?: 'JSON' | { save: (ins: any) => any; restore: (desc: any) => any };
  wrap?: (arg: any) => any;
  isEqual?: (a: any, b: any) => boolean;
}

/** io 类型注册中心 */
export class FlowDTRegistry {
  static readonly Default = new FlowDTRegistry();

  private _store = new Map<IFlowDTKey, IFlowDTRegisterData>();

  register<K extends IFlowDTKey>(dataType: K, data: IFlowDTRegisterData) {
    this._store.set(dataType, data);
    return this;
  }

  merge<K extends IFlowDTKey>(dataType: K, data: Partial<IFlowDTRegisterData>) {
    this._store.set(dataType, { ...this._store.get(dataType), ...data });
    return this;
  }

  get<K extends IFlowDTKey>(dataType: K) {
    return this._store.get(dataType);
  }

  getAllType(): IFlowDTKey[] {
    return [...this._store.keys()];
  }
}

// 注册内置类型
FlowDTRegistry.Default.register('String', {
  title: '文本',
  serializer: 'JSON',
  wrap: arg => (typeof arg === 'string' ? arg : arg + ''),
});
FlowDTRegistry.Default.register('Number', {
  title: '数字',
  serializer: 'JSON',
  wrap: arg => (typeof arg === 'number' ? arg : typeof arg === 'string' ? parseFloat(arg) : +arg),
});
FlowDTRegistry.Default.register('Boolean', { title: '布尔', serializer: 'JSON', wrap: arg => !!arg });
FlowDTRegistry.Default.register('JSON', { title: '配置', serializer: 'JSON' });

FlowDTRegistry.Default.register('Array<String>', {
  title: '文本列表',
  serializer: 'JSON',
  wrap: arg => (Array.isArray(arg) ? arg : typeof arg === 'string' ? [arg] : []),
});
FlowDTRegistry.Default.register('Array<Number>', {
  title: '数字列表',
  serializer: 'JSON',
  wrap: arg => (Array.isArray(arg) ? arg : typeof arg === 'number' ? [arg] : []),
});
FlowDTRegistry.Default.register('Array<Boolean>', {
  title: '布尔列表',
  serializer: 'JSON',
  wrap: arg => (Array.isArray(arg) ? arg : typeof arg === 'boolean' ? [arg] : []),
});

FlowDTRegistry.Default.register('FlowHost', { title: '容器' });
FlowDTRegistry.Default.register('InputDefs', { title: '输入配置', serializer: 'JSON' });
FlowDTRegistry.Default.register('OutputDefs', { title: '输出配置', serializer: 'JSON' });
