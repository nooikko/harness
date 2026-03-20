import { getValidToken } from '@harness/oauth';
import type { PluginContext } from '@harness/plugin-contract';

type GraphFetchOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
};

type GraphFetch = (ctx: PluginContext, path: string, options?: GraphFetchOptions) => Promise<unknown>;

const graphFetch: GraphFetch = async (ctx, path, options = {}) => {
  const token = await getValidToken('microsoft', ctx.db);
  const url = new URL(`https://graph.microsoft.com/v1.0${path}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph API error (${response.status}): ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export { graphFetch };
