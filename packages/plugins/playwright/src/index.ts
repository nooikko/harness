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
import { validatePages } from './_helpers/validate-pages';
import { cleanupRecordingState, startRecording, stopRecording } from './_helpers/video-recording';

const tools: PluginTool[] = [
  {
    name: 'navigate',
    audience: 'agent',
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
    audience: 'agent',
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
    audience: 'agent',
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
    audience: 'agent',
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
    audience: 'agent',
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
    audience: 'agent',
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
    audience: 'agent',
    description:
      'Take a screenshot of the current page. The screenshot is persisted as a file attachment on the thread and will be visible in the chat UI. Use this when you need visual confirmation, want to show the user what something looks like, or the user explicitly asked for a screenshot. Prefer snapshot (accessibility tree) for understanding page structure.',
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
    audience: 'agent',
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
  {
    name: 'start_recording',
    audience: 'agent',
    description:
      'Start recording a video of the browser page. All page activity will be captured until stop_recording is called. The current page URL is preserved. Note: this closes and recreates the browser context, so cookies and session state will be lost.',
    schema: {
      type: 'object',
      properties: {},
    },
    handler: startRecording,
  },
  {
    name: 'stop_recording',
    audience: 'agent',
    description:
      'Stop the active video recording and save it as a file attachment on the thread. The video will be visible in the chat UI. Must call start_recording first. Note: after stopping, the browser page resets to about:blank — call navigate before using other browser tools.',
    schema: {
      type: 'object',
      properties: {},
    },
    handler: stopRecording,
  },
  {
    name: 'validate_pages',
    audience: 'agent',
    description:
      'Navigate to a list of URLs and take a screenshot of each page. All screenshots are persisted as file attachments visible in the chat UI. Use this for batch visual validation — e.g., checking multiple pages on a staging server after a deployment.',
    schema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of URLs to screenshot (max 20). Each must be http:// or https://.',
        },
      },
      required: ['urls'],
    },
    handler: validatePages,
  },
];

export const plugin: PluginDefinition = {
  name: 'playwright',
  version: '1.0.0',
  tools,

  register: async (ctx) => ({
    onPipelineComplete: async (threadId, result) => {
      // Safety net: if agent forgot to call stop_recording, finalize and upload the video.
      // Must run BEFORE cleanupTrace (which deletes the trace dir) and BEFORE closePageForThread.
      await cleanupRecordingState(threadId, ctx);

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
