import { describe, expect, it } from 'vitest';
import { parseCommands } from '../parse-commands';

describe('parseCommands', () => {
  it('returns empty array for text with no commands', () => {
    const result = parseCommands('Just some regular text\nNothing special here');

    expect(result).toEqual([]);
  });

  it('parses a single command with args', () => {
    const result = parseCommands('/checkin Making progress on the task');

    expect(result).toEqual([{ command: 'checkin', args: 'Making progress on the task' }]);
  });

  it('parses a command with no args', () => {
    const result = parseCommands('/status');

    expect(result).toEqual([{ command: 'status', args: '' }]);
  });

  it('parses multiple commands from multiline output', () => {
    const output = [
      'Starting work on the task...',
      '/checkin Completed step 1',
      'More output here',
      '/delegate model=claude-sonnet-4-6 Research the API docs',
      'Final thoughts',
    ].join('\n');

    const result = parseCommands(output);

    expect(result).toEqual([
      { command: 'checkin', args: 'Completed step 1' },
      {
        command: 'delegate',
        args: 'model=claude-sonnet-4-6 Research the API docs',
      },
    ]);
  });

  it('handles commands with hyphens in the name', () => {
    const result = parseCommands('/re-delegate Fix the failing tests');

    expect(result).toEqual([{ command: 're-delegate', args: 'Fix the failing tests' }]);
  });

  it('trims whitespace from args', () => {
    const result = parseCommands('/checkin   lots of spaces   ');

    expect(result).toEqual([{ command: 'checkin', args: 'lots of spaces' }]);
  });

  it('ignores lines with slashes that are not at the start', () => {
    const result = parseCommands('Use the /api/v1/endpoint for requests\nSee docs at https://example.com/path');

    expect(result).toEqual([]);
  });

  it('handles indented command lines', () => {
    const result = parseCommands('  /checkin Progress update');

    expect(result).toEqual([{ command: 'checkin', args: 'Progress update' }]);
  });

  it('returns empty array for empty string', () => {
    const result = parseCommands('');

    expect(result).toEqual([]);
  });

  it('ignores lines with only a slash', () => {
    const result = parseCommands('/');

    expect(result).toEqual([]);
  });

  it('handles command followed by empty lines', () => {
    const result = parseCommands('/checkin Done\n\n\n');

    expect(result).toEqual([{ command: 'checkin', args: 'Done' }]);
  });
});
