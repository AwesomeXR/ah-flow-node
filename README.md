# ah-flow-node

![workflow](https://github.com/ch-real3d/ah-flow-node/actions/workflows/ci.yml/badge.svg)

# 引入说明

```typescript
import { FlowDTRegistry, FlowNodeTypeRegistry } from 'ah-flow-node';

// 注册 IO 类型
declare module 'ah-flow-node' {
  interface IFlowDTMap {
    SmartString: any
  }
}
FlowDTRegistry.Default.register('SmartString', {});

// 注册 FlowNode
declare module 'ah-flow-node' {
  interface IFlowNodeMetaMap {
    HelloWorld: IFlowNodeMeta<'HelloWorld', { nick: 'String' }, { text: 'SmartString' }>;
  }
}
FlowNodeTypeRegistry.Default.register('HelloWorld', {});

// 创建节点
const node = FlowNodeTypeRegistry.Default.factory('HelloWorld')();
```