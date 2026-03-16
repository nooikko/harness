'use client';

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Skeleton,
} from '@harness/ui';
import { ChevronDown, ExternalLink, Unplug, Wifi } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { disconnectAccount } from '../_actions/disconnect-account';
import { initiateOAuth } from '../_actions/initiate-oauth';

type AccountInfo = {
  email?: string;
  name?: string;
  photo?: string;
  subscriptionTier?: string;
};

type YouTubeAccountSectionProps = {
  connected: boolean;
  account?: AccountInfo;
  orchestratorUrl: string;
};

type PollStatus = 'idle' | 'pending' | 'completed' | 'error';

type YouTubeAccountSectionComponent = (props: YouTubeAccountSectionProps) => React.ReactNode;

export const YouTubeAccountSection: YouTubeAccountSectionComponent = ({ connected: initialConnected, account: initialAccount, orchestratorUrl }) => {
  const [connected, setConnected] = useState(initialConnected);
  const [account, setAccount] = useState<AccountInfo | undefined>(initialAccount);
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle');
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleConnect = async () => {
    setError(null);
    const result = await initiateOAuth();

    if (!result.success) {
      setError(result.error ?? 'Failed to initiate OAuth');
      return;
    }

    setUserCode(result.userCode ?? null);
    setVerificationUrl(result.verificationUrl ?? null);
    setPollStatus('pending');

    // Poll for completion every 3 seconds
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${orchestratorUrl}/api/plugins/music/oauth/status`);
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          status: 'pending' | 'completed' | 'error';
          account?: AccountInfo;
          error?: string;
        };

        if (data.status === 'completed') {
          stopPolling();
          setPollStatus('completed');
          setConnected(true);
          setAccount(data.account);
          setUserCode(null);
          setVerificationUrl(null);
        } else if (data.status === 'error') {
          stopPolling();
          setPollStatus('error');
          setError(data.error ?? 'OAuth failed');
          setUserCode(null);
          setVerificationUrl(null);
        }
      } catch {
        // Polling failure is transient — keep trying
      }
    }, 3000);
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    const result = await disconnectAccount();

    if (result.success) {
      setConnected(false);
      setAccount(undefined);
      setPollStatus('idle');
    } else {
      setError(result.error ?? 'Failed to disconnect');
    }
    setIsDisconnecting(false);
  };

  if (connected && account) {
    return (
      <section className='space-y-3'>
        <h3 className='text-sm font-medium'>YouTube Music Account</h3>
        <Card>
          <CardContent className='flex items-center gap-4 pt-3'>
            {account.photo ? (
              <img src={account.photo} alt={account.name ?? 'Profile'} className='h-10 w-10 rounded-full' />
            ) : (
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-muted'>
                <Wifi className='h-5 w-5 text-muted-foreground' />
              </div>
            )}
            <div className='flex-1'>
              <p className='font-medium'>{account.name ?? 'YouTube Music'}</p>
              {account.email && <p className='text-sm text-muted-foreground'>{account.email}</p>}
            </div>
            {account.subscriptionTier && <Badge variant='secondary'>{account.subscriptionTier}</Badge>}
            <Button variant='outline' size='sm' onClick={handleDisconnect} disabled={isDisconnecting}>
              <Unplug className='mr-1.5 h-3.5 w-3.5' />
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className='space-y-3'>
      <h3 className='text-sm font-medium'>YouTube Music Account</h3>

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {pollStatus === 'pending' && userCode ? (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Complete Sign-In</CardTitle>
            <CardDescription>Visit the URL below and enter the code to connect your account.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center gap-3'>
              <a
                href={verificationUrl ?? 'https://google.com/device'}
                target='_blank'
                rel='noopener noreferrer'
                className='text-sm text-blue-600 underline'
              >
                {verificationUrl ?? 'google.com/device'}
                <ExternalLink className='ml-1 inline-block h-3 w-3' />
              </a>
            </div>
            <div className='rounded-md border bg-muted p-4 text-center'>
              <p className='text-xs text-muted-foreground'>Enter this code</p>
              <p className='mt-1 font-mono text-2xl font-bold tracking-widest'>{userCode}</p>
            </div>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Skeleton className='h-3 w-3 animate-pulse rounded-full' />
              Waiting for authorization...
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Connect YouTube Music</CardTitle>
            <CardDescription>Sign in to access playlists, liked songs, and personalized recommendations.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <Button onClick={handleConnect}>
              <Wifi className='mr-1.5 h-4 w-4' />
              Connect with OAuth
            </Button>

            <Collapsible>
              <CollapsibleTrigger className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'>
                <ChevronDown className='h-3.5 w-3.5' />
                Or paste cookies
              </CollapsibleTrigger>
              <CollapsibleContent className='pt-3'>
                <p className='text-sm text-muted-foreground'>
                  Cookie-based auth is configured via the Playback Settings section below (Cookie and PO Token fields). Extract cookies from your
                  browser DevTools.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}
    </section>
  );
};
