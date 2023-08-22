import { EventBus } from 'ah-event-bus';
import { IFlowHost } from './IFlowHost';
import { IFlowNode, IFlowNodeDefine, IFlowNodeFromMeta, IFlowNodeInput, IFlowNodeMeta } from './IFlowNode';
import { FilterString } from './TypeUtil';
import { FlowDTRegistry, IFlowDTKey } from './FlowDTRegistry';
import { Util } from './Util';

/** FlowNode 定义注册表: 外部声明合并 */
export interface IFlowNodeMetaMap {
  HelloWorld: IFlowNodeMeta<'HelloWorld', { nick: 'String' }, { text: 'String' }>;
}
export type IFlowNodeClassNames = FilterString<keyof (IFlowNodeMetaMap & {})>;

export type IFlowNodeTypeRegisterData<C extends IFlowNodeClassNames> = {
  define: IFlowNodeDefine<C>;
  setup: (ctx: IFlowNode<C>) => () => any;
};

export type IDefaultFlowNode = IFlowNodeFromMeta<{
  className: IFlowNodeClassNames;
  input: Record<string, IFlowDTKey>;
  output: Record<string, IFlowDTKey>;
}>;

export class FlowNodeTypeRegistry {
  static readonly Default = new FlowNodeTypeRegistry();

  private _store = new Map<IFlowNodeClassNames, IFlowNodeTypeRegisterData<any>>();

  register<C extends IFlowNodeClassNames>(className: C, data: IFlowNodeTypeRegisterData<C>) {
    this._store.set(className, data);
    return this;
  }

  unregister<C extends IFlowNodeClassNames>(className: C) {
    this._store.delete(className);
    return this;
  }

  merge<C extends IFlowNodeClassNames>(className: C, data: Partial<IFlowNodeTypeRegisterData<C>>) {
    this._store.set(className, { ...(this._store.get(className) as any), ...data });
    return this;
  }

  get<C extends IFlowNodeClassNames>(className: C) {
    return this._store.get(className) as IFlowNodeTypeRegisterData<C> | undefined;
  }

  getAllType(): IFlowNodeClassNames[] {
    return [...this._store.keys()];
  }

  clear() {
    this._store.clear();
  }

