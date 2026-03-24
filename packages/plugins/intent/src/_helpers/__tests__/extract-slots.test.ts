import { describe, expect, it } from 'vitest';
import { extractSlots } from '../extract-slots';

describe('extractSlots', () => {
  describe('lights.control intent', () => {
    it("extracts room and action for 'turn on the office lights'", () => {
      const result = extractSlots('turn on the office lights', 'lights.control');
      expect(result).toEqual({ room: 'office', action: 'on' });
    });

    it("extracts room and action for 'turn off the bedroom lights'", () => {
      const result = extractSlots('turn off the bedroom lights', 'lights.control');
      expect(result).toEqual({ room: 'bedroom', action: 'off' });
    });

    it('extracts color when present', () => {
      const result = extractSlots('set the office lights to red', 'lights.control');
      expect(result).toEqual({ room: 'office', action: 'on', color: 'red' });
    });

    it('handles brightness percentage', () => {
      const result = extractSlots('set office lights to 50%', 'lights.control');
      expect(result).toEqual({ room: 'office', action: 'on', brightness: 50 });
    });

    it('defaults action to toggle when ambiguous', () => {
      const result = extractSlots('the office lights', 'lights.control');
      expect(result).toEqual({ room: 'office', action: 'toggle' });
    });

    it("handles 'shut down' as off", () => {
      const result = extractSlots('shut down the office', 'lights.control');
      expect(result).toEqual({ room: 'office', action: 'off' });
    });

    it("handles 'dim' as brightness action", () => {
      const result = extractSlots('dim the bedroom lights', 'lights.control');
      expect(result).toEqual({ room: 'bedroom', action: 'on', brightness: 30 });
    });

    it('returns null room when no room is recognized', () => {
      const result = extractSlots('turn on the lights', 'lights.control');
      expect(result).toEqual({ action: 'on' });
    });
  });

  describe('music.play intent', () => {
    it('extracts query from play command', () => {
      const result = extractSlots('play some jazz', 'music.play');
      expect(result).toEqual({ query: 'jazz' });
    });

    it("extracts query from 'put on' phrasing", () => {
      const result = extractSlots('put on lofi beats', 'music.play');
      expect(result).toEqual({ query: 'lofi beats' });
    });

    it("handles 'play music' with no specific query", () => {
      const result = extractSlots('play music', 'music.play');
      expect(result).toEqual({});
    });
  });

  describe('music.control intent', () => {
    it('extracts pause action', () => {
      const result = extractSlots('pause the music', 'music.control');
      expect(result).toEqual({ action: 'pause' });
    });

    it('extracts resume action', () => {
      const result = extractSlots('resume playback', 'music.control');
      expect(result).toEqual({ action: 'resume' });
    });

    it('extracts stop action', () => {
      const result = extractSlots('stop the music', 'music.control');
      expect(result).toEqual({ action: 'stop' });
    });

    it('extracts skip action', () => {
      const result = extractSlots('skip this song', 'music.control');
      expect(result).toEqual({ action: 'skip' });
    });

    it('extracts volume level', () => {
      const result = extractSlots('set volume to 75', 'music.control');
      expect(result).toEqual({ action: 'volume', level: 75 });
    });
  });

  describe('unknown intent', () => {
    it('returns empty slots for unknown intents', () => {
      const result = extractSlots('do something random', 'unknown');
      expect(result).toEqual({});
    });
  });
});
