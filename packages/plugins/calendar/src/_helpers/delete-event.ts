import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';
import { validateGraphId } from './validate-graph-id';

type DeleteEvent = (ctx: PluginContext, eventId: string) => Promise<string>;

const deleteEvent: DeleteEvent = async (ctx, eventId) => {
  validateGraphId(eventId, 'eventId');
  await graphFetch(ctx, `/me/events/${eventId}`, { method: 'DELETE' });
  return 'Event deleted successfully.';
};

export { deleteEvent };
