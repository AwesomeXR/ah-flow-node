import { FlowNodeTypeRegistry, IFlowNodeTypeRegisterData } from '../FlowNodeTypeRegistry';
import { IFlowNodeMeta } from '../IFlowNode';
import { Util } from '../Util';

declare module '../FlowNodeTypeRegistry' {
  interface IFlowNodeMetaMap {
    ComponentOutputNode: IFlowNodeMeta<
      'ComponentOutputNode',
      {
        outputDefs: 'OutputDefs';
      },
      {}
    >;
  }
}

export const ComponentOutputNodeRegisterData: IFlowNodeTypeRegisterData<'ComponentOutputNode'> = {
  define: {
    className: 'ComponentOutputNode',
    singleton: true,
    cnName: '组件输出',
    input: {
      outputDefs: { title: '输出配置', dataType: 'OutputDefs' },
    },
    output: {},
  },
  setup(ctx) {
    const originInputDef = Util.cloneNodeInputDefine(ctx._define.input);

    function reload() {
      const newInputDef = { ...originInputDef } as any;

      // 把 output def 镜像到 input
      if (ctx.input.outputDefs) {
        for (const item of ctx.input.outputDefs) {
          newInputDef[item.key] = item.def;
        }
      }

      ctx.updateDefine({ input: newInputDef });
    }

    ctx.event.listen('input:change:outputDefs', reload);
    reload();

    return () => {};
  },
};

FlowNodeTypeRegistry.Default.register('ComponentOutputNode', ComponentOutputNodeRegisterData);
