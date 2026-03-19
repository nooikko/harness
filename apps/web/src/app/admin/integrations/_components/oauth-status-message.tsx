'use client';

import { useEffect, useState } from 'react';

type OAuthStatusMessageProps = {
  error?: string;
  success?: boolean;
};

type OAuthStatusMessageComponent = (props: OAuthStatusMessageProps) => React.ReactNode;

export const OAuthStatusMessage: OAuthStatusMessageComponent = ({ error, success }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  if (!visible) {
    return null;
  }

  if (error) {
    return <div className='rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive'>{error}</div>;
  }

  if (success) {
    return <div className='rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400'>Account connected successfully.</div>;
  }

  return null;
};
