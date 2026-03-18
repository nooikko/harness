import type { PluginContext, PluginDefinition, PluginHooks, PluginTool } from '@harness/plugin-contract';
import { buildCastInjection } from './_helpers/build-cast-injection';
import { detectOocMessage } from './_helpers/detect-ooc-message';
import { extractStoryState } from './_helpers/extract-story-state';
import { formatStorytellingInstructions } from './_helpers/format-storytelling-instructions';
import { handleOocCommand } from './_helpers/handle-ooc-command';
import { parseOocCommand } from './_helpers/parse-ooc-command';
import { handleAddLocation } from './_helpers/tool-add-location';
import { handleAdvanceTime } from './_helpers/tool-advance-time';
import { handleCharacterKnowledge } from './_helpers/tool-character-knowledge';
import { handleGetCharacter } from './_helpers/tool-get-character';
import { handleRecordMoment } from './_helpers/tool-record-moment';
import { handleUpdateCharacter } from './_helpers/tool-update-character';
import { wrapOocContent } from './_helpers/wrap-ooc-content';

const DEDUP_GUARD_MS = 60_000;

const storyCache = new Map<string, string | null>();
const handledOocCommands = new Map<string, string>(); // threadId → summary of handled command

type CreateRegister = () => PluginDefinition['register'];

const createRegister: CreateRegister = () => {
  const register = async (ctx: PluginContext): Promise<PluginHooks> => {
    ctx.logger.info('Storytelling plugin registered');

    return {
      onMessage: async (threadId, _role, content) => {
        const storyId = storyCache.get(threadId);
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
          const summary = await handleOocCommand(command, ctx.db, storyId);
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

        if (thread?.kind !== 'storytelling') {
          return prompt;
        }

        // Inject cast sheet if this thread belongs to a story
        let castInjection = '';
        if (thread.storyId) {
          const story = await ctx.db.story.findUnique({
            where: { id: thread.storyId },
            select: { currentScene: true },
          });
          castInjection = await buildCastInjection(thread.storyId, story?.currentScene ?? null, ctx.db);
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

        // 60-second dedup guard
        const story = await ctx.db.story.findUnique({
          where: { id: storyId },
          select: { updatedAt: true },
        });

        if (story && Date.now() - new Date(story.updatedAt).getTime() < DEDUP_GUARD_MS) {
          return;
        }

        try {
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
];

export const plugin: PluginDefinition = {
  name: 'storytelling',
  version: '1.0.0',
  register: createRegister(),
  tools: storytellingTools,
};
