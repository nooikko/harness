import { type ZodTypeAny, z } from 'zod';

type JsonSchemaProperty = {
  type?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
};

type JsonSchemaToZodShape = (schema: Record<string, unknown>) => Record<string, ZodTypeAny>;

export const jsonSchemaToZodShape: JsonSchemaToZodShape = (schema) => {
  const properties = schema.properties as Record<string, JsonSchemaProperty> | undefined;
  const required = (schema.required as string[] | undefined) ?? [];

  if (!properties || Object.keys(properties).length === 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).map(([key, prop]) => {
      let base: ZodTypeAny;

      switch (prop.type) {
        case 'string':
          base = prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string();
          break;
        case 'number':
          base = z.number();
          break;
        case 'integer':
          base = z.number().int();
          break;
        case 'boolean':
          base = z.boolean();
          break;
        case 'object':
          base = z.record(z.string(), z.unknown());
          break;
        case 'array':
          base = z.array(z.unknown());
          break;
        default:
          base = z.unknown();
          break;
      }

      return [key, required.includes(key) ? base : base.optional()];
    }),
  );
};
