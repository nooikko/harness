import type { Message } from '@harness/database';
import { describe, expect, it } from 'vitest';
import { groupPipelineRuns } from '../group-pipeline-runs';

const msg = (overrides: Partial<Message> & { id: string }): Message =>
  ({
    threadId: 't1',
    role: 'system',
    content: '',
    kind: 'text',
    source: null,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  }) as Message;

describe('groupPipelineRuns', () => {
  it('returns regular messages when no pipeline status exists', () => {
    const messages = [
      msg({ id: '1', role: 'user', content: 'Hello', kind: 'text' }),
      msg({ id: '2', role: 'assistant', content: 'Hi', kind: 'text' }),
    ];
    const groups = groupPipelineRuns(messages);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.type).toBe('message');
    expect(groups[1]!.type).toBe('message');
  });

  it('closes an open run when a non-activity text message arrives', () => {
    const messages = [
      msg({ id: '1', kind: 'status', content: 'Pipeline started' }),
      msg({ id: '2', kind: 'pipeline_step', content: 'onMessage' }),
      msg({ id: '3', role: 'assistant', kind: 'text', content: 'Response' }),
    ];
    const groups = groupPipelineRuns(messages);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.type).toBe('pipeline_run');
    expect(groups[1]!.type).toBe('message');
  });

  it('closes trailing open run at end of messages', () => {
    const messages = [msg({ id: '1', kind: 'status', content: 'Pipeline started' }), msg({ id: '2', kind: 'thinking', content: '...' })];
    const groups = groupPipelineRuns(messages);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.type).toBe('pipeline_run');
    if (groups[0]!.type === 'pipeline_run') {
      expect(groups[0]!.run.completeMessage).toBeNull();
      expect(groups[0]!.run.activityMessages).toHaveLength(1);
    }
  });

  it('closes previous run when a new start arrives without complete', () => {
    const messages = [
      msg({ id: '1', kind: 'status', content: 'Pipeline started' }),
      msg({ id: '2', kind: 'pipeline_step', content: 'step1' }),
      msg({ id: '3', kind: 'status', content: 'Pipeline started' }),
      msg({ id: '4', kind: 'status', content: 'Pipeline completed' }),
    ];
    const groups = groupPipelineRuns(messages);
    expect(groups).toHaveLength(2);
    // First run: no complete message
    if (groups[0]!.type === 'pipeline_run') {
      expect(groups[0]!.run.completeMessage).toBeNull();
    }
    // Second run: has complete
    if (groups[1]!.type === 'pipeline_run') {
      expect(groups[1]!.run.completeMessage).not.toBeNull();
    }
  });

  it('ignores complete status when no run is open', () => {
    const messages = [
      msg({ id: '1', kind: 'status', content: 'Pipeline completed' }),
      msg({ id: '2', role: 'user', kind: 'text', content: 'Hello' }),
    ];
    const groups = groupPipelineRuns(messages);
    // Complete without a run is treated as a regular message (status outside run)
    expect(groups).toHaveLength(2);
  });

  it('groups tool_progress messages inside a pipeline run', () => {
    const messages = [
      msg({ id: '1', kind: 'status', content: 'Pipeline started', metadata: { event: 'pipeline_start' } }),
      msg({ id: '2', kind: 'tool_call', content: 'import_transcript', role: 'assistant' }),
      msg({ id: '3', kind: 'tool_progress', content: 'Processing chunk 1/3' }),
      msg({ id: '4', kind: 'tool_progress', content: 'Processing chunk 2/3' }),
      msg({ id: '5', kind: 'tool_progress', content: 'Processing chunk 3/3' }),
      msg({ id: '6', kind: 'tool_result', content: 'Done', role: 'assistant' }),
      msg({ id: '7', kind: 'status', content: 'Pipeline completed', metadata: { event: 'pipeline_complete' } }),
    ];

    const groups = groupPipelineRuns(messages);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.type).toBe('pipeline_run');
    if (groups[0]!.type === 'pipeline_run') {
      // All non-status messages should be in activityMessages
      expect(groups[0]!.run.activityMessages).toHaveLength(5);
      const kinds = groups[0]!.run.activityMessages.map((m) => m.kind);
      expect(kinds).toEqual(['tool_call', 'tool_progress', 'tool_progress', 'tool_progress', 'tool_result']);
    }
  });
});
