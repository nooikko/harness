import type { CalendarEventSource } from '@harness/database';
import { Bell, Brain, Cake, Calendar, CheckSquare, Clock, HeartPulse, type LucideIcon, Star, Users } from 'lucide-react';

type SourceStyle = {
  color: string;
  icon: LucideIcon;
  label: string;
};

const SOURCE_STYLES: Record<CalendarEventSource, SourceStyle> = {
  OUTLOOK: { color: '#4285F4', icon: Calendar, label: 'Outlook' },
  GOOGLE: { color: '#34A853', icon: Calendar, label: 'Google' },
  LOCAL: { color: '#9333EA', icon: Star, label: 'Local' },
  MEMORY: { color: '#F59E0B', icon: Brain, label: 'Memory' },
  TASK: { color: '#22C55E', icon: CheckSquare, label: 'Task' },
  CRON: { color: '#EA580C', icon: Clock, label: 'Scheduled' },
};

type CategoryStyle = {
  icon: LucideIcon;
  color: string;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  birthday: { icon: Cake, color: '#EC4899' },
  medical: { icon: HeartPulse, color: '#EF4444' },
  meeting: { icon: Users, color: '#3B82F6' },
  reminder: { icon: Bell, color: '#8B5CF6' },
};

type GetEventStyle = (source: CalendarEventSource, category?: string | null, colorOverride?: string | null) => SourceStyle;

const getEventStyle: GetEventStyle = (source, category, colorOverride) => {
  // All enum values are defined in SOURCE_STYLES — safe to assert
  const base = SOURCE_STYLES[source]!;
  const cat = category ? CATEGORY_STYLES[category] : undefined;

  return {
    color: colorOverride ?? cat?.color ?? base.color,
    icon: cat?.icon ?? base.icon,
    label: base.label,
  };
};

export { CATEGORY_STYLES, SOURCE_STYLES, getEventStyle };
export type { SourceStyle };
