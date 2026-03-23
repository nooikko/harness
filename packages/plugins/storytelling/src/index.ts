import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { buildCastInjection } from './_helpers/build-cast-injection';
import { detectOocMessage } from './_helpers/detect-ooc-message';
import { extractStoryState } from './_helpers/extract-story-state';
import { formatStorytellingInstructions } from './_helpers/format-storytelling-instructions';
import { handleOocCommand } from './_helpers/handle-ooc-command';
import { parseOocCommand } from './_helpers/parse-ooc-command';
import { resolveStoryId } from './_helpers/resolve-story-id';
import { handleAddLocation } from './_helpers/tool-add-location';
import { handleAdvanceTime } from './_helpers/tool-advance-time';
import { handleAnnotateMoment } from './_helpers/tool-annotate-moment';
import { handleCharacterKnowledge } from './_helpers/tool-character-knowledge';
import { handleCorrectMoment } from './_helpers/tool-correct-moment';
import { handleCreateArc } from './_helpers/tool-create-arc';
import { handleDetectDuplicates } from './_helpers/tool-detect-duplicates';
import { handleDiscoverArcMoments } from './_helpers/tool-discover-arc-moments';
import { handleGetCharacter } from './_helpers/tool-get-character';
import { handleImportCharacters } from './_helpers/tool-import-characters';
import { handleImportDocument } from './_helpers/tool-import-document';
import { handleImportTranscript } from './_helpers/tool-import-transcript';
import { handleMergeMoments } from './_helpers/tool-merge-moments';
import { handleRecordMoment } from './_helpers/tool-record-moment';
import { handleRestoreMoment } from './_helpers/tool-restore-moment';
import { handleUpdateCharacter } from './_helpers/tool-update-character';
import { wrapOocContent } from './_helpers/wrap-ooc-content';

const DEDUP_GUARD_MS = 60_000;

const storyCache = new Map<string, string | null>();
const handledOocCommands = new Map<string, string>(); // threadId → summary of handled command
const lastExtractionAt = new Map<string, number>(); // storyId → timestamp of last extraction

/** @internal Test-only: clears module-level caches between test runs */
export const _resetCaches = (): void => {
  storyCache.clear();
  handledOocCommands.clear();
  lastExtractionAt.clear();
};

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Storytelling plugin registered');

    return {
      onMessage: async (threadId, _role, content) => {
        // storyCache may be empty on the first message (onMessage runs before onBeforeInvoke).
        // Fall back to a DB lookup so the first OOC command in a thread is not silently dropped.
        let storyId = storyCache.get(threadId);
        if (storyId === undefined) {
          const thread = await ctx.db.thread.findUnique({
            where: { id: threadId },
            select: { storyId: true },
          });
          storyId = thread?.storyId ?? null;
          storyCache.set(threadId, storyId);
        }
        if (!storyId) {
          return;
        }

        const ooc = detectOocMessage(content);
        if (!ooc.isOoc) {
          return;
        }

        const command = parseOocCommand(ooc.content);
        if (command.type === 'unknown') {
          return;
        }

        try {
          const summary = await handleOocCommand(command, ctx.db as unknown as Parameters<typeof handleOocCommand>[1], storyId);
          if (summary) {
            handledOocCommands.set(threadId, summary);
          }
        } catch (err) {
          ctx.logger.warn('storytelling: OOC command handling failed', {
            threadId,
            command: command.type,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },

      onBeforeInvoke: async (threadId, prompt) => {
        const thread = await ctx.db.thread.findUnique({
          where: { id: threadId },
          select: { kind: true, storyId: true },
        });

        // Cache storyId for onAfterInvoke
        storyCache.set(threadId, thread?.storyId ?? null);

        if (thread?.kind !== 'storytelling' && thread?.kind !== 'story-import') {
          return prompt;
        }

        // Import threads get tools, not fiction instructions
        if (thread.kind === 'story-import') {
          storyCache.set(threadId, thread.storyId ?? null);
          return prompt;
        }

        // Inject cast sheet if this thread belongs to a story
        let castInjection = '';
        if (thread.storyId) {
          const story = await ctx.db.story.findUnique({
            where: { id: thread.storyId },
            select: { currentScene: true },
          });
          // Safely extract currentScene — it's a JSON field that may not match the expected shape
          const raw = story?.currentScene;
          const currentScene =
            raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { characters?: string[]; locationName?: string }) : null;
          castInjection = await buildCastInjection(thread.storyId, currentScene, ctx.db);
        }

        const latestUserMessage = await ctx.db.message.findFirst({
          where: { threadId, role: 'user' },
          orderBy: { createdAt: 'desc' },
          select: { content: true },
        });

        let modifiedPrompt = prompt;

        // Check if onMessage already handled an OOC command for this thread
        const commandSummary = handledOocCommands.get(threadId);
        if (commandSummary) {
          handledOocCommands.delete(threadId);
          modifiedPrompt = `${modifiedPrompt}\n\n[Author direction: ${commandSummary}. Continue the story.]`;
        } else if (latestUserMessage?.content) {
          const oocResult = detectOocMessage(latestUserMessage.content);
          if (oocResult.isOoc) {
            const wrapped = wrapOocContent(oocResult.content);
            modifiedPrompt = `${modifiedPrompt}\n\n${wrapped}`;
          }
        }

        if (castInjection) {
          modifiedPrompt = `${castInjection}\n\n${modifiedPrompt}`;
        }

        const instructions = formatStorytellingInstructions();
        modifiedPrompt = `${modifiedPrompt}\n\n${instructions}`;

        return modifiedPrompt;
      },

      onAfterInvoke: async (threadId, result) => {
        const storyId = storyCache.get(threadId);
        if (!storyId) {
          return;
        }

        // 60-second dedup guard — uses in-memory timestamp, not story.updatedAt
        // (story.updatedAt is bumped by tool calls like advance_time, which would falsely skip extraction)
        const lastExtraction = lastExtractionAt.get(storyId) ?? 0;
        if (Date.now() - lastExtraction < DEDUP_GUARD_MS) {
          return;
        }

        try {
          lastExtractionAt.set(storyId, Date.now());
          await extractStoryState(ctx, storyId, threadId, result.output);
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          ctx.logger.error('storytelling: extraction failed', {
            storyId,
            threadId,
            error: e.message,
            stack: e.stack,
          });
        }
      },
    };
  };

  return register;
};

