import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type ListFolders = (ctx: PluginContext) => Promise<ToolResult>;

const listFolders: ListFolders = async (ctx) => {
  const data = (await graphFetch(ctx, '/me/mailFolders', {
    params: {
      $select: 'id,displayName,totalItemCount,unreadItemCount',
      $top: '50',
    },
  })) as {
    value: Array<{
      id: string;
      displayName: string;
      totalItemCount: number;
      unreadItemCount: number;
    }>;
  };

  if (!data?.value?.length) {
    return 'No mail folders found.';
  }

  const folders = data.value.map((f) => ({
    id: f.id,
    name: f.displayName,
    totalItems: f.totalItemCount,
    unreadItems: f.unreadItemCount,
  }));

  const text = JSON.stringify(folders, null, 2);
  return {
    text,
    blocks: [{ type: 'email-folders', data: { folders } }],
  };
};

export { listFolders };
