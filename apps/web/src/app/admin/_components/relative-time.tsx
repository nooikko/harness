'use client';

// Client component — wraps a <time> element with a tooltip showing exact datetime

import { Tooltip } from '@harness/ui';
import { formatRelativeTime } from '../_helpers/format-relative-time';

type RelativeTimeProps = {
  date: Date;
  className?: string;
};

const RelativeTime = ({ date, className }: RelativeTimeProps) => (
  <Tooltip
    content={date.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })}
  >
    <time dateTime={date.toISOString()} className={className}>
      {formatRelativeTime(date)}
    </time>
  </Tooltip>
);

export { RelativeTime };
