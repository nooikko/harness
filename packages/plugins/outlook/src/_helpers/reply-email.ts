import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { validateGraphId } from './validate-graph-id';

type ReplyEmail = (ctx: PluginContext, messageId: string, comment: string) => Promise<string>;

const replyEmail: ReplyEmail = async (ctx, messageId, comment) => {
  validateGraphId(messageId, 'messageId');
  await graphFetch(ctx, `/me/messages/${messageId}/reply`, {
    method: 'POST',
    body: { comment },
  });

  return 'Reply sent.';
};

export { replyEmail };
