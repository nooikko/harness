import { describe, expect, it } from 'vitest';
import type { ClassifyResult } from '../intent-registry';
import { routeDecision } from '../route-decision';

const makeResult = (overrides: Partial<ClassifyResult> = {}): ClassifyResult => ({
  intent: 'lights.control',
  confidence: 0.9,
  plugin: 'govee',
  tool: 'set_light',
  ...overrides,
});

describe('routeDecision', () => {
  it("returns 'fast-path' for high confidence single intent", () => {
    const results = [makeResult({ confidence: 0.92 })];
    const decision = routeDecision(results);

    expect(decision.route).toBe('fast-path');
    expect(decision.intents).toHaveLength(1);
    expect(decision.intents[0]?.intent).toBe('lights.control');
  });

  it("returns 'fast-path' for multiple high-confidence intents", () => {
    const results = [
      makeResult({ intent: 'lights.control', confidence: 0.9 }),
      makeResult({ intent: 'music.play', confidence: 0.88, plugin: 'music', tool: 'play' }),
    ];
    const decision = routeDecision(results);

    expect(decision.route).toBe('fast-path');
    expect(decision.intents).toHaveLength(2);
  });

  it("returns 'llm' for low confidence", () => {
    const results = [makeResult({ confidence: 0.4 })];
    const decision = routeDecision(results);

    expect(decision.route).toBe('llm');
  });

  it("returns 'llm' when any sub-intent has low confidence", () => {
    const results = [makeResult({ intent: 'lights.control', confidence: 0.92 }), makeResult({ intent: 'unknown', confidence: 0.3 })];
    const decision = routeDecision(results);

    expect(decision.route).toBe('llm');
  });

  it("returns 'llm' for null intent", () => {
    const results = [makeResult({ intent: null, confidence: 0.0 })];
    const decision = routeDecision(results);

    expect(decision.route).toBe('llm');
  });

  it("returns 'llm' for empty results", () => {
    const decision = routeDecision([]);
    expect(decision.route).toBe('llm');
  });

  it('respects custom confidence threshold', () => {
    const results = [makeResult({ confidence: 0.75 })];

    const strict = routeDecision(results, { threshold: 0.8 });
    expect(strict.route).toBe('llm');

    const relaxed = routeDecision(results, { threshold: 0.7 });
    expect(relaxed.route).toBe('fast-path');
  });

  it('includes slots in the decision output', () => {
    const results = [makeResult({ confidence: 0.92 })];
    const slots = [{ room: 'office', action: 'on' }];
    const decision = routeDecision(results, { slots });

    expect(decision.intents[0]?.slots).toEqual({ room: 'office', action: 'on' });
  });
});
