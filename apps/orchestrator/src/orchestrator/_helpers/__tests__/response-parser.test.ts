import { describe, expect, it } from 'vitest';
import type { ParsedResponse } from '../response-parser';
import { parseResponse } from '../response-parser';

describe('parseResponse', () => {
  describe('single command extraction', () => {
    it('extracts a command block with type and content', () => {
      const raw = `Here's what I'll do.

[COMMAND type="delegate" model="sonnet"]
Research X thoroughly and write a report.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]).toEqual({
        type: 'delegate',
        params: { model: 'sonnet' },
        content: 'Research X thoroughly and write a report.',
      });
    });

    it('extracts the type from params and promotes it to the top level', () => {
      const raw = `[COMMAND type="cron_create" schedule="0 7 * * *"]
Check email every morning.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.type).toBe('cron_create');
      expect(result.commands[0]?.params).toEqual({ schedule: '0 7 * * *' });
      expect(result.commands[0]?.params).not.toHaveProperty('type');
    });

    it('handles a command with no extra params beyond type', () => {
      const raw = `[COMMAND type="status"]
Show current status.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]).toEqual({
        type: 'status',
        params: {},
        content: 'Show current status.',
      });
    });
  });

  describe('regular message extraction', () => {
    it('returns regular content without command blocks', () => {
      const raw = `Here's what I found.

[COMMAND type="delegate" model="sonnet"]
Research X.
[/COMMAND]

Let me know if you need anything else.`;

      const result = parseResponse(raw);

      expect(result.message).toBe("Here's what I found.\n\nLet me know if you need anything else.");
    });

    it('returns entire string as message when no commands exist', () => {
      const raw = 'Just a regular response with no commands at all.';

      const result = parseResponse(raw);

      expect(result.commands).toEqual([]);
      expect(result.message).toBe('Just a regular response with no commands at all.');
    });

    it('returns empty message when response is only a command block', () => {
      const raw = `[COMMAND type="delegate" model="opus"]
Do the thing.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.message).toBe('');
      expect(result.commands).toHaveLength(1);
    });

    it('preserves message content structure after command removal', () => {
      const raw = `First paragraph.

Second paragraph.

[COMMAND type="delegate"]
Task content.
[/COMMAND]

Third paragraph.`;

      const result = parseResponse(raw);

      expect(result.message).toContain('First paragraph.');
      expect(result.message).toContain('Second paragraph.');
      expect(result.message).toContain('Third paragraph.');
    });
  });

  describe('multiple commands', () => {
    it('extracts multiple command blocks from one response', () => {
      const raw = `I'll handle both tasks.

[COMMAND type="delegate" model="sonnet"]
Research topic A.
[/COMMAND]

[COMMAND type="delegate" model="haiku"]
Summarize findings for topic B.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands).toHaveLength(2);
      expect(result.commands[0]?.type).toBe('delegate');
      expect(result.commands[0]?.params.model).toBe('sonnet');
      expect(result.commands[0]?.content).toBe('Research topic A.');
      expect(result.commands[1]?.type).toBe('delegate');
      expect(result.commands[1]?.params.model).toBe('haiku');
      expect(result.commands[1]?.content).toBe('Summarize findings for topic B.');
    });

    it('extracts commands of different types', () => {
      const raw = `Setting things up.

[COMMAND type="delegate" model="sonnet"]
Research X.
[/COMMAND]

[COMMAND type="cron_create" schedule="0 7 * * *"]
Morning digest.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands).toHaveLength(2);
      expect(result.commands[0]?.type).toBe('delegate');
      expect(result.commands[1]?.type).toBe('cron_create');
    });

    it('preserves message content around multiple commands', () => {
      const raw = `Before first.

[COMMAND type="delegate"]
Task 1.
[/COMMAND]

Between commands.

[COMMAND type="delegate"]
Task 2.
[/COMMAND]

After last.`;

      const result = parseResponse(raw);

      expect(result.message).toContain('Before first.');
      expect(result.message).toContain('Between commands.');
      expect(result.message).toContain('After last.');
      expect(result.message).not.toContain('[COMMAND');
      expect(result.message).not.toContain('[/COMMAND]');
    });
  });

  describe('malformed command handling', () => {
    it('ignores command blocks without a type parameter', () => {
      const raw = `[COMMAND model="sonnet"]
No type here.
[/COMMAND]

Regular text.`;

      const result = parseResponse(raw);

      expect(result.commands).toEqual([]);
      // Malformed blocks without type are left in the message
      expect(result.message).toContain('Regular text.');
    });

    it('ignores unclosed command blocks', () => {
      const raw = `[COMMAND type="delegate"]
This block is never closed.

Some regular text after.`;

      const result = parseResponse(raw);

      expect(result.commands).toEqual([]);
      expect(result.message).toContain('[COMMAND');
      expect(result.message).toContain('Some regular text after.');
    });

    it('ignores closing tags without opening tags', () => {
      const raw = `Some text.
[/COMMAND]
More text.`;

      const result = parseResponse(raw);

      expect(result.commands).toEqual([]);
      expect(result.message).toContain('[/COMMAND]');
    });

    it('handles empty command content', () => {
      const raw = `[COMMAND type="ping"]
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0]?.content).toBe('');
    });

    it('handles empty input', () => {
      const result = parseResponse('');

      expect(result.commands).toEqual([]);
      expect(result.message).toBe('');
    });
  });

  describe('parameter parsing', () => {
    it('extracts multiple parameters from a command', () => {
      const raw = `[COMMAND type="delegate" model="claude-sonnet-4-6" timeout="60000"]
Do something.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.params).toEqual({
        model: 'claude-sonnet-4-6',
        timeout: '60000',
      });
    });

    it('supports single-quoted parameter values', () => {
      const raw = `[COMMAND type='delegate' model='opus']
Task.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.type).toBe('delegate');
      expect(result.commands[0]?.params.model).toBe('opus');
    });

    it('supports mixed double and single-quoted parameters', () => {
      const raw = `[COMMAND type="delegate" model='sonnet' priority="high"]
Mixed quotes task.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.type).toBe('delegate');
      expect(result.commands[0]?.params.model).toBe('sonnet');
      expect(result.commands[0]?.params.priority).toBe('high');
    });

    it('handles parameters with empty values', () => {
      const raw = `[COMMAND type="delegate" label=""]
Task.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.params.label).toBe('');
    });

    it('handles parameters with special characters in values', () => {
      const raw = `[COMMAND type="cron_create" schedule="0 7 * * MON-FRI"]
Weekday check.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.params.schedule).toBe('0 7 * * MON-FRI');
    });

    it('handles single-quoted empty parameter values', () => {
      const raw = `[COMMAND type='delegate' tag='']
Task.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.params.tag).toBe('');
    });
  });

  describe('nested JSON in command content', () => {
    it('preserves JSON objects in command content', () => {
      const raw = `[COMMAND type="configure"]
{
  "model": "claude-sonnet-4-6",
  "maxTokens": 4096,
  "tools": ["read", "write"]
}
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.content).toContain('"model": "claude-sonnet-4-6"');
      const parsed = JSON.parse(result.commands[0]?.content ?? '');
      expect(parsed).toEqual({
        model: 'claude-sonnet-4-6',
        maxTokens: 4096,
        tools: ['read', 'write'],
      });
    });

    it('preserves nested JSON with arrays and objects', () => {
      const raw = `[COMMAND type="batch"]
{
  "tasks": [
    {"name": "task-1", "priority": 1},
    {"name": "task-2", "priority": 2}
  ],
  "config": {
    "parallel": true
  }
}
[/COMMAND]`;

      const result = parseResponse(raw);

      const parsed = JSON.parse(result.commands[0]?.content ?? '');
      expect(parsed.tasks).toHaveLength(2);
      expect(parsed.config.parallel).toBe(true);
    });

    it('preserves content with square brackets in JSON', () => {
      const raw = `[COMMAND type="delegate"]
{
  "tools": ["read_file", "write_file", "bash"],
  "restrictions": ["no_network"]
}
[/COMMAND]`;

      const result = parseResponse(raw);

      const parsed = JSON.parse(result.commands[0]?.content ?? '');
      expect(parsed.tools).toEqual(['read_file', 'write_file', 'bash']);
    });
  });

  describe('multiline command content', () => {
    it('preserves multiline content with leading/trailing whitespace trimmed', () => {
      const raw = `[COMMAND type="delegate" model="sonnet"]
Line one of the task.
Line two with more detail.
Line three with conclusion.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.content).toBe('Line one of the task.\nLine two with more detail.\nLine three with conclusion.');
    });

    it('preserves blank lines within command content', () => {
      const raw = `[COMMAND type="delegate"]
Paragraph one.

Paragraph two.
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.content).toBe('Paragraph one.\n\nParagraph two.');
    });

    it('preserves code blocks in command content', () => {
      const raw = `[COMMAND type="delegate"]
Create a file with this content:

\`\`\`typescript
const hello = "world";
console.log(hello);
\`\`\`
[/COMMAND]`;

      const result = parseResponse(raw);

      expect(result.commands[0]?.content).toContain('```typescript');
      expect(result.commands[0]?.content).toContain('const hello = "world"');
    });
  });

  describe('regex reusability', () => {
    it('can be called multiple times without state leakage', () => {
      const raw1 = `[COMMAND type="first"]Content 1.[/COMMAND]`;
      const raw2 = `[COMMAND type="second"]Content 2.[/COMMAND]`;

      const result1 = parseResponse(raw1);
      const result2 = parseResponse(raw2);

      expect(result1.commands[0]?.type).toBe('first');
      expect(result2.commands[0]?.type).toBe('second');
    });

    it('handles alternating empty and non-empty inputs', () => {
      const empty = parseResponse('');
      const withCommand = parseResponse('[COMMAND type="test"]Content.[/COMMAND]');
      const emptyAgain = parseResponse('');

      expect(empty.commands).toEqual([]);
      expect(withCommand.commands).toHaveLength(1);
      expect(emptyAgain.commands).toEqual([]);
    });
  });

  describe('return type structure', () => {
    it('always returns an object with commands array and message string', () => {
      const result: ParsedResponse = parseResponse('anything');

      expect(Array.isArray(result.commands)).toBe(true);
      expect(typeof result.message).toBe('string');
    });

    it('commands array contains objects with type, params, and content', () => {
      const raw = `[COMMAND type="delegate" model="sonnet"]Task.[/COMMAND]`;
      const result = parseResponse(raw);

      const cmd = result.commands[0];
      expect(cmd).toBeDefined();
      expect(typeof cmd?.type).toBe('string');
      expect(typeof cmd?.params).toBe('object');
      expect(typeof cmd?.content).toBe('string');
    });
  });
});
