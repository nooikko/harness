import type { PluginContext } from '@harness/plugin-contract';
import { checkOutlookAuth, OUTLOOK_AUTH_ERROR } from './check-outlook-auth';
import { graphFetch } from './graph-fetch';

type OutlookListCalendars = (ctx: PluginContext) => Promise<string>;

const outlookListCalendars: OutlookListCalendars = async (ctx) => {
  const token = await checkOutlookAuth(ctx);
  if (!token) {
    return OUTLOOK_AUTH_ERROR;
  }

  const data = (await graphFetch(ctx, '/me/calendars', {
    params: {
      $select: 'id,name,color,isDefaultCalendar,canEdit,owner',
    },
  })) as {
    value?: Array<{
      id: string;
      name: string;
      color: string;
      isDefaultCalendar: boolean;
      canEdit: boolean;
      owner: { name: string; address: string };
    }>;
  } | null;

  if (!data?.value?.length) {
    return 'No calendars found.';
  }

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

export { outlookListCalendars };
