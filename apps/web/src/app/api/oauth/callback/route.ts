import { prisma } from '@harness/database';
import { handleOAuthCallback, isProviderSupported } from '@harness/oauth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Access was denied. Please grant the required permissions.',
  invalid_request: 'Invalid OAuth request. Please try again.',
  server_error: 'Authentication server error. Please try again later.',
};

type GetHandler = (request: NextRequest) => Promise<Response>;

export const GET: GetHandler = async (request) => {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  if (error) {
    const message = OAUTH_ERROR_MESSAGES[error] ?? 'Authentication failed.';
    redirect(`/admin/integrations?${new URLSearchParams({ error: message }).toString()}`);
  }

  // Validate CSRF state parameter
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  const provider = cookieStore.get('oauth_provider')?.value ?? 'microsoft';
  cookieStore.delete('oauth_state');
  cookieStore.delete('oauth_provider');

  if (!state || !storedState || state !== storedState) {
    redirect('/admin/integrations?error=Invalid+state+parameter.+Please+try+again.');
  }

  if (!code) {
    redirect('/admin/integrations?error=No+authorization+code+received');
  }

  if (!isProviderSupported(provider)) {
    redirect(`/admin/integrations?${new URLSearchParams({ error: `Unsupported provider: ${provider}` }).toString()}`);
  }

  try {
    await handleOAuthCallback({ code, provider, db: prisma });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth flow failed. Please try again.';
    redirect(`/admin/integrations?${new URLSearchParams({ error: message }).toString()}`);
  }

  redirect('/admin/integrations?success=true');
};
