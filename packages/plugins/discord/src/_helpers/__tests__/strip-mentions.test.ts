import { describe, expect, it } from 'vitest';
import { stripMentions } from '../strip-mentions';

describe('stripMentions', () => {
  const botUserId = 'bot-999';

  it('removes bot mention from content', () => {
    expect(stripMentions('<@bot-999> hello', botUserId)).toBe('hello');
  });

  it('removes bot mention with exclamation mark', () => {
    expect(stripMentions('<@!bot-999> hello', botUserId)).toBe('hello');
  });

  it('removes multiple mentions of the bot', () => {
    expect(stripMentions('<@bot-999> hi <@bot-999>', botUserId)).toBe('hi');
  });

  it('preserves other user mentions', () => {
    expect(stripMentions('<@other-123> hello <@bot-999>', botUserId)).toBe('<@other-123> hello');
  });

  it('returns trimmed content when no mention present', () => {
    expect(stripMentions('  hello world  ', botUserId)).toBe('hello world');
  });

  it('returns empty string when content is only the mention', () => {
    expect(stripMentions('<@bot-999>', botUserId)).toBe('');
  });
});
