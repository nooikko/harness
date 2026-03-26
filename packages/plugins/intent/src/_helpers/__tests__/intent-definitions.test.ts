import { describe, expect, it } from 'vitest';
import { INTENT_DEFINITIONS } from '../intent-definitions';

describe('INTENT_DEFINITIONS', () => {
  it('has definitions for all expected intents', () => {
    const intents = INTENT_DEFINITIONS.map((d) => d.intent);
    expect(intents).toContain('lights.control');
    expect(intents).toContain('lights.toggle');
    expect(intents).toContain('music.play');
    expect(intents).toContain('music.control');
  });

  it('each definition has at least 5 examples', () => {
    for (const def of INTENT_DEFINITIONS) {
      expect(def.examples.length, `${def.intent} has too few examples`).toBeGreaterThanOrEqual(5);
    }
  });

  describe('lights.control includes conversational wrappers', () => {
    const lightsDef = INTENT_DEFINITIONS.find((d) => d.intent === 'lights.control');

    it('has examples with polite preambles', () => {
      const examples = lightsDef?.examples ?? [];
      const hasCanYou = examples.some((e) => /^can you /i.test(e));
      const hasHey = examples.some((e) => /^hey /i.test(e));
      expect(hasCanYou, "missing 'can you...' example").toBe(true);
      expect(hasHey, "missing 'hey...' example").toBe(true);
    });

    it("has examples without the word 'lights'", () => {
      const examples = lightsDef?.examples ?? [];
      const withoutLights = examples.filter((e) => !/lights/i.test(e));
      // At least 3 examples like "turn off the office", "shut off the kitchen"
      expect(withoutLights.length, "need examples without 'lights' keyword").toBeGreaterThanOrEqual(3);
    });
  });

  describe('music.play includes conversational wrappers', () => {
    const musicDef = INTENT_DEFINITIONS.find((d) => d.intent === 'music.play');

    it('has examples with polite preambles', () => {
      const examples = musicDef?.examples ?? [];
      const hasCanYou = examples.some((e) => /^can you /i.test(e));
      expect(hasCanYou, "missing 'can you...' example for music.play").toBe(true);
    });
  });
});
