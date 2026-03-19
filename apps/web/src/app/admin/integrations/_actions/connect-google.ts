'use server';

import { startOAuthFlow } from '@harness/oauth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

type ConnectGoogle = () => Promise<never>;

export const connectGoogle: ConnectGoogle = async () => {
  const { authUrl, state } = startOAuthFlow('google');
  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/oauth/callback',
  });
  cookieStore.set('oauth_provider', 'google', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/oauth/callback',
  });
  redirect(authUrl);
};
