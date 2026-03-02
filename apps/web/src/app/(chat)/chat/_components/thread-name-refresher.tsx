'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useWs } from '@/app/_components/ws-provider';

type ThreadNameRefresherComponent = () => null;

export const ThreadNameRefresher: ThreadNameRefresherComponent = () => {
  const router = useRouter();
  const { lastEvent } = useWs('thread:name-updated');

  useEffect(() => {
    if (!lastEvent) {
      return;
    }
    router.refresh();
  }, [lastEvent, router]);

  return null;
};
