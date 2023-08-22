import { EventBus } from 'ah-event-bus';
import {
  FlowEdgeManager,
  FlowNodeManager,
  FlowNodeTypeRegistry,
  IFlowHost,
  IFlowNodeMeta,
  createFlowEdge,
} from '../src';
import { Logger } from 'ah-logger';

declare module '../src' {
  interface IFlowNodeMetaMap {
    TestNode: IFlowNodeMeta<'TestNode', { nick: 'String' }, { text: 'String' }>;
    SSNode: IFlowNodeMeta<'SSNode', {}, {}>;
  }
}

describe('FlowNodeType', () => {
  FlowNodeTypeRegistry.Default.register('TestNode', {
    define: {
      className: 'TestNode',
      input: {
        nick: { dataType: 'String' },
      },
      output: {
        text: { dataType: 'String' },
      },
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
  FlowNodeTypeRegistry.Default.register('SSNode', {
    define: { className: 'SSNode', singleton: true, input: {}, output: {} },
    setup(ctx) {
      return () => {};
    },
  });

  const host: IFlowHost = {
    ID: 'x',
    event: new EventBus(),
    componentDefs: [],
    flowNodeManager: new FlowNodeManager(() => host),
    flowEdgeManager: new FlowEdgeManager(() => host),
    logger: new Logger('Test'),
  };

  afterEach(() => {
    host.flowEdgeManager.all.forEach(edge => edge.dispose());
    host.flowNodeManager.all.forEach(n => n.dispose());
  });

  it('create & connect', () => {
    const n1 = FlowNodeTypeRegistry.Default.factory('TestNode')(host, Math.random() + '');
    const n2 = FlowNodeTypeRegistry.Default.factory('TestNode')(host, Math.random() + '');

    const e1 = createFlowEdge<'TestNode', 'text', 'TestNode', 'nick'>(
      host,
      { node: n1, ioKey: 'text' },
      { node: n2, ioKey: 'nick' },
      'e1'
    );

    expect(host.flowNodeManager.get(n1.ID)?.name).toEqual(n1.name);
    expect(host.flowNodeManager.get(n2.ID)?.name).toEqual(n2.name);
    expect(host.flowEdgeManager.get(e1.ID)).toBeTruthy();

    e1.dispose();
    expect(host.flowEdgeManager.get(e1.ID)).toBeFalsy();
  });

  it('data flow', () => {
    const n1 = FlowNodeTypeRegistry.Default.factory('TestNode')(host, Math.random() + '');
    const n2 = FlowNodeTypeRegistry.Default.factory('TestNode')(host, Math.random() + '');

    createFlowEdge<'TestNode', 'text', 'TestNode', 'nick'>(
      host,
      { node: n1, ioKey: 'text' },
      { node: n2, ioKey: 'nick' },
      'e1'
    );

    let a = false;
    let b = false;
    let c = false;
    let d = false;

    n1.event.listen('input:change:nick', () => {
      a = true;
    });

    n1.event.listen('output:change:text', () => {
      b = true;
    });

    n2.event.listen('output:change:text', () => {
      c = true;
    });

    n2.event.listen('output:change:text', () => {
      d = true;
    });

    n1.input.nick = 'Jam';
    expect(n1.output.text).toBe('Hello, Jam!');
    expect(n2.output.text).toBe('Hello, Hello, Jam!!');

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(c).toBeTruthy();
    expect(d).toBeTruthy();
  });

  it('singleton restriction', () => {
    FlowNodeTypeRegistry.Default.factory('SSNode')(host, Math.random() + '');
    expect(() => FlowNodeTypeRegistry.Default.factory('SSNode')(host, Math.random() + '')).toThrow(
      'singleton restriction'
    );
  });
});