const storytellingTools: PluginTool[] = [
  {
    name: 'update_character',
    description:
      'Update a single field on a story character (appearance, personality, mannerisms, motives, backstory, relationships, status, or color).',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Character name (case-insensitive match)' },
        field: {
          type: 'string',
          description: 'Field to update',
          enum: ['appearance', 'personality', 'mannerisms', 'motives', 'backstory', 'relationships', 'status', 'color'],
        },
        value: { type: 'string', description: 'New value for the field' },
      },
      required: ['name', 'field', 'value'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = storyCache.get(meta.threadId);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleUpdateCharacter(ctx.db, storyId, input as { name: string; field: string; value: string });
    },
  },
  {
    name: 'record_moment',
    description: 'Record a significant story moment with character perspectives and knowledge tracking.',
    schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Brief summary of the moment' },
        description: { type: 'string', description: 'Detailed description (optional)' },
        storyTime: { type: 'string', description: 'In-story time when this moment occurs (optional)' },
        locationName: { type: 'string', description: 'Location name — resolved or auto-created (optional)' },
        kind: { type: 'string', description: 'Moment kind (e.g. dialogue, action, revelation, decision)' },
        importance: { type: 'number', description: 'Importance 1-10' },
        characters: {
          type: 'array',
          description: 'Characters involved in this moment',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Character name' },
              role: { type: 'string', description: 'Role in this moment (e.g. protagonist, witness, antagonist)' },
              perspective: { type: 'string', description: 'Character perspective on this moment (optional)' },
              emotionalImpact: { type: 'string', description: 'Emotional impact on this character (optional)' },
              knowledgeGained: { type: 'string', description: 'What this character learned (optional)' },
            },
            required: ['name', 'role'],
          },
        },
      },
      required: ['summary', 'kind', 'importance', 'characters'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = storyCache.get(meta.threadId);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleRecordMoment(
        ctx.db,
        storyId,
        input as {
          summary: string;
          description?: string;
          storyTime?: string;
          locationName?: string;
          kind: string;
          importance: number;
          characters: { name: string; role: string; perspective?: string; emotionalImpact?: string; knowledgeGained?: string }[];
        },
      );
    },
  },
  {
    name: 'advance_time',
    description: 'Advance the in-story time to a new value.',
    schema: {
      type: 'object',
      properties: {
        storyTime: { type: 'string', description: 'The new story time (e.g. "Dawn, Day 3" or "Three weeks later")' },
      },
      required: ['storyTime'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = storyCache.get(meta.threadId);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleAdvanceTime(ctx.db, storyId, input as { storyTime: string });
    },
  },
  {
    name: 'add_location',
    description: 'Add a new location to the story world. Optionally nest under a parent location with distance/direction.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Location name' },
        description: { type: 'string', description: 'Location description (optional)' },
        parentName: { type: 'string', description: 'Parent location name for containment (optional)' },
        distance: { type: 'string', description: 'Distance from parent (e.g. "2 miles") (optional)' },
        direction: { type: 'string', description: 'Direction from parent (e.g. "north") (optional)' },
      },
      required: ['name'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = storyCache.get(meta.threadId);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleAddLocation(
        ctx.db,
        storyId,
        input as { name: string; description?: string; parentName?: string; distance?: string; direction?: string },
      );
    },
  },
  {
    name: 'character_knowledge',
    description: 'Get what a character knows and does not know based on their moment participation.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Character name (case-insensitive match)' },
      },
      required: ['name'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = storyCache.get(meta.threadId);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleCharacterKnowledge(ctx.db, storyId, input as { name: string });
    },
  },
  {
    name: 'get_character',
    description: 'Get a full character profile including appearance, personality, moments, and knowledge state.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Character name (case-insensitive match)' },
      },
      required: ['name'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = storyCache.get(meta.threadId);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleGetCharacter(ctx.db, storyId, input as { name: string });
    },
  },
  {
    name: 'import_characters',
    description: 'Bulk-import character profiles from pasted text. Uses Sonnet for high-fidelity extraction.',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text containing character profiles (any format — the AI will parse it)' },
      },
      required: ['text'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleImportCharacters(ctx, storyId, input as { text: string });
    },
  },
  {
    name: 'import_document',
    description:
      'Process a summary document to extract moments, locations, and character developments. Stores the document and extracts at emotional-beat granularity.',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The summary document text to process' },
        label: { type: 'string', description: 'Label for this document (e.g., "Days 1-3", "Day 10 Part 1")' },
      },
      required: ['text'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleImportDocument(ctx, storyId, input as { text: string; label?: string });
    },
  },
  {
    name: 'import_transcript',
    description: 'Process a stored Claude.ai transcript. The transcript must be stored first via the web UI. Supports resume on failure.',
    schema: {
      type: 'object',
      properties: {
        transcriptId: {
          type: 'string',
          description: 'ID of a StoryTranscript record already stored in the database',
        },
      },
      required: ['transcriptId'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleImportTranscript(ctx, storyId, input as { transcriptId: string });
    },
  },
  {
    name: 'detect_duplicates',
    description: 'Scan moments for duplicates and drift — events that appear to describe the same thing. Auto-paginates for large moment sets.',
    schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'Optional: "all", a character name, or a storyTime range. Defaults to paginated full scan.',
        },
      },
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleDetectDuplicates(ctx, storyId, input as { scope?: string });
    },
  },
  {
    name: 'merge_moments',
    description:
      'Merge two duplicate moments. Soft-deletes the discarded one (recoverable via restore_moment). Transfers perspectives and reassigns arc links.',
    schema: {
      type: 'object',
      properties: {
        keepId: { type: 'string', description: 'ID of the moment to keep (canonical version)' },
        discardId: { type: 'string', description: 'ID of the moment to discard (drift/duplicate)' },
        transferPerspectives: { type: 'boolean', description: 'Transfer character perspectives from discarded to kept (default: true)' },
      },
      required: ['keepId', 'discardId'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleMergeMoments(ctx, storyId, input as { keepId: string; discardId: string; transferPerspectives?: boolean });
    },
  },
  {
    name: 'restore_moment',
    description: 'Restore a soft-deleted moment (undo a merge). Transferred perspectives are NOT reversed.',
    schema: {
      type: 'object',
      properties: {
        momentId: { type: 'string', description: 'ID of the deleted moment to restore' },
      },
      required: ['momentId'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleRestoreMoment(ctx, storyId, input as { momentId: string });
    },
  },
  {
    name: 'correct_moment',
    description: 'Fix specific details on a moment — update fields, remove phantom characters, add missing characters.',
    schema: {
      type: 'object',
      properties: {
        momentId: { type: 'string', description: 'ID of the moment to correct' },
        corrections: {
          type: 'object',
          description: 'Field corrections (summary, description, storyTime, kind, importance, annotation)',
        },
        removeCharacters: {
          type: 'array',
          items: { type: 'string' },
          description: 'Character names to remove from this moment (phantom characters)',
        },
        addCharacters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
            },
            required: ['name', 'role'],
          },
          description: 'Characters to add to this moment',
        },
      },
      required: ['momentId'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleCorrectMoment(
        ctx,
        storyId,
        input as {
          momentId: string;
          corrections?: Record<string, string | number>;
          removeCharacters?: string[];
          addCharacters?: { name: string; role: string }[];
        },
      );
    },
  },
  {
    name: 'create_arc',
    description: 'Create a named story arc and optionally seed it with moments. Arcs connect related moments across time.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Arc name (e.g., "Suki\'s Mother", "The Team Learning Trust")' },
        description: { type: 'string', description: 'What this arc is about' },
        momentIds: { type: 'array', items: { type: 'string' }, description: 'Moment IDs to seed the arc with' },
        annotation: { type: 'string', description: 'User notes on why this arc matters' },
      },
      required: ['name'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleCreateArc(ctx, storyId, input as { name: string; description?: string; momentIds?: string[]; annotation?: string });
    },
  },
  {
    name: 'discover_arc_moments',
    description: 'Search extracted moments for ones related to a story arc. Seeds the arc with examples first, then run this to find more.',
    schema: {
      type: 'object',
      properties: {
        arcId: { type: 'string', description: 'ID of the arc to expand' },
        guidance: { type: 'string', description: 'Optional guidance for the search (e.g., "look for references to her mother")' },
        deepScan: {
          type: 'boolean',
          description: 'If true, also scan raw transcripts (slow — 20-45 min). Default: false (fast search of extracted moments only).',
        },
      },
      required: ['arcId'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleDiscoverArcMoments(ctx, storyId, input as { arcId: string; guidance?: string; deepScan?: boolean });
    },
  },
  {
    name: 'annotate_moment',
    description: 'Add a user annotation to a moment and/or link it to story arcs by name.',
    schema: {
      type: 'object',
      properties: {
        momentId: { type: 'string', description: 'ID of the moment to annotate' },
        annotation: { type: 'string', description: 'User notes on this moment' },
        arcNames: { type: 'array', items: { type: 'string' }, description: 'Arc names to link this moment to' },
      },
      required: ['momentId'],
    },
    handler: async (ctx, input, meta) => {
      const storyId = await resolveStoryId(meta.threadId, storyCache, ctx.db as never);
      if (!storyId) {
        return 'This thread is not part of a story.';
      }
      return handleAnnotateMoment(ctx, storyId, input as { momentId: string; annotation?: string; arcNames?: string[] });
    },
  },
];

