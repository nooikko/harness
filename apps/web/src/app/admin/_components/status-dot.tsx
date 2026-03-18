import type React from 'react';

type StatusDotProps = {
  /** The status string to display. Determines the dot color. */
  status: string;
  /** When true, the dot pulses — intended for running/in-progress states. */
  pulse?: boolean;
};

type StatusDotComponent = (props: StatusDotProps) => React.ReactNode;

const SUCCESS_STATUSES = new Set(['enabled', 'active', 'completed', 'success', 'healthy']);
const INACTIVE_STATUSES = new Set(['disabled', 'inactive', 'archived']);
const RUNNING_STATUSES = new Set(['running', 'in-progress']);
const WARNING_STATUSES = new Set(['warning', 'degraded']);
const ERROR_STATUSES = new Set(['failed', 'error']);

type DotStyle = {
  dot: string;
  shouldPulse: boolean;
};

const resolveDotStyle = (status: string, pulse: boolean): DotStyle => {
  const normalized = status.toLowerCase();

  if (SUCCESS_STATUSES.has(normalized)) {
    return { dot: 'bg-success', shouldPulse: false };
  }

  if (INACTIVE_STATUSES.has(normalized)) {
    return { dot: 'bg-muted-foreground/40', shouldPulse: false };
  }

  if (RUNNING_STATUSES.has(normalized)) {
    return { dot: 'bg-info', shouldPulse: pulse };
  }

  if (WARNING_STATUSES.has(normalized)) {
    return { dot: 'bg-warning', shouldPulse: false };
  }

  if (ERROR_STATUSES.has(normalized)) {
    return { dot: 'bg-destructive', shouldPulse: false };
  }

  // Unknown status — neutral grey
  return { dot: 'bg-muted-foreground/40', shouldPulse: false };
};

export const StatusDot: StatusDotComponent = ({ status, pulse = false }) => {
  const { dot, shouldPulse } = resolveDotStyle(status, pulse);

  return (
    <span className='inline-flex items-center gap-1.5 text-xs text-muted-foreground'>
      <span
        className={`h-2 w-2 rounded-full ${dot}`}
        style={shouldPulse ? { animation: 'pulse-dot 1.5s ease-in-out infinite' } : undefined}
        aria-hidden='true'
      />
      {status}
    </span>
  );
};
