import type { PluginDefinition, PluginTool } from '@harness/plugin-contract';
import { closeBrowser, closePageForThread, launchBrowser } from './_helpers/browser-manager';
import { check } from './_helpers/check';
import { click } from './_helpers/click';
import { fill } from './_helpers/fill';
import { navigate } from './_helpers/navigate';
import { pressKey } from './_helpers/press-key';
import { screenshot } from './_helpers/screenshot';
import { selectOption } from './_helpers/select-option';
import { snapshot } from './_helpers/snapshot';
import { cleanupAll, cleanupTrace } from './_helpers/temp-tracker';

const tools: PluginTool[] = [
  {
    name: 'navigate',
    description:
      'Navigate the browser to a URL. Returns the page title, final URL, and HTTP status. The browser page persists across tool calls within this pipeline run, so you can navigate and then interact with the page using other tools.',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to (must be http:// or https://)',
        },
      },
      required: ['url'],
    },
    handler: navigate,
  },
  {
    name: 'snapshot',
    description:
      'Get an accessibility tree snapshot of the current page. This is the primary way to understand page structure — it shows headings, buttons, links, form fields, checkboxes, and their states (checked, disabled, etc.). Use this after navigating to understand what is on the page before interacting with it.',
    schema: {
      type: 'object',
      properties: {},
    },
    handler: snapshot,
  },
  {
    name: 'click',
    description:
      'Click an element on the page by CSS selector. Use for buttons, links, checkboxes, and any clickable element. After clicking, the page may navigate or update — use snapshot to see the new state.',
    schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: "CSS selector for the element to click (e.g., 'button[type=\"submit\"]', 'a.unsubscribe-link', '#accept-btn')",
        },
      },
      required: ['selector'],
    },
    handler: click,
  },
  {
    name: 'fill',
    description: 'Type text into a form input field. Clears any existing value first, then types the new value.',
    schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input field',
        },
        value: {
          type: 'string',
          description: 'The text to type into the field',
        },
      },
      required: ['selector', 'value'],
    },
    handler: fill,
  },
  {
    name: 'select_option',
    description: 'Select an option from a <select> dropdown by value.',
    schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the <select> element',
        },
        value: {
          type: 'string',
          description: 'The value attribute of the option to select',
        },
      },
      required: ['selector', 'value'],
    },
    handler: selectOption,
  },
  {
    name: 'check',
    description: 'Check or uncheck a checkbox. Defaults to checking. Set checked=false to uncheck.',
    schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the checkbox input',
        },
        checked: {
          type: 'boolean',
          description: 'true to check (default), false to uncheck',
        },
      },
      required: ['selector'],
    },
    handler: check,
  },
  {
    name: 'screenshot',
    description:
      'Take a screenshot of the current page. The screenshot is saved to a temporary file that will be auto-deleted when this pipeline run completes. Only use this when you need visual confirmation or the user explicitly asked for a screenshot. Prefer snapshot (accessibility tree) for understanding page structure.',
    schema: {
      type: 'object',
      properties: {
        full_page: {
          type: 'boolean',
          description: 'Capture the full scrollable page (default: false, captures only the viewport)',
        },
      },
    },
    handler: screenshot,
  },
  {
    name: 'press_key',
    description: 'Press a keyboard key. Useful for submitting forms (Enter), tabbing between fields (Tab), closing modals (Escape), etc.',
    schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown", "Space")',
        },
      },
      required: ['key'],
    },
    handler: pressKey,
  },
];

export const plugin: PluginDefinition = {
  name: 'playwright',
  version: '1.0.0',
  tools,

  register: async (ctx) => ({
    onPipelineComplete: async (threadId, result) => {
      // Clean up temp files for this pipeline run
      const traceId = result?.invokeResult?.traceId;
      if (traceId) {
        try {
          cleanupTrace(traceId);
        } catch {
          // Best-effort filesystem cleanup — must not block page cleanup
        }
      }

      // Close the browser page for this thread
      await closePageForThread(threadId);
    },
  }),

  start: async (ctx) => {
    ctx.logger.info('playwright: launching headless browser');
    await launchBrowser();
    ctx.logger.info('playwright: browser ready');
  },

  stop: async (ctx) => {
    ctx.logger.info('playwright: shutting down browser');
    await closeBrowser();
    cleanupAll();
    ctx.logger.info('playwright: cleanup complete');
  },
};
