import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type ListFolders = (ctx: PluginContext) => Promise<string>;

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

  const folders = data.value.map((f) => ({
    id: f.id,
    name: f.displayName,
    totalItems: f.totalItemCount,
    unreadItems: f.unreadItemCount,
  }));

  return JSON.stringify(folders, null, 2);
};

export { listFolders };
