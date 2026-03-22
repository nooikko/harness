import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { parseFromField } from './parse-from-field';

type ListFolderEmails = (ctx: PluginContext, folder?: string, skip?: number, take?: number) => Promise<ToolResult | string>;

const WELL_KNOWN_FOLDERS: Record<string, string> = {
  inbox: 'inbox',
  archive: 'archive',
  trash: 'deleteditems',
  drafts: 'drafts',
  sent: 'sentitems',
  junk: 'junkemail',
};

const UNSUBSCRIBE_PATTERN = /unsubscribe/i;

const listFolderEmails: ListFolderEmails = async (ctx, folder = 'inbox', skip = 0, take = 20) => {
  const cappedTake = Math.min(take, 50);
  const folderKey = WELL_KNOWN_FOLDERS[folder.toLowerCase()] ?? folder;
  const folderPath = `/me/mailFolders/${folderKey}/messages`;

  const data = (await graphFetch(ctx, folderPath, {
    params: {
      $top: String(cappedTake),
      $skip: String(skip),
      $select: 'id,subject,from,receivedDateTime,isRead,hasAttachments,bodyPreview',
      $orderby: 'receivedDateTime desc',
    },
  })) as {
    value: Array<{
      id: string;
      subject: string;
      from: { emailAddress: { name: string; address: string } } | null;
      receivedDateTime: string;
      isRead: boolean;
      hasAttachments: boolean;
      bodyPreview: string | null;
    }>;
  };

  if (!data?.value?.length) {
    return `No emails found in ${folder} (skip=${skip}).`;
  }

  const emails = data.value.map((msg) => {
    const fromStr = msg.from?.emailAddress ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>` : 'Unknown sender';

    return {
      id: msg.id,
      from: parseFromField(fromStr),
      subject: msg.subject,
      receivedAt: msg.receivedDateTime,
      isRead: msg.isRead,
      hasAttachments: msg.hasAttachments,
      hasUnsubscribeLink: UNSUBSCRIBE_PATTERN.test(msg.bodyPreview ?? ''),
    };
  });

  const text = JSON.stringify(emails, null, 2);

  return {
    text,
    blocks: [
      {
        type: 'email-list',
        data: { emails },
      },
    ],
  };
};

export { listFolderEmails };
