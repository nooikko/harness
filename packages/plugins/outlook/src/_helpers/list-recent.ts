import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { parseFromField } from './parse-from-field';

type ListRecent = (ctx: PluginContext, folder?: string, top?: number) => Promise<ToolResult>;

const WELL_KNOWN_FOLDERS: Record<string, string> = {
  inbox: 'inbox',
  archive: 'archive',
  trash: 'deleteditems',
  drafts: 'drafts',
  sent: 'sentitems',
  junk: 'junkemail',
};

const listRecent: ListRecent = async (ctx, folder = 'inbox', top = 20) => {
  const folderKey = WELL_KNOWN_FOLDERS[folder.toLowerCase()] ?? folder;
  const folderPath = `/me/mailFolders/${folderKey}/messages`;

  const data = (await graphFetch(ctx, folderPath, {
    params: {
      $top: String(top),
      $select: 'id,subject,from,receivedDateTime,isRead,bodyPreview',
      $orderby: 'receivedDateTime desc',
    },
  })) as {
    value: Array<{
      id: string;
      subject: string;
      from: { emailAddress: { name: string; address: string } } | null;
      receivedDateTime: string;
      isRead: boolean;
      bodyPreview: string;
    }>;
  };

  if (!data?.value?.length) {
    return `No emails found in ${folder}.`;
  }

  const results = data.value.map((msg) => ({
    id: msg.id,
    subject: msg.subject,
    from: msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : 'Unknown sender',
    receivedDateTime: msg.receivedDateTime,
    isRead: msg.isRead,
    preview: msg.bodyPreview?.slice(0, 150) ?? '',
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
            preview: r.preview,
            receivedAt: r.receivedDateTime,
            isRead: r.isRead,
            hasAttachments: false,
          })),
        },
      },
    ],
  };
};

export { listRecent };
