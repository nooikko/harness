import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type UnsubscribeResult = {
  sender: string;
  subject: string;
  unsubscribeLinks: string[];
  messageId: string;
};

type FindUnsubscribeLinks = (ctx: PluginContext, top?: number) => Promise<string>;

const findUnsubscribeLinks: FindUnsubscribeLinks = async (ctx, top = 50) => {
  const data = (await graphFetch(ctx, '/me/messages', {
    params: {
      $search: '"unsubscribe"',
      $top: String(top),
      $select: 'id,subject,from,body',
    },
  })) as {
    value: Array<{
      id: string;
      subject: string;
      from: { emailAddress: { name: string; address: string } } | null;
      body: { content: string };
    }>;
  };

  if (!data?.value?.length) {
    return 'No emails with unsubscribe links found.';
  }

  const results: UnsubscribeResult[] = [];

  for (const msg of data.value) {
    const linkRegex = /href=["']([^"']*unsubscribe[^"']*)["']/gi;
    const links: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(msg.body.content)) !== null) {
      if (match[1]) {
        links.push(match[1]);
      }
    }

    if (links.length > 0) {
      results.push({
        sender: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : 'Unknown sender',
        subject: msg.subject,
        unsubscribeLinks: [...new Set(links)],
        messageId: msg.id,
      });
    }
  }

  if (results.length === 0) {
    return "Found emails mentioning 'unsubscribe' but could not extract any unsubscribe links from the HTML.";
  }

  return JSON.stringify(results, null, 2);
};

export { findUnsubscribeLinks };
