import { getValidToken } from '@harness/oauth';
import type { PluginContext } from '@harness/plugin-contract';

type CheckOutlookAuth = (ctx: PluginContext) => Promise<string | null>;

const checkOutlookAuth: CheckOutlookAuth = async (ctx) => {
  try {
    return await getValidToken('microsoft', ctx.db);
  } catch {
    return null;
  }
};

const OUTLOOK_AUTH_ERROR = 'Outlook is not connected. Authenticate at /admin/integrations to use this tool.';

export { checkOutlookAuth, OUTLOOK_AUTH_ERROR };
