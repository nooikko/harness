import { z } from 'zod';

const CharacterExtractionSchema = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().min(1),
  fields: z.record(z.string(), z.string()).default({}),
});

const CharacterInMomentExtractionSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  perspective: z.string().optional(),
  emotionalImpact: z.string().optional(),
  knowledgeGained: z.string().optional(),
});

const MomentExtractionSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  storyTime: z.string().optional(),
  storyDay: z.number().int().positive().nullable().optional(),
  locationId: z.string().optional(),
  newLocationName: z.string().optional(),
  newLocationDescription: z.string().optional(),
  kind: z.string().min(1),
  importance: z.number().int().min(1).max(10),
  characters: z.array(CharacterInMomentExtractionSchema).default([]),
});

const LocationExtractionSchema = z.object({
  action: z.enum(['create', 'update']),
  name: z.string().min(1),
  description: z.string().optional(),
  parentName: z.string().optional(),
});

const SceneExtractionSchema = z.object({
  characters: z.array(z.string()),
  location: z.string().nullable(),
  storyTime: z.string().nullable(),
});

const AliasExtractionSchema = z.object({
  alias: z.string().min(1),
  resolvedName: z.string().min(1),
});

const EventExtractionSchema = z.object({
  what: z.string().min(1),
  targetDay: z.number().int().positive().nullable().default(null),
  createdByCharacter: z.string().nullable().default(null),
  knownBy: z.array(z.string()).default([]),
});

const TimelineExtractionSchema = z.object({
  currentDay: z.number().int().positive().nullable().default(null),
  dayTransition: z.boolean().default(false),
  timeOfDay: z.string().nullable().default(null),
  events: z.array(EventExtractionSchema).default([]),
});

const ExtractionResultSchema = z.object({
  characters: z.array(CharacterExtractionSchema).default([]),
  moments: z.array(MomentExtractionSchema).default([]),
  locations: z.array(LocationExtractionSchema).default([]),
  scene: SceneExtractionSchema.nullable().default(null),
  aliases: z.array(AliasExtractionSchema).default([]),
  timeline: TimelineExtractionSchema.default({ currentDay: null, dayTransition: false, timeOfDay: null, events: [] }),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

type ExtractJson = (text: string) => string;
const extractJson: ExtractJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in response');
  }
  return text.slice(start, end + 1);
};

type ParseExtractionResult = (raw: string) => ExtractionResult | null;

export const parseExtractionResult: ParseExtractionResult = (raw) => {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr);
    return ExtractionResultSchema.parse(parsed);
  } catch {
    return null;
  }
};
