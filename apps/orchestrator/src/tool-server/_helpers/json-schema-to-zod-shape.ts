import { type ZodTypeAny, z } from 'zod';

type JsonSchemaProperty = {
  type?: string;
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
          base = z.string();
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
        default:
          // NOTE: z.unknown() accepts any value including undefined, so required fields
          // of complex types (object, array) will pass validation even when absent.
          // Full JSON Schema support (nested objects, arrays, enums) is out of scope here.
          base = z.unknown();
          break;
      }

      return [key, required.includes(key) ? base : base.optional()];
    }),
  );
};
