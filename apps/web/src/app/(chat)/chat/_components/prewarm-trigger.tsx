'use client';

import { useEffect } from 'react';

type PrewarmTriggerProps = {
  threadId: string;
};

type PrewarmTriggerComponent = (props: PrewarmTriggerProps) => null;

export const PrewarmTrigger: PrewarmTriggerComponent = ({ threadId }) => {
  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/prewarm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId }),
      signal: controller.signal,
    }).catch(() => {
      // Best-effort — silently ignore prewarm failures
    });

    return () => {
      controller.abort();
    };
  }, [threadId]);

  return null;
};
