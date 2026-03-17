'use server';

import { startOAuthFlow } from '@harness/oauth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

type ConnectMicrosoft = () => Promise<never>;

export const connectMicrosoft: ConnectMicrosoft = async () => {
  const { authUrl, state } = startOAuthFlow('microsoft');
  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/oauth/callback',
  });
  redirect(authUrl);
};
