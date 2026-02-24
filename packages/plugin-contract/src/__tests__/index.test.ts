import { describe, expect, it } from 'vitest';
import { runChainHook, runHook, runHookWithResult } from '../index';

describe('plugin-contract exports', () => {
  it('exports runHook function', () => {
    expect(typeof runHook).toBe('function');
  });

  it('exports runChainHook function', () => {
    expect(typeof runChainHook).toBe('function');
  });

  it('exports runHookWithResult function', () => {
    expect(typeof runHookWithResult).toBe('function');
  });
});
