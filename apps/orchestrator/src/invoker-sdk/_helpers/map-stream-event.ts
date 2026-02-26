// Maps raw SDK messages to InvokeStreamEvent[] — one event per content block

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { InvokeStreamEvent } from '@harness/plugin-contract';

type MapStreamEvent = (message: SDKMessage) => InvokeStreamEvent[];

export const mapStreamEvent: MapStreamEvent = (message) => {
  const timestamp = Date.now();

  if (message.type === 'assistant') {
    const assistantMsg = message as SDKMessage & {
      message?: {
        content?: Array<{
          type: string;
          text?: string;
          thinking?: string;
          name?: string;
          id?: string;
          input?: unknown;
        }>;
      };
    };
    const blocks = assistantMsg.message?.content ?? [];
    const events: InvokeStreamEvent[] = [];

    for (const block of blocks) {
      if (block.type === 'thinking' && block.thinking) {
        events.push({ type: 'thinking', content: block.thinking, timestamp, raw: message });
      } else if (block.type === 'tool_use' && block.name) {
        events.push({
          type: 'tool_call',
          content: block.name,
          toolName: block.name,
          toolUseId: block.id,
          toolInput: block.input,
          timestamp,
          raw: message,
        });
      } else if (block.type === 'text' && block.text) {
        events.push({ type: 'assistant', content: block.text, timestamp, raw: message });
      }
    }

    return events;
  }

  if (message.type === 'tool_progress') {
    const progressMsg = message as SDKMessage & { tool_name?: string };
    return [{ type: 'tool_progress', toolName: progressMsg.tool_name, timestamp, raw: message }];
  }

  if (message.type === 'tool_use_summary') {
    const summaryMsg = message as SDKMessage & { summary?: string };
    return [{ type: 'tool_use_summary', content: summaryMsg.summary, timestamp, raw: message }];
  }

  return [];
};
