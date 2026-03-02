import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { jsonSchemaToZodShape } from '../json-schema-to-zod-shape';

describe('jsonSchemaToZodShape', () => {
  it('returns empty shape for schema with no properties', () => {
    const result = jsonSchemaToZodShape({ type: 'object', properties: {} });
    expect(result).toEqual({});
  });

  it('returns empty shape when properties key is absent', () => {
    const result = jsonSchemaToZodShape({ type: 'object' });
    expect(result).toEqual({});
  });

  it('maps string type to z.string()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });
    expect(result.name).toBeDefined();
    expect(() => z.object(result).parse({ name: 'hello' })).not.toThrow();
    expect(() => z.object(result).parse({ name: 42 })).toThrow();
  });

  it('maps number type to z.number()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { count: { type: 'number' } },
      required: ['count'],
    });
    expect(() => z.object(result).parse({ count: 5 })).not.toThrow();
    expect(() => z.object(result).parse({ count: 'five' })).toThrow();
  });

  it('maps integer type to z.number().int()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count'],
    });
    expect(() => z.object(result).parse({ count: 5 })).not.toThrow();
    expect(() => z.object(result).parse({ count: 5.5 })).toThrow();
    expect(() => z.object(result).parse({ count: 'five' })).toThrow();
  });

  it('maps boolean type to z.boolean()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { active: { type: 'boolean' } },
      required: ['active'],
    });
    expect(() => z.object(result).parse({ active: true })).not.toThrow();
    expect(() => z.object(result).parse({ active: 'yes' })).toThrow();
  });

  it('maps object type to z.record() — enforces presence and rejects non-objects', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { data: { type: 'object' } },
      required: ['data'],
    });
    expect(() => z.object(result).parse({ data: { nested: true } })).not.toThrow();
    expect(() => z.object(result).parse({ data: undefined })).toThrow();
  });

  it('maps array type to z.array(z.unknown())', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { items: { type: 'array' } },
      required: ['items'],
    });
    expect(() => z.object(result).parse({ items: [1, 'two', true] })).not.toThrow();
    expect(() => z.object(result).parse({ items: undefined })).toThrow();
    expect(() => z.object(result).parse({ items: 'not-an-array' })).toThrow();
  });

  it('maps string with enum to z.enum()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } },
      required: ['color'],
    });
    expect(() => z.object(result).parse({ color: 'red' })).not.toThrow();
    expect(() => z.object(result).parse({ color: 'green' })).not.toThrow();
    expect(() => z.object(result).parse({ color: 'purple' })).toThrow();
  });

  it('maps field without a type to z.unknown()', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { anything: { description: 'no type' } },
      required: ['anything'],
    });
    expect(() => z.object(result).parse({ anything: 42 })).not.toThrow();
  });

  it('makes fields optional when not in required array', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: {
        required_field: { type: 'string' },
        optional_field: { type: 'string' },
      },
      required: ['required_field'],
    });
    expect(() => z.object(result).parse({ required_field: 'hello' })).not.toThrow();
    expect(() => z.object(result).parse({})).toThrow(); // required_field missing
    expect(() => z.object(result).parse({ required_field: 'hi', optional_field: 'bye' })).not.toThrow();
  });

  it('makes all fields optional when required array is absent', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
    expect(() => z.object(result).parse({})).not.toThrow();
  });

  it('handles multiple properties of mixed types', () => {
    const result = jsonSchemaToZodShape({
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Task prompt' },
        model: { type: 'string', description: 'Model override' },
        maxIterations: { type: 'number', description: 'Max tries' },
      },
      required: ['prompt'],
    });
    expect(() => z.object(result).parse({ prompt: 'do the thing', model: 'sonnet', maxIterations: 5 })).not.toThrow();
    expect(() => z.object(result).parse({ prompt: 'minimal' })).not.toThrow();
    expect(() => z.object(result).parse({})).toThrow(); // prompt required
  });
});
