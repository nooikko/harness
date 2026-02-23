import { describe, expect, it } from 'vitest';
import { validatePluginExport } from '../validate-plugin';

const makeValidPlugin = () => ({
  name: 'test-plugin',
  version: '1.0.0',
  register: async () => ({}),
});

describe('validatePluginExport', () => {
  describe('valid plugin exports', () => {
    it('validates a valid plugin with default export', () => {
      const plugin = makeValidPlugin();
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.definition).toBe(plugin);
      }
    });

    it('validates a valid plugin with named plugin export', () => {
      const plugin = makeValidPlugin();
      const result = validatePluginExport({ plugin }, '/path/to/plugin');

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.definition).toBe(plugin);
      }
    });

    it('prefers default export over named plugin export when both are present', () => {
      const defaultPlugin = makeValidPlugin();
      const namedPlugin = { ...makeValidPlugin(), name: 'named-plugin' };
      const result = validatePluginExport({ default: defaultPlugin, plugin: namedPlugin }, '/path/to/plugin');

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.definition).toBe(defaultPlugin);
      }
    });

    it('allows a valid plugin with no start or stop (optional fields)', () => {
      const plugin = makeValidPlugin();
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(true);
    });

    it('allows a valid plugin with start and stop functions defined', () => {
      const plugin = {
        ...makeValidPlugin(),
        start: async () => {},
        stop: async () => {},
      };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(true);
    });
  });

  describe('missing or no plugin export', () => {
    it('rejects a module with no default or plugin export', () => {
      const result = validatePluginExport({}, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('No valid plugin export found. Expected a default export or named "plugin" export.');
        expect(result.errors[0]).toContain('/path/to/plugin');
      }
    });

    it('rejects a module where the export is not an object', () => {
      const result = validatePluginExport({ default: 'not-an-object' }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain('No valid plugin export found');
      }
    });

    it('rejects a module where the export is null', () => {
      const result = validatePluginExport({ default: null }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0]).toContain('No valid plugin export found');
      }
    });
  });

  describe('invalid name field', () => {
    it('rejects plugin with missing name', () => {
      const plugin = { version: '1.0.0', register: async () => ({}) };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "name" (expected non-empty string).');
      }
    });

    it('rejects plugin with empty name string', () => {
      const plugin = { name: '   ', version: '1.0.0', register: async () => ({}) };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "name" (expected non-empty string).');
      }
    });

    it('rejects plugin with non-string name', () => {
      const plugin = { name: 42, version: '1.0.0', register: async () => ({}) };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "name" (expected non-empty string).');
      }
    });
  });

  describe('invalid version field', () => {
    it('rejects plugin with missing version', () => {
      const plugin = { name: 'test-plugin', register: async () => ({}) };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "version" (expected non-empty string).');
      }
    });

    it('rejects plugin with empty version string', () => {
      const plugin = { name: 'test-plugin', version: '', register: async () => ({}) };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "version" (expected non-empty string).');
      }
    });
  });

  describe('invalid register field', () => {
    it('rejects plugin with missing register function', () => {
      const plugin = { name: 'test-plugin', version: '1.0.0' };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "register" (expected function).');
      }
    });

    it('rejects plugin where register is not a function', () => {
      const plugin = { name: 'test-plugin', version: '1.0.0', register: 'not-a-fn' };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "register" (expected function).');
      }
    });
  });

  describe('optional start and stop fields', () => {
    it('rejects plugin with invalid start (not a function)', () => {
      const plugin = { ...makeValidPlugin(), start: 'not-a-function' };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Invalid "start" (expected function or undefined).');
      }
    });

    it('rejects plugin with invalid stop (not a function)', () => {
      const plugin = { ...makeValidPlugin(), stop: 123 };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Invalid "stop" (expected function or undefined).');
      }
    });
  });

  describe('error accumulation', () => {
    it('collects multiple errors at once for a plugin missing several required fields', () => {
      const plugin = {};
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "name" (expected non-empty string).');
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "version" (expected non-empty string).');
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "register" (expected function).');
      }
    });

    it('collects errors for invalid start and stop alongside missing name', () => {
      const plugin = {
        version: '1.0.0',
        register: async () => ({}),
        start: 'bad-start',
        stop: 99,
      };
      const result = validatePluginExport({ default: plugin }, '/path/to/plugin');

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain('/path/to/plugin: Missing or invalid "name" (expected non-empty string).');
        expect(result.errors).toContain('/path/to/plugin: Invalid "start" (expected function or undefined).');
        expect(result.errors).toContain('/path/to/plugin: Invalid "stop" (expected function or undefined).');
      }
    });

    it('includes the module path in all error messages', () => {
      const plugin = {};
      const modulePath = '/custom/module/path';
      const result = validatePluginExport({ default: plugin }, modulePath);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        for (const error of result.errors) {
          expect(error).toContain(modulePath);
        }
      }
    });
  });
});