export const plugin: PluginDefinition = {
  name: 'storytelling',
  version: '1.0.0',
  register: createRegister(),
  start: async (ctx) => {
    // Ensure Qdrant collection exists for character similarity search
    const { ensureCharacterCollection } = await import('./_helpers/ensure-character-collection.js');
    const ready = await ensureCharacterCollection();
    if (ready) {
      ctx.logger.info('storytelling: character similarity collection ready');

      // Backfill existing characters that aren't indexed yet
      const { indexCharacter } = await import('./_helpers/index-character.js');
      const characters = await ctx.db.storyCharacter.findMany({
        select: { id: true, name: true, personality: true, storyId: true },
        take: 500,
      });

      for (const char of characters) {
        indexCharacter(
          (char as { id: string }).id,
          (char as { name: string }).name,
          (char as { personality?: string }).personality ?? '',
          (char as { storyId: string }).storyId,
        ).catch((err) => {
          ctx.logger.warn(
            `storytelling: failed to index character ${(char as { name: string }).name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
      ctx.logger.info(`storytelling: backfilling ${characters.length} characters into Qdrant`);
    } else {
      ctx.logger.info('storytelling: Qdrant unavailable, character similarity disabled');
    }
  },
  stop: async () => {
    storyCache.clear();
    handledOocCommands.clear();
    lastExtractionAt.clear();
  },
  tools: storytellingTools,
};
