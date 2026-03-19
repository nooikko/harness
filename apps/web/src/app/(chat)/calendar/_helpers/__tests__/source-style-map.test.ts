import { describe, expect, it } from 'vitest';
import { CATEGORY_STYLES, getEventStyle, SOURCE_STYLES } from '../source-style-map';

describe('SOURCE_STYLES', () => {
  it.each(['OUTLOOK', 'LOCAL', 'MEMORY', 'TASK', 'CRON'] as const)('has entry for %s', (source) => {
    expect(SOURCE_STYLES[source]).toBeDefined();
    expect(SOURCE_STYLES[source].color).toBeTruthy();
    expect(SOURCE_STYLES[source].label).toBeTruthy();
  });

  it('CRON uses orange color', () => {
    expect(SOURCE_STYLES.CRON.color).toBe('#EA580C');
  });
});

describe('CATEGORY_STYLES', () => {
  it.each(['birthday', 'medical', 'meeting', 'reminder'])('has entry for %s', (cat) => {
    expect(CATEGORY_STYLES[cat]).toBeDefined();
    expect(CATEGORY_STYLES[cat]!.color).toBeTruthy();
  });
});

describe('getEventStyle', () => {
  it('returns source style when no category or override', () => {
    const style = getEventStyle('OUTLOOK');
    expect(style.color).toBe('#4285F4');
    expect(style.label).toBe('Outlook');
  });

  it('applies category color over source color', () => {
    const style = getEventStyle('OUTLOOK', 'medical');
    expect(style.color).toBe('#EF4444'); // medical red
    expect(style.label).toBe('Outlook'); // label stays from source
  });

  it('applies category icon over source icon', () => {
    const sourceStyle = getEventStyle('OUTLOOK');
    const catStyle = getEventStyle('OUTLOOK', 'medical');
    expect(catStyle.icon).not.toBe(sourceStyle.icon);
  });

  it('applies colorOverride over everything', () => {
    const style = getEventStyle('OUTLOOK', 'medical', '#FF0000');
    expect(style.color).toBe('#FF0000');
  });

  it('falls back to source color for unknown category', () => {
    const style = getEventStyle('TASK', 'unknown-cat');
    expect(style.color).toBe('#22C55E');
  });

  it('uses source icon when category is null', () => {
    const style = getEventStyle('CRON', null);
    expect(style.icon).toBe(SOURCE_STYLES.CRON.icon);
  });
});
