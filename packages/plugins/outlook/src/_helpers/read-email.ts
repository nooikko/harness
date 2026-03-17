import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { validateGraphId } from './validate-graph-id';

type ReadEmail = (ctx: PluginContext, messageId: string) => Promise<string>;

const readEmail: ReadEmail = async (ctx, messageId) => {
  validateGraphId(messageId, 'messageId');
  const msg = (await graphFetch(ctx, `/me/messages/${messageId}`, {
    params: {
      $select: 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments',
    },
  })) as {
    id: string;
    subject: string;
    from: { emailAddress: { name: string; address: string } };
    toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
    ccRecipients: Array<{ emailAddress: { name: string; address: string } }>;
    receivedDateTime: string;
    body: { contentType: string; content: string };
    hasAttachments: boolean;
  };

  const result = {
    id: msg.id,
    subject: msg.subject,
    from: `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`,
    to: msg.toRecipients.map((r) => `${r.emailAddress.name} <${r.emailAddress.address}>`),
    cc: msg.ccRecipients.map((r) => `${r.emailAddress.name} <${r.emailAddress.address}>`),
    receivedDateTime: msg.receivedDateTime,
    bodyType: msg.body.contentType,
    body: msg.body.content,
    hasAttachments: msg.hasAttachments,
  };

  return JSON.stringify(result, null, 2);
};

export { readEmail };
