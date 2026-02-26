import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { mapStreamEvent } from '../map-stream-event';

describe('mapStreamEvent', () => {
  it('emits one event per text block in an assistant message', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Hello world' },
          { type: 'text', text: 'Second block' },
        ],
      },
    } as unknown as SDKMessage;

    const events = mapStreamEvent(message);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'assistant', content: 'Hello world' });
    expect(events[1]).toMatchObject({ type: 'assistant', content: 'Second block' });
    expect(events[0]?.timestamp).toBeGreaterThan(0);
    expect(events[0]?.raw).toBe(message);
  });

  it('emits a tool_call event per tool_use block', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', id: 'tu_abc', name: 'Read', input: { path: '/foo' } }],
      },
    } as unknown as SDKMessage;

    const events = mapStreamEvent(message);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'tool_call',
      content: 'Read',
      toolName: 'Read',
      toolUseId: 'tu_abc',
      toolInput: { path: '/foo' },
    });
  });

  it('emits a thinking event per thinking block', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [{ type: 'thinking', thinking: 'I need to analyze this carefully.' }],
      },
    } as unknown as SDKMessage;

    const events = mapStreamEvent(message);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'thinking', content: 'I need to analyze this carefully.' });
  });

  it('emits mixed events in block order', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: 'Planning...' },
          { type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'ls' } },
          { type: 'text', text: 'Done.' },
        ],
      },
    } as unknown as SDKMessage;

    const events = mapStreamEvent(message);

    expect(events).toHaveLength(3);
    expect(events[0]?.type).toBe('thinking');
    expect(events[1]?.type).toBe('tool_call');
    expect(events[2]?.type).toBe('assistant');
  });

  it('returns empty array for assistant message with no content blocks', () => {
    const message = {
      type: 'assistant',
      message: { content: [] },
    } as unknown as SDKMessage;

    expect(mapStreamEvent(message)).toHaveLength(0);
  });

  it('returns empty array for assistant message with missing message field', () => {
    const message = { type: 'assistant' } as unknown as SDKMessage;

    expect(mapStreamEvent(message)).toHaveLength(0);
  });

  it('maps tool_progress message', () => {
    const message = {
      type: 'tool_progress',
      tool_name: 'Bash',
    } as unknown as SDKMessage;

    const events = mapStreamEvent(message);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'tool_progress', toolName: 'Bash' });
  });

  it('maps tool_use_summary message', () => {
    const message = {
      type: 'tool_use_summary',
      summary: 'Read 42 lines from file.ts',
    } as unknown as SDKMessage;

    const events = mapStreamEvent(message);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'tool_use_summary', content: 'Read 42 lines from file.ts' });
  });

  it('returns empty array for unrecognized message types', () => {
    const message = {
      type: 'system',
      subtype: 'init',
    } as unknown as SDKMessage;

    expect(mapStreamEvent(message)).toHaveLength(0);
  });
});
