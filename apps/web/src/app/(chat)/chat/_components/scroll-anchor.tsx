'use client';

import { useEffect, useRef } from 'react';

type ScrollAnchorProps = {
  messageCount: number;
};

type ScrollAnchorComponent = (props: ScrollAnchorProps) => React.ReactNode;

export const ScrollAnchor: ScrollAnchorComponent = ({ messageCount }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevCountRef = useRef(messageCount);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          isNearBottomRef.current = entry.isIntersecting;
        }
      },
      { threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  useEffect(() => {
    if (messageCount !== prevCountRef.current) {
      prevCountRef.current = messageCount;
      if (isNearBottomRef.current) {
        anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [messageCount]);

  return <div ref={anchorRef} data-scroll-anchor aria-hidden='true' />;
};
