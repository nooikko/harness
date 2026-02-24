import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { mapStreamEvent } from '../map-stream-event';

describe('mapStreamEvent', () => {
  it('maps assistant message with text content', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Hello world' },
          { type: 'text', text: 'Second block' },
        ],
      },
    } as unknown as SDKMessage;

    const event = mapStreamEvent(message);

    expect(event.type).toBe('assistant');
    expect(event.content).toBe('Hello world\nSecond block');
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.raw).toBe(message);
  });

  it('maps assistant message with tool_use content', () => {
    const message = {
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Read' }],
      },
    } as unknown as SDKMessage;

    const event = mapStreamEvent(message);

    expect(event.type).toBe('assistant');
    expect(event.toolName).toBe('Read');
    expect(event.content).toBeUndefined();
  });

  it('maps tool_progress message', () => {
    const message = {
      type: 'tool_progress',
      tool_name: 'Bash',
    } as unknown as SDKMessage;

    const event = mapStreamEvent(message);

    expect(event.type).toBe('tool_progress');
    expect(event.toolName).toBe('Bash');
  });

  it('maps tool_use_summary message', () => {
    const message = {
      type: 'tool_use_summary',
      summary: 'Read 42 lines from file.ts',
    } as unknown as SDKMessage;

    const event = mapStreamEvent(message);

    expect(event.type).toBe('tool_use_summary');
    expect(event.content).toBe('Read 42 lines from file.ts');
  });

  it('returns base event for unknown message types', () => {
    const message = {
      type: 'system',
      subtype: 'init',
    } as unknown as SDKMessage;

    const event = mapStreamEvent(message);

    expect(event.type).toBe('system');
    expect(event.content).toBeUndefined();
    expect(event.toolName).toBeUndefined();
    expect(event.raw).toBe(message);
  });

  it('handles assistant message with no content blocks', () => {
    const message = {
      type: 'assistant',
      message: { content: [] },
    } as unknown as SDKMessage;

    const event = mapStreamEvent(message);

    expect(event.content).toBeUndefined();
    expect(event.toolName).toBeUndefined();
  });

  it('handles assistant message with missing message field', () => {
    const message = {
      type: 'assistant',
    } as unknown as SDKMessage;

    const event = mapStreamEvent(message);

    expect(event.content).toBeUndefined();
  });
});
