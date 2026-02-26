'use client';

import { useEffect } from 'react';
import { prewarmSession } from '../_actions/prewarm-session';

type PrewarmTriggerProps = {
  threadId: string;
};

type PrewarmTriggerComponent = (props: PrewarmTriggerProps) => null;

export const PrewarmTrigger: PrewarmTriggerComponent = ({ threadId }) => {
  useEffect(() => {
    prewarmSession(threadId);
  }, [threadId]);

  return null;
};
