import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { parseFromField } from './parse-from-field';
import { validateGraphId } from './validate-graph-id';

type ReadEmail = (ctx: PluginContext, messageId: string) => Promise<ToolResult>;

const readEmail: ReadEmail = async (ctx, messageId) => {
  validateGraphId(messageId, 'messageId');
  const msg = (await graphFetch(ctx, `/me/messages/${messageId}`, {
    params: {
      $select: 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments',
    },
  })) as {
    id: string;
    subject: string;
    from: { emailAddress: { name: string; address: string } } | null;
    toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
    ccRecipients: Array<{ emailAddress: { name: string; address: string } }>;
    receivedDateTime: string;
    body: { contentType: string; content: string };
    hasAttachments: boolean;
  };

  const result = {
    id: msg.id,
    subject: msg.subject,
    from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : 'Unknown sender',
    to: msg.toRecipients.map((r) => `${r.emailAddress.name} <${r.emailAddress.address}>`),
    cc: msg.ccRecipients.map((r) => `${r.emailAddress.name} <${r.emailAddress.address}>`),
    receivedDateTime: msg.receivedDateTime,
    bodyType: msg.body.contentType,
    body: msg.body.content,
    hasAttachments: msg.hasAttachments,
  };

  const text = JSON.stringify(result, null, 2);
  const parsed = parseFromField(result.from);

  return {
    text,
    blocks: [
      {
        type: 'email-list',
        data: {
          emails: [
            {
              id: result.id,
              from: parsed,
              subject: result.subject,
              preview: result.body.substring(0, 200),
              body: result.body,
              bodyType: result.bodyType,
              receivedAt: result.receivedDateTime,
              isRead: true,
              hasAttachments: result.hasAttachments,
            },
          ],
        },
      },
    ],
  };
};

export { readEmail };
