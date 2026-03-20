import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../settings-schema';

describe('settingsSchema', () => {
  it('exports a settings schema object', () => {
    expect(settingsSchema).toBeDefined();
    expect(typeof settingsSchema).toBe('object');
  });

  it('schema has a toFieldArray method', () => {
    expect(typeof settingsSchema.toFieldArray).toBe('function');
  });

  it('toFieldArray returns an array of field definitions', () => {
    const fields = settingsSchema.toFieldArray();
    expect(Array.isArray(fields)).toBe(true);
    expect(fields.length).toBe(5);
  });

  it('includes defaultTimeout field with correct properties', () => {
    const fields = settingsSchema.toFieldArray();
    const defaultTimeout = fields.find((f) => f.name === 'defaultTimeout');
    expect(defaultTimeout).toBeDefined();
    expect(defaultTimeout?.type).toBe('number');
    expect(defaultTimeout?.label).toBe('Default Timeout (seconds)');
    expect(defaultTimeout?.default).toBe(30);
  });

  it('includes maxOutputLength field with correct properties', () => {
    const fields = settingsSchema.toFieldArray();
    const maxOutputLength = fields.find((f) => f.name === 'maxOutputLength');
    expect(maxOutputLength).toBeDefined();
    expect(maxOutputLength?.type).toBe('number');
    expect(maxOutputLength?.label).toBe('Max Output Length (bytes)');
    expect(maxOutputLength?.default).toBe(50000);
  });

  it('includes logCommands field with correct properties', () => {
    const fields = settingsSchema.toFieldArray();
    const logCommands = fields.find((f) => f.name === 'logCommands');
    expect(logCommands).toBeDefined();
    expect(logCommands?.type).toBe('boolean');
    expect(logCommands?.label).toBe('Log Commands');
    expect(logCommands?.default).toBe(true);
  });

  it('all fields have a name property', () => {
    const fields = settingsSchema.toFieldArray();
    for (const field of fields) {
      expect(field.name).toBeTruthy();
    }
  });

  it('all fields have a type property', () => {
    const fields = settingsSchema.toFieldArray();
    for (const field of fields) {
      expect(field.type).toBeTruthy();
    }
  });
});
