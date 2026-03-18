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
  const wellKnown = WELL_KNOWN_FOLDERS[destinationFolder.toLowerCase()];

  let folder: { id: string; displayName: string };

  if (wellKnown) {
    folder = (await graphFetch(ctx, `/me/mailFolders/${wellKnown}`)) as { id: string; displayName: string };
  } else {
    const data = (await graphFetch(ctx, '/me/mailFolders', {
      params: { $filter: `displayName eq '${destinationFolder.replace(/'/g, "''")}'`, $select: 'id,displayName' },
    })) as { value: Array<{ id: string; displayName: string }> };

    if (!data?.value?.length) {
      throw new Error(`Folder not found: "${destinationFolder}". Use list_folders to see available folders.`);
    }
    folder = data.value[0]!;
  }

  await graphFetch(ctx, `/me/messages/${messageId}/move`, {
    method: 'POST',
    body: { destinationId: folder.id },
  });

  return `Email moved to ${folder.displayName}.`;
};

export { moveEmail };
