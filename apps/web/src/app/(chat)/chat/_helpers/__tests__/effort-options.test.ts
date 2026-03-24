import { describe, expect, it } from 'vitest';
import { getEffortOptions } from '../effort-options';

describe('getEffortOptions', () => {
  it('returns Off as only non-default option for haiku', () => {
    const options = getEffortOptions('haiku');
    const labels = options.map((o) => o.label);
    expect(labels).toEqual(['Default (Off)', 'Off', 'Low']);
  });

  it('returns Off through High for sonnet', () => {
    const options = getEffortOptions('claude-sonnet-4-6');
    const labels = options.map((o) => o.label);
    expect(labels).toEqual(['Default (Medium)', 'Off', 'Low', 'Medium', 'High']);
  });

  it('returns Off through Max for opus 4.6', () => {
    const options = getEffortOptions('claude-opus-4-6');
    const labels = options.map((o) => o.label);
    expect(labels).toEqual(['Default (High)', 'Off', 'Low', 'Medium', 'High', 'Max']);
  });

  it('returns Off through Max for opus 4.5', () => {
    const options = getEffortOptions('claude-opus-4-5-20251101');
    const labels = options.map((o) => o.label);
    expect(labels).toEqual(['Default (High)', 'Off', 'Low', 'Medium', 'High', 'Max']);
  });

  it('returns all options with generic Default for null model', () => {
    const options = getEffortOptions(null);
    const labels = options.map((o) => o.label);
    expect(labels).toEqual(['Default', 'Off', 'Low', 'Medium', 'High', 'Max']);
  });

  it('returns all options with generic Default for unknown model', () => {
    const options = getEffortOptions('custom-model');
    const labels = options.map((o) => o.label);
    expect(labels).toEqual(['Default', 'Off', 'Low', 'Medium', 'High', 'Max']);
  });

  it('default option always has empty string value', () => {
    for (const model of ['haiku', 'claude-sonnet-4-6', 'claude-opus-4-6', null]) {
      const options = getEffortOptions(model);
      expect(options[0]?.value).toBe('');
    }
  });

  it("off option has value 'off'", () => {
    const options = getEffortOptions('claude-sonnet-4-6');
    const off = options.find((o) => o.label === 'Off');
    expect(off?.value).toBe('off');
  });

  it('matches haiku variant strings', () => {
    const options = getEffortOptions('claude-haiku-4-5-20251001');
    expect(options.map((o) => o.label)).toEqual(['Default (Off)', 'Off', 'Low']);
  });
});
