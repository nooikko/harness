import type { PluginDefinition } from '@harness/plugin-contract';
import { findUnsubscribeLinks } from './_helpers/find-unsubscribe-links';
import { listFolderEmails } from './_helpers/list-folder-emails';
import { listFolders } from './_helpers/list-folders';
import { listRecent } from './_helpers/list-recent';
import { moveEmail } from './_helpers/move-email';
import { readEmail } from './_helpers/read-email';
import { replyEmail } from './_helpers/reply-email';
import { searchEmails } from './_helpers/search-emails';
import { sendEmail } from './_helpers/send-email';

const plugin: PluginDefinition = {
  name: 'outlook',
  version: '1.0.0',
  tools: [
    {
      name: 'search_emails',
      description: 'Search emails by query string (supports KQL syntax). Returns subject, from, date, and preview for matching emails.',
      schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "Search query (KQL syntax). Examples: 'from:alice subject:meeting', 'hasAttachments:true'",
          },
          top: {
            type: 'number',
            description: 'Maximum results to return (default 20, max 50)',
          },
        },
        required: ['query'],
      },
      handler: async (ctx, input) => {
        const { query, top } = input as { query: string; top?: number };
        return searchEmails(ctx, query, Math.min(top ?? 20, 50));
      },
    },
    {
      name: 'read_email',
      description: 'Read the full content of an email by its ID. Returns subject, from, to, cc, body (HTML), and attachment info.',
      schema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'The email message ID',
          },
        },
        required: ['messageId'],
      },
      handler: async (ctx, input) => {
        const { messageId } = input as { messageId: string };
        return readEmail(ctx, messageId);
      },
    },
    {
      name: 'list_recent',
      description: 'List recent emails from a mail folder. Defaults to inbox. Supports inbox, sent, drafts, archive, trash.',
      schema: {
        type: 'object',
        properties: {
          folder: {
            type: 'string',
            description: 'Mail folder name (default: inbox). Options: inbox, sent, drafts, archive, trash',
          },
          top: {
            type: 'number',
            description: 'Maximum results to return (default 20, max 50)',
          },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { folder, top } = input as { folder?: string; top?: number };
        return listRecent(ctx, folder, Math.min(top ?? 20, 50));
      },
    },
    {
      name: 'send_email',
      description: 'Send a new email. Provide recipients, subject, and body.',
      schema: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recipient email addresses',
          },
          cc: {
            type: 'array',
            items: { type: 'string' },
            description: 'CC recipients (optional)',
          },
          bcc: {
            type: 'array',
            items: { type: 'string' },
            description: 'BCC recipients (optional)',
          },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
          isHtml: {
            type: 'boolean',
            description: 'Whether body is HTML (default: false)',
          },
        },
        required: ['to', 'subject', 'body'],
      },
      handler: async (ctx, input) => {
        const { to, cc, bcc, subject, body, isHtml } = input as {
          to: string[];
          cc?: string[];
          bcc?: string[];
          subject: string;
          body: string;
          isHtml?: boolean;
        };
        return sendEmail(ctx, { to, cc, bcc, subject, body, isHtml });
      },
    },
    {
      name: 'reply_email',
      description: 'Reply to an email by its ID. Sends a reply to the original sender.',
      schema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'The email message ID to reply to',
          },
          comment: {
            type: 'string',
            description: 'Reply message content',
          },
        },
        required: ['messageId', 'comment'],
      },
      handler: async (ctx, input) => {
        const { messageId, comment } = input as {
          messageId: string;
          comment: string;
        };
        return replyEmail(ctx, messageId, comment);
      },
    },
    {
      name: 'move_email',
      description: 'Move an email to a different folder. Supports well-known folders: inbox, archive, trash, drafts, sent, junk.',
      schema: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'The email message ID to move',
          },
          folder: {
            type: 'string',
            description: 'Destination folder (inbox, archive, trash, drafts, sent, junk, or a custom folder name)',
          },
        },
        required: ['messageId', 'folder'],
      },
      handler: async (ctx, input) => {
        const { messageId, folder } = input as {
          messageId: string;
          folder: string;
        };
        return moveEmail(ctx, messageId, folder);
      },
    },
    {
      name: 'list_folders',
      description: 'List all mail folders with their item counts and unread counts.',
      schema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (ctx) => {
        return listFolders(ctx);
      },
    },
    {
      name: 'list_folder_emails',
      description: 'List emails from a folder with pagination. Returns basic metadata (sender, subject, date, ID, unsubscribe flag) per email.',
      schema: {
        type: 'object',
        properties: {
          folder: {
            type: 'string',
            description: 'Folder name (default: inbox). Options: inbox, sent, drafts, archive, trash, junk, or a custom folder name',
          },
          skip: {
            type: 'number',
            description: 'Number of emails to skip (offset). Default: 0',
          },
          take: {
            type: 'number',
            description: 'Number of emails to return (default 20, max 50)',
          },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { folder, skip, take } = input as { folder?: string; skip?: number; take?: number };
        return listFolderEmails(ctx, folder, skip, take);
      },
    },
    {
      name: 'find_unsubscribe_links',
      description: 'Search for emails containing unsubscribe links. Returns sender, subject, and extracted unsubscribe URLs.',
      schema: {
        type: 'object',
        properties: {
          top: {
            type: 'number',
            description: 'Maximum emails to scan (default 50)',
          },
        },
        required: [],
      },
      handler: async (ctx, input) => {
        const { top } = input as { top?: number };
        return findUnsubscribeLinks(ctx, top);
      },
    },
  ],
  register: async () => ({}),
};

export { plugin };
