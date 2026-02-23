import { Clock, ListTodo, MessageCircle, Star } from 'lucide-react';

type ThreadKindIconProps = {
  kind: string;
  className?: string;
};

type ThreadKindIconComponent = (props: ThreadKindIconProps) => React.ReactNode;

const ICON_MAP: Record<string, typeof Star> = {
  primary: Star,
  task: ListTodo,
  cron: Clock,
  general: MessageCircle,
};

const LABEL_MAP: Record<string, string> = {
  primary: 'Primary',
  task: 'Task',
  cron: 'Cron',
  general: 'General',
};

/**
 * Renders an icon and optional screen-reader label for a thread kind.
 */
export const ThreadKindIcon: ThreadKindIconComponent = ({ kind, className }) => {
  const Icon = ICON_MAP[kind] ?? MessageCircle;
  const label = LABEL_MAP[kind] ?? kind;

  return (
    <span role='img' title={label} aria-label={label}>
      <Icon className={className} />
    </span>
  );
};
