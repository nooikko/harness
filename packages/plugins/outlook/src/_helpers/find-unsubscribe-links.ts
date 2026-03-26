import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type UnsubscribeResult = {
  sender: string;
  subject: string;
  unsubscribeLinks: string[];
  messageId: string;
};

type ReportProgress = (message: string, detail?: { current?: number; total?: number }) => void;

type FindUnsubscribeLinksOptions = {
  top?: number;
  reportProgress?: ReportProgress;
};

type FindUnsubscribeLinks = (ctx: PluginContext, options?: FindUnsubscribeLinksOptions) => Promise<string>;

const findUnsubscribeLinks: FindUnsubscribeLinks = async (ctx, options) => {
  const top = options?.top ?? 50;
  const reportProgress = options?.reportProgress;
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

  const total = data.value.length;
  for (let i = 0; i < total; i++) {
    const msg = data.value[i]!;
    reportProgress?.(`Scanning email ${i + 1}/${total}`, { current: i + 1, total });
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
