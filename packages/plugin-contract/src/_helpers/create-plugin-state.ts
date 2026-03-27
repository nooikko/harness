import type { PluginStateContainer } from '../index';

type CreatePluginState = () => PluginStateContainer;

export const createPluginState: CreatePluginState = () => {
  const store = new Map<string, unknown>();

  return {
    get: <T = unknown>(key: string): T | undefined => store.get(key) as T | undefined,
    set: <T = unknown>(key: string, value: T): void => {
      store.set(key, value);
    },
    has: (key: string): boolean => store.has(key),
    delete: (key: string): boolean => store.delete(key),
    clear: (): void => {
      store.clear();
    },
  };
};
