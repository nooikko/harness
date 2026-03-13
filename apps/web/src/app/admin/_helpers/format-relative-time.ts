// Shared relative time formatter for admin UI components

type FormatRelativeTime = (date: Date | null) => string;

/**
 * Formats a date as a human-readable relative time string.
 *
 * - null → "—"
 * - < 60 seconds → "just now"
 * - < 60 minutes → "3m ago"
 * - < 24 hours → "2h ago"
 * - < 7 days → "3d ago"
 * - < 365 days → "Mar 4" (month + day only)
 * - >= 365 days → "Mar 4, 2025" (with year)
 */
const formatRelativeTime: FormatRelativeTime = (date) => {
  if (date === null) {
    return '—';
  }

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const years = Math.floor(days / 365);
  if (years < 1) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export { formatRelativeTime };
