// Format time — produces a human-readable timestamp in the configured timezone

export type FormatTimeOptions = {
  timezone: string;
  now?: Date;
};

type FormatTime = (options: FormatTimeOptions) => string;

export const formatTime: FormatTime = (options) => {
  const date = options.now ?? new Date();
  const formatted = date.toLocaleString('en-US', {
    timeZone: options.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  return formatted;
};
