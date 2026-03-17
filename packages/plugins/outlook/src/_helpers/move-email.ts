import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { validateGraphId } from './validate-graph-id';

const WELL_KNOWN_FOLDERS: Record<string, string> = {
  inbox: 'inbox',
  archive: 'archive',
  trash: 'deleteditems',
  drafts: 'drafts',
  sent: 'sentitems',
  junk: 'junkemail',
};

type MoveEmail = (ctx: PluginContext, messageId: string, destinationFolder: string) => Promise<string>;

const moveEmail: MoveEmail = async (ctx, messageId, destinationFolder) => {
  validateGraphId(messageId, 'messageId');
  const folderName = WELL_KNOWN_FOLDERS[destinationFolder.toLowerCase()];
  if (!folderName) {
    throw new Error(`Unknown folder: ${destinationFolder}. Allowed: ${Object.keys(WELL_KNOWN_FOLDERS).join(', ')}`);
  }

  const folder = (await graphFetch(ctx, `/me/mailFolders/${folderName}`)) as { id: string; displayName: string };

  await graphFetch(ctx, `/me/messages/${messageId}/move`, {
    method: 'POST',
    body: { destinationId: folder.id },
  });

  return `Email moved to ${folder.displayName}.`;
};

export { moveEmail };
