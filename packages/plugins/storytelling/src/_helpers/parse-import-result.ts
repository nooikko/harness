import { z } from 'zod';

const ImportCharacterSchema = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().min(1),
  aliases: z.array(z.string()).optional().default([]),
  fields: z.record(z.string(), z.string()).default({}),
});

const ImportCharacterInMomentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  perspective: z.string().optional(),
  emotionalImpact: z.string().optional(),
  knowledgeGained: z.string().optional(),
  relationshipContext: z.string().optional(),
});

const ImportMomentSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  storyTime: z.string().optional(),
  locationId: z.string().optional(),
  newLocationName: z.string().optional(),
  newLocationDescription: z.string().optional(),
  kind: z.string().min(1),
  importance: z.number().int().min(1).max(10),
  driftFlag: z.boolean().optional().default(false),
  driftNote: z.string().optional(),
  characters: z.array(ImportCharacterInMomentSchema).default([]),
});

const ImportLocationSchema = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().min(1),
  description: z.string().optional(),
  parentName: z.string().optional(),
});

const ImportSceneSchema = z.object({
  characters: z.array(z.string()),
  location: z.string().nullable(),
  storyTime: z.string().nullable(),
});

const ImportAliasSchema = z.object({
  alias: z.string().min(1),
  resolvedName: z.string().min(1),
});

const ImportExtractionResultSchema = z.object({
  characters: z.array(ImportCharacterSchema).default([]),
  moments: z.array(ImportMomentSchema).default([]),
  locations: z.array(ImportLocationSchema).default([]),
  scene: ImportSceneSchema.nullable().default(null),
  aliases: z.array(ImportAliasSchema).default([]),
});

export type ImportExtractionResult = z.infer<typeof ImportExtractionResultSchema>;

const ImportCharacterBulkSchema = z.object({
  characters: z.array(ImportCharacterSchema),
});

export type ImportCharacterBulkResult = z.infer<typeof ImportCharacterBulkSchema>;

type ExtractJson = (text: string) => string;

const extractJson: ExtractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in response');
  }
  return text.slice(start, end + 1);
};

type ParseImportExtractionResult = (raw: string) => ImportExtractionResult | null;

export const parseImportExtractionResult: ParseImportExtractionResult = (raw) => {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    return ImportExtractionResultSchema.parse(parsed);
  } catch {
    return null;
  }
};

type ParseImportCharacterResult = (raw: string) => ImportCharacterBulkResult | null;

export const parseImportCharacterResult: ParseImportCharacterResult = (raw) => {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    return ImportCharacterBulkSchema.parse(parsed);
  } catch {
    return null;
  }
};