  factory<C extends IFlowNodeClassNames>(className: C) {
    type _Node = IFlowNode<C>;

    return (host: IFlowHost, ID: string, initName?: string, initInputs?: _Node['input'], initEnabled?: boolean) => {
      // 执行 factory 的时候再取 register data，因为会有新的注册数据覆盖进来
      const registerData = this.get(className);
      if (!registerData) throw new Error('not registered: ' + className);

      if (ID.includes('/')) throw new Error('ID format error: /');

      const { define, setup } = registerData;

      // 检查单例限制
      if (define.singleton && host.flowNodeManager.all.some(n => n._define.className === className)) {
        throw new Error(`singleton restriction: ${className}:${ID}`);
      }

      const name = initName || `${define.cnName || define.className}_${ID}`;

      const _node: _Node = {
        host,
        ID,
        name,
        _define: Util.cloneNodeDefine(define), // 复制一份 define 数据，实例可动态修改，避免影响原始定义
        __outputDirectlyCBs: [],
      } as any;

      _node.enabled = typeof initEnabled === 'undefined' ? true : initEnabled;
      _node.disposed = false;
      _node.logger = host.logger.extend(className).extend(ID);

      _node.event = new EventBus();

      _node.clearInternalInput = (key: any) => {
        (_node.input as any)[key] = undefined as any;
      };

      _node.updateDefine = newDefine => {
        if (newDefine.className && newDefine.className !== define.className) {
          throw new Error('cannot redefine className');
        }
        if (newDefine.singleton && newDefine.singleton !== define.singleton) {
          throw new Error('cannot redefine singleton');
        }

        Object.assign(_node._define, newDefine);
        _node.event.emit('define:change', { source: proxyNode } as any);
      };

      (_node as any)._input = {}; // input stash

      _node.getInput = (ioKey: any) => {
        let value = (_node as any)._input[ioKey];

        let dtDef =
          typeof ioKey === 'string' &&
          (_node._define.input as any)[ioKey] &&
          FlowDTRegistry.Default.get((_node._define.input as any)[ioKey].dataType);

        // value 自动包装 (运行时动态 define 场景)
        if (dtDef && dtDef.wrap && typeof value !== 'undefined') value = dtDef.wrap(value);

        return value;
      };

      _node.setInput = (ioKey, value, opt = {}) => {
        if (typeof ioKey !== 'string') throw new Error('ioKey is not string: ' + typeof ioKey);

        const ioDef = _node._define.input[ioKey];
        if (!ioDef) throw new Error('has no ioKey: ' + ioKey);

        const dtDef = FlowDTRegistry.Default.get(ioDef.dataType);

        // value 自动包装
        if (dtDef && dtDef.wrap && typeof value !== 'undefined') {
          // const _stash = value;
          value = dtDef.wrap(value);
          // if (value !== _stash) _node.logger.warn('wrapped <%s> input.%s', ioDef.dataType, ioKey);
        }

        const lastValue = (_node as any)._input[ioKey];

        // 判断如果值没变化，就退出
        if (
          !opt.skipEqualCheck &&
          (dtDef && dtDef.isEqual && typeof value !== 'undefined' && typeof lastValue !== 'undefined'
            ? dtDef.isEqual(value, lastValue)
            : lastValue === value)
        ) {
          return;
        }

        if (typeof value === 'undefined') delete (_node as any)._input[ioKey];
        else (_node as any)._input[ioKey] = value;

        // 只有 .enabled 的状态，才可以触发 input 事件
        if (!opt.silence && _node.enabled) {
          _node.event.emit(`input:change:${ioKey}` as any, { key: ioKey, value, lastValue, source: proxyNode } as any);
          _node.event.emit(`input:change`, { key: ioKey, value, lastValue, source: proxyNode } as any);
        }
      };

      // proxy 拦截 input 写入
      _node.input = new Proxy((_node as any)._input /** THIS IS STASH */, {
        set(_target, _ioKey, value) {
          const ioKey = _ioKey as keyof IFlowNodeMetaMap[C]['input'];

          try {
            _node.setInput(ioKey, value);
          } catch (error) {
            _node.logger.error('write %s discard: %s', _node.name + ':' + (ioKey as any), error + '');
            console.error(error);
          }

          return true;
        },
        get(_target, _p) {
          return _node.getInput(_p as any);
        },
      });

      // output stash
      (_node as any)._output = {};

      // 设置 output, 并触发 output:change 事件
      _node.setOutput = (ioKey, value) => {
        if (!_node.enabled) {
          // disabled 状态下，不要产生任何输出
          _node.logger.error('write %s discard: is not enabled', _node.name + ':' + (ioKey as any));
          return;
        }

        if (typeof ioKey === 'string' && (_node._define.output as any)[ioKey]) {
          const lastValue = (_node as any)._output[ioKey];

          if (value !== lastValue) {
            (_node as any)._output[ioKey] = value;

            // 再通知所有监听 output:change 的节点
            _node.event.emit(
              `output:change:${ioKey}` as any,
              { key: ioKey, value, lastValue, source: proxyNode } as any
            );
            _node.event.emit(`output:change`, { key: ioKey, value, lastValue, source: proxyNode } as any);
          }
        }
      };

      // proxy 拦截 output 写入
      _node.output = new Proxy<any>((_node as any)._output /** THIS IS STASH */, {
        set(_target, ioKey, value) {
          _node.setOutput(ioKey as any, value);
          return true;
        },
      });

      // proxy 拦截属性写入
      const proxyNode: any = new Proxy(_node, {
        set(target, ioKey, value, receiver) {
          // 禁止这几个属性直接写入
          if (typeof ioKey === 'string' && ['input', 'output'].includes(ioKey)) {
            return false;
          }

          const lastValue = Reflect.get(target, ioKey, receiver);
          if (value === lastValue) return true;

          const writeOk = Reflect.set(target, ioKey, value, receiver);

          if (writeOk && typeof ioKey === 'string') {
            if (ioKey === 'enabled') {
              if (value) innerSetEnabled();
              else innerSetDisabled();
            }

            _node.event.emit('props:change', { key: ioKey, value, lastValue, source: proxyNode } as any);
          }

          return writeOk;
        },
      });

      // 初始化
      // 设置 input 初始值

      // 1. 先从 _define.input 加载默认值
      Object.entries(_node._define.input).forEach(([inKey, _ioDef]) => {
        const ioDef = _ioDef as IFlowNodeInput<any>;

        if (typeof ioDef.defaultValue !== 'undefined') {
          // 直接写入 input stash，绕过 .enabled 判断
          (_node as any)._input[inKey] = ioDef.defaultValue;
        }
      });

      // 2. 再从 initInputs 加载
      if (initInputs) Object.assign((_node as any)._input, initInputs);

      let _setupDispose: (() => void) | undefined = undefined;

      const innerSetEnabled = () => {
        _setupDispose = setup(proxyNode);
      };

      const innerSetDisabled = () => {
        _setupDispose?.();
      };

      // node dispose
      _node.dispose = () => {
        if (_node.disposed) return;

        innerSetDisabled();

        // 关闭监听
        removeQueryListen();
        _node.event.clear();
        _node.disposed = true;

        // 从 flowNodeManager 和 edgeManager 中移除
        host.flowNodeManager.remove(proxyNode as any);

        const toRemoveEdges = host.flowEdgeManager.all.filter(
          edge => edge.from.node.ID === _node.ID || edge.to.node.ID === _node.ID
        );
        toRemoveEdges.forEach(edge => edge.dispose());
      };

      // node 事件代理到上层(在 setup 之前建立代理)
      _node.event.delegate(_node.host.event.delegateReceiver('node:'));

      // 响应 builtin host 事件
      const removeQueryListen = _node.host.event.listen('travelNode', ev => {
        if (_node.enabled) ev.tap(proxyNode);
      });

      if (_node.enabled) innerSetEnabled();

      host.flowNodeManager.add(proxyNode as any);

      return proxyNode;
    };
  }
}

// 内建节点
FlowNodeTypeRegistry.Default.register('HelloWorld', {
  define: {
    className: 'HelloWorld',
    input: { nick: { dataType: 'String' } },
    output: { text: { dataType: 'String' } },
  },
  setup: ctx => {
    const flush_nick = () => {
      if (!ctx.input.nick) return;
      ctx.output.text = 'Hello, ' + ctx.input.nick + '!';
    };

    ctx.event.listen('input:change:nick', flush_nick);

    return () => {};
  },
});
