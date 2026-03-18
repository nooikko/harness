import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { parseFromField } from './parse-from-field';

type EmailSearchResult = {
  id: string;
  subject: string;
  from: string;
  receivedDateTime: string;
  bodyPreview: string;
};

type SearchEmails = (ctx: PluginContext, query: string, top?: number) => Promise<ToolResult>;

const searchEmails: SearchEmails = async (ctx, query, top = 20) => {
  const data = (await graphFetch(ctx, '/me/messages', {
    params: {
      $search: `"${query.replace(/"/g, '\\"')}"`,
      $top: String(top),
      $select: 'id,subject,from,receivedDateTime,bodyPreview',
    },
  })) as {
    value: Array<{
      id: string;
      subject: string;
      from: { emailAddress: { name: string; address: string } };
      receivedDateTime: string;
      bodyPreview: string;
    }>;
  };

  if (!data?.value?.length) {
    return 'No emails found matching your search.';
  }

  const results: EmailSearchResult[] = data.value.map((msg) => ({
    id: msg.id,
    subject: msg.subject,
    from: `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`,
    receivedDateTime: msg.receivedDateTime,
    bodyPreview: msg.bodyPreview.slice(0, 200),
  }));

  const text = JSON.stringify(results, null, 2);

  return {
    text,
    blocks: [
      {
        type: 'email-list',
        data: {
          emails: results.map((r) => ({
            id: r.id,
            from: parseFromField(r.from),
            subject: r.subject,
            preview: r.bodyPreview,
            receivedAt: r.receivedDateTime,
            isRead: true,
            hasAttachments: false,
          })),
        },
      },
    ],
  };
};

export { searchEmails };
