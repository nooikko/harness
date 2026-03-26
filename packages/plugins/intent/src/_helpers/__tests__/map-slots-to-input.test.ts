import { describe, expect, it } from 'vitest';
import { mapSlotsToInput, resolveMusicTool } from '../map-slots-to-input';

describe('mapSlotsToInput', () => {
  describe('lights.control', () => {
    it('maps room to device and on action to state', () => {
      expect(mapSlotsToInput('lights.control', 'set_light', { room: 'office', action: 'on' })).toEqual({
        device: 'office',
        on: true,
      });
    });

    it('maps off action to state off', () => {
      expect(mapSlotsToInput('lights.control', 'set_light', { room: 'bedroom', action: 'off' })).toEqual({
        device: 'bedroom',
        on: false,
      });
    });

    it('includes color when present', () => {
      expect(mapSlotsToInput('lights.control', 'set_light', { room: 'office', action: 'on', color: 'red' })).toEqual({
        device: 'office',
        on: true,
        color: 'red',
      });
    });

    it('includes brightness when present', () => {
      expect(mapSlotsToInput('lights.control', 'set_light', { room: 'office', action: 'on', brightness: 50 })).toEqual({
        device: 'office',
        on: true,
        brightness: 50,
      });
    });

    it('omits device when no room', () => {
      expect(mapSlotsToInput('lights.control', 'set_light', { action: 'on' })).toEqual({ on: true });
    });

    it('handles toggle action (no state)', () => {
      expect(mapSlotsToInput('lights.control', 'set_light', { room: 'office', action: 'toggle' })).toEqual({
        device: 'office',
      });
    });
  });

  describe('lights.toggle', () => {
    it('maps room to device', () => {
      expect(mapSlotsToInput('lights.toggle', 'toggle_light', { room: 'office' })).toEqual({ device: 'office' });
    });

    it('returns empty when no room', () => {
      expect(mapSlotsToInput('lights.toggle', 'toggle_light', {})).toEqual({});
    });
  });

  describe('music.play', () => {
    it('maps query', () => {
      expect(mapSlotsToInput('music.play', 'play', { query: 'jazz' })).toEqual({ query: 'jazz' });
    });

    it('returns empty when no query', () => {
      expect(mapSlotsToInput('music.play', 'play', {})).toEqual({});
    });
  });

  describe('music.control', () => {
    it('maps volume action with level', () => {
      expect(mapSlotsToInput('music.control', 'set_volume', { action: 'volume', level: 75 })).toEqual({ volume: 75 });
    });

    it('returns empty for non-volume actions', () => {
      expect(mapSlotsToInput('music.control', 'pause', { action: 'pause' })).toEqual({});
    });
  });

  describe('unknown intent', () => {
    it('passes through slots as-is', () => {
      expect(mapSlotsToInput('unknown', 'tool', { foo: 'bar' })).toEqual({ foo: 'bar' });
    });
  });
});

describe('resolveMusicTool', () => {
  it('resolves pause', () => {
    expect(resolveMusicTool('pause')).toBe('pause');
  });

  it('resolves resume', () => {
    expect(resolveMusicTool('resume')).toBe('resume');
  });

  it('resolves stop', () => {
    expect(resolveMusicTool('stop')).toBe('stop');
  });

  it('resolves skip', () => {
    expect(resolveMusicTool('skip')).toBe('skip');
  });

  it('resolves volume', () => {
    expect(resolveMusicTool('volume')).toBe('set_volume');
  });

  it('defaults to pause for unknown action', () => {
    expect(resolveMusicTool('unknown')).toBe('pause');
  });
});
