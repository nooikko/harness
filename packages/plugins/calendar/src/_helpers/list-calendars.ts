import type { PluginContext } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type ListCalendars = (ctx: PluginContext) => Promise<string>;

const listCalendars: ListCalendars = async (ctx) => {
  const data = (await graphFetch(ctx, '/me/calendars', {
    params: {
      $select: 'id,name,color,isDefaultCalendar,canEdit,owner',
    },
  })) as {
    value: Array<{
      id: string;
      name: string;
      color: string;
      isDefaultCalendar: boolean;
      canEdit: boolean;
      owner: { name: string; address: string };
    }>;
  };

  const calendars = data.value.map((cal) => ({
    id: cal.id,
    name: cal.name,
    color: cal.color,
    isDefault: cal.isDefaultCalendar,
    canEdit: cal.canEdit,
    owner: `${cal.owner.name} <${cal.owner.address}>`,
  }));

  return JSON.stringify(calendars, null, 2);
};

export { listCalendars };
