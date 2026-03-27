import { describe, expect, it } from 'vitest';
import { createPluginState } from '../create-plugin-state';

describe('createPluginState', () => {
  it('returns undefined for missing keys', () => {
    const state = createPluginState();
    expect(state.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a value', () => {
    const state = createPluginState();
    state.set('key', 'value');
    expect(state.get('key')).toBe('value');
  });

  it('preserves type parameter on get', () => {
    const state = createPluginState();
    state.set('count', 42);
    const count = state.get<number>('count');
    expect(count).toBe(42);
  });

  it('overwrites existing value on set', () => {
    const state = createPluginState();
    state.set('key', 'first');
    state.set('key', 'second');
    expect(state.get('key')).toBe('second');
  });

  it('stores object references atomically', () => {
    type Connection = { client: string; cache: string };
    const state = createPluginState();

    const conn: Connection = { client: 'c1', cache: 'cache1' };
    state.set('connection', conn);

    const retrieved = state.get<Connection>('connection');
    expect(retrieved).toBe(conn);
    expect(retrieved?.client).toBe('c1');
    expect(retrieved?.cache).toBe('cache1');
  });

  it('has returns true for existing keys', () => {
    const state = createPluginState();
    state.set('present', 'yes');
    expect(state.has('present')).toBe(true);
  });

  it('has returns false for missing keys', () => {
    const state = createPluginState();
    expect(state.has('absent')).toBe(false);
  });

  it('has returns true for keys set to null or undefined', () => {
    const state = createPluginState();
    state.set('nullVal', null);
    state.set('undefVal', undefined);
    expect(state.has('nullVal')).toBe(true);
    expect(state.has('undefVal')).toBe(true);
  });

  it('delete removes a key and returns true', () => {
    const state = createPluginState();
    state.set('key', 'value');
    const result = state.delete('key');
    expect(result).toBe(true);
    expect(state.has('key')).toBe(false);
    expect(state.get('key')).toBeUndefined();
  });

  it('delete returns false for missing key', () => {
    const state = createPluginState();
    expect(state.delete('nonexistent')).toBe(false);
  });

  it('clear removes all entries', () => {
    const state = createPluginState();
    state.set('a', 1);
    state.set('b', 2);
    state.set('c', 3);
    state.clear();
    expect(state.has('a')).toBe(false);
    expect(state.has('b')).toBe(false);
    expect(state.has('c')).toBe(false);
  });

  it('is usable after clear', () => {
    const state = createPluginState();
    state.set('key', 'before');
    state.clear();
    state.set('key', 'after');
    expect(state.get('key')).toBe('after');
  });

  it('atomic replacement pattern — single set replaces entire snapshot', () => {
    type Snapshot = { client: string; limiter: string };
    const state = createPluginState();

    state.set<Snapshot>('conn', { client: 'old', limiter: 'old' });

    // Simulate onSettingsChange: build new snapshot, then atomically replace
    const newSnapshot: Snapshot = { client: 'new', limiter: 'new' };
    state.set('conn', newSnapshot);

    const result = state.get<Snapshot>('conn');
    expect(result?.client).toBe('new');
    expect(result?.limiter).toBe('new');
  });

  it('two containers are fully isolated', () => {
    const stateA = createPluginState();
    const stateB = createPluginState();

    stateA.set('shared-key', 'from-A');
    stateB.set('shared-key', 'from-B');

    expect(stateA.get('shared-key')).toBe('from-A');
    expect(stateB.get('shared-key')).toBe('from-B');

    stateA.clear();
    expect(stateA.has('shared-key')).toBe(false);
    expect(stateB.get('shared-key')).toBe('from-B');
  });
});
