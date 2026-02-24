import { describe, expect, it } from 'vitest';
import { buildArgs } from '../build-args';

describe('buildArgs', () => {
  it('builds args with JSON output format and prompt', () => {
    const args = buildArgs('hello world', { model: 'claude-sonnet-4-6' });

    expect(args).toContain('--output-format');
    expect(args).toContain('json');
    expect(args).toContain('-p');
    expect(args).toContain('hello world');
    expect(args).toContain('--model');
    expect(args).toContain('claude-sonnet-4-6');
  });

  it('includes --resume and -p when sessionId is provided', () => {
    const args = buildArgs('hello', { model: 'claude-sonnet-4-6', sessionId: 'sess-123' });

    expect(args).toContain('--resume');
    expect(args).toContain('sess-123');
    expect(args).toContain('-p');
    expect(args).toContain('hello');
  });

  it('uses -p when sessionId is not provided', () => {
    const args = buildArgs('hello', { model: 'claude-sonnet-4-6' });

    expect(args).toContain('-p');
    expect(args).toContain('hello');
    expect(args).not.toContain('--resume');
  });

  it('includes allowedTools when provided', () => {
    const args = buildArgs('prompt', {
      model: 'claude-sonnet-4-6',
      allowedTools: ['Bash', 'Read'],
    });

    expect(args).toContain('--allowedTools');
    expect(args).toContain('Bash');
    expect(args).toContain('Read');
  });

  it('includes maxTokens when provided', () => {
    const args = buildArgs('prompt', {
      model: 'claude-sonnet-4-6',
      maxTokens: 4096,
    });

    expect(args).toContain('--max-tokens');
    expect(args).toContain('4096');
  });

  it('does not include allowedTools when array is empty', () => {
    const args = buildArgs('prompt', {
      model: 'claude-sonnet-4-6',
      allowedTools: [],
    });

    expect(args).not.toContain('--allowedTools');
  });
});
