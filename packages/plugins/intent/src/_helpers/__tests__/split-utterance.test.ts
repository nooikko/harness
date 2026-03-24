import { describe, expect, it } from 'vitest';
import { splitUtterance } from '../split-utterance';

describe('splitUtterance', () => {
  it('returns a single part for simple utterances', () => {
    expect(splitUtterance('turn on the office lights')).toEqual(['turn on the office lights']);
  });

  it("splits on 'and' conjunction", () => {
    expect(splitUtterance('turn on the lights and play some jazz')).toEqual(['turn on the lights', 'play some jazz']);
  });

  it("splits on 'then' conjunction", () => {
    expect(splitUtterance('turn off the bedroom lights then play lofi')).toEqual(['turn off the bedroom lights', 'play lofi']);
  });

  it("splits on 'also' conjunction", () => {
    expect(splitUtterance('set the office to red also play a song')).toEqual(['set the office to red', 'play a song']);
  });

  it('handles multiple conjunctions', () => {
    expect(splitUtterance('turn on the lights and set them to blue and play jazz')).toEqual(['turn on the lights', 'set them to blue', 'play jazz']);
  });

  it('trims whitespace from parts', () => {
    expect(splitUtterance('  turn on lights   and   play music  ')).toEqual(['turn on lights', 'play music']);
  });

  it('filters out empty parts', () => {
    expect(splitUtterance('and play music')).toEqual(['play music']);
  });

  it('is case insensitive for conjunctions', () => {
    expect(splitUtterance('turn on lights AND play music')).toEqual(['turn on lights', 'play music']);
  });

  it("does not split 'and' inside words like 'brand' or 'android'", () => {
    expect(splitUtterance('play brand new song')).toEqual(['play brand new song']);
  });

  it("does not split 'and' inside 'stand' or 'command'", () => {
    expect(splitUtterance('turn on the command center')).toEqual(['turn on the command center']);
  });

  it("handles 'can you' prefix naturally", () => {
    expect(splitUtterance('can you turn on the office lights and play jazz')).toEqual(['can you turn on the office lights', 'play jazz']);
  });
});
