import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type DeleteEvent = (ctx: PluginContext, eventId: string) => Promise<ToolResult>;

const deleteEvent: DeleteEvent = async (ctx, eventId) => {
  await graphFetch(ctx, `/me/events/${eventId}`, {
    method: 'DELETE',
  });

  return `deleted Outlook event (${eventId})`;
};

export { deleteEvent };
