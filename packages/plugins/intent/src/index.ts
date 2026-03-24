import type { IntentClassifyResult, PluginContext, PluginDefinition, PluginHooks } from '@harness/plugin-contract';
import { embed, embedSingle } from '@harness/vector-search';
import { extractSlots } from './_helpers/extract-slots';
import { INTENT_DEFINITIONS } from './_helpers/intent-definitions';
import { classifyIntent, createIntentRegistry, type IntentRegistry } from './_helpers/intent-registry';
import { mapSlotsToInput, resolveMusicTool } from './_helpers/map-slots-to-input';
import { routeDecision } from './_helpers/route-decision';
import { splitUtterance } from './_helpers/split-utterance';

let registry: IntentRegistry | null = null;
let pluginCtx: PluginContext | null = null;

const handleIntentClassify = async (threadId: string, content: string): Promise<IntentClassifyResult> => {
  if (!registry || !pluginCtx?.executeTool) {
    return { handled: false };
  }

  const startTime = Date.now();

  // Split compound utterances: "turn on lights and play jazz" → ["turn on lights", "play jazz"]
  const parts = splitUtterance(content);

  // Classify each part independently
  const classifications = await Promise.all(
    parts.map(async (part) => {
      const vector = await embedSingle(part);
      return classifyIntent(vector, registry!);
    }),
  );

  // Extract slots for each classified part
  const slots = parts.map((part, i) => {
    const classification = classifications[i];
    if (!classification?.intent) {
      return {};
    }
    return extractSlots(part, classification.intent);
  });

  // Make routing decision
  const decision = routeDecision(classifications, { slots });

  if (decision.route !== 'fast-path') {
    pluginCtx.logger.debug(`intent: falling through to LLM [parts=${parts.length}, elapsed=${Date.now() - startTime}ms]`);
    return { handled: false };
  }

  // Execute tools in parallel for all classified intents
  const results = await Promise.all(
    decision.intents.map(async (intent) => {
      if (!intent.intent || !pluginCtx?.executeTool) {
        return null;
      }

      const intentSlots = intent.slots ?? {};
      let toolName = intent.tool;
      let plugin = intent.plugin;

      // Resolve the actual music tool for control actions
      if (intent.intent === 'music.control' && intentSlots.action) {
        toolName = resolveMusicTool(intentSlots.action as string);
        plugin = 'music';
      }

      const qualifiedName = `${plugin}__${toolName}`;
      const toolInput = mapSlotsToInput(intent.intent, toolName, intentSlots);

      try {
        const result = await pluginCtx!.executeTool!(qualifiedName, toolInput, { threadId });
        return typeof result === 'string' ? result : result.text;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        pluginCtx!.logger.warn(`intent: tool execution failed [tool=${qualifiedName}]: ${message}`);
        return null;
      }
    }),
  );

  // If any tool failed, fall through to LLM
  const successfulResults = results.filter((r): r is string => r !== null);
  if (successfulResults.length === 0) {
    return { handled: false };
  }

  const elapsed = Date.now() - startTime;
  pluginCtx.logger.info(`intent: fast-path completed [parts=${parts.length}, tools=${successfulResults.length}, elapsed=${elapsed}ms]`);

  const response = successfulResults.join('\n\n');
  return { handled: true, response };
};

export const plugin: PluginDefinition = {
  name: 'intent',
  version: '1.0.0',

  register: async (ctx): Promise<PluginHooks> => {
    pluginCtx = ctx;
    return {
      onIntentClassify: handleIntentClassify,
    };
  },

  start: async (ctx) => {
    ctx.logger.info('intent: building intent registry');
    const startTime = Date.now();

    try {
      registry = await createIntentRegistry(INTENT_DEFINITIONS, embed);
      ctx.logger.info(`intent: registry built [intents=${registry.entries.length}, elapsed=${Date.now() - startTime}ms]`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error(`intent: failed to build registry: ${message}`);
      ctx.reportStatus('degraded', 'Intent registry failed to build');
    }
  },

  stop: async () => {
    registry = null;
    pluginCtx = null;
  },
};
