import { FlowDTRegistry, IFlowDTKey } from '../FlowDTRegistry';
import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from '../FlowNodeTypeRegistry';
import { IFlowNodeInput, IFlowNodeMeta } from '../IFlowNode';

declare module '../FlowNodeTypeRegistry' {
  interface IFlowNodeMetaMap {
    ComponentInputNode: IFlowNodeMeta<
      'ComponentInputNode',
      {
        inputDefs: 'InputDefs';
      },
      {}
    >;
  }
}

export const ComponentInputNodeRegisterData: IFlowNodeTypeRegisterData<'ComponentInputNode'> = {
  define: {
    className: 'ComponentInputNode',
    singleton: true,
    cnName: '组件输入',
    input: {
      inputDefs: { title: '输入配置', dataType: 'InputDefs', defaultValue: [] },
    },
    output: {},
  },
  setup(ctx) {
    function reload() {
      const newInputDef = {} as any;

      if (ctx.input.inputDefs) {
        for (const item of ctx.input.inputDefs) {
          newInputDef[item.key] = item.def;
        }
      }

      ctx.updateDefine({ output: newInputDef }); // 把 input def 镜像到 output

      // flush output (use default value)
      for (const [ioKey, ioDef] of Object.entries<IFlowNodeInput<IFlowDTKey>>(newInputDef)) {
        const dt = FlowDTRegistry.Default.get(ioDef.dataType);

        if (dt && typeof ioDef.defaultValue !== 'undefined') {
          (ctx.output as any)[ioKey] = dt.wrap ? dt.wrap(ioDef.defaultValue) : ioDef.defaultValue;
        }
      }
    }

    ctx.event.listen('input:change:inputDefs', reload);
    reload();

    return () => {};
  },
};

FlowNodeTypeRegistry.Default.register('ComponentInputNode', ComponentInputNodeRegisterData);
