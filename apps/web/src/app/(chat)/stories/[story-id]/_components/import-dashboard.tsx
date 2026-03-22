'use client';

import { cn } from '@harness/ui';
import { BookOpen, FileText, GitBranch, MapPin, MessageSquare, Users } from 'lucide-react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { getImportStats } from '../_actions/get-import-stats';

type ImportStats = {
  characters: { total: number; active: number };
  transcripts: { total: number; processed: number; pending: number };
  moments: { total: number; active: number; deleted: number; driftFlagged: number };
  arcs: { total: number; totalLinkedMoments: number };
  locations: number;
  annotations: number;
};

type ImportDashboardProps = {
  storyId: string;
};

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail?: string;
  accent?: string;
};

const StatCard = ({ icon, label, value, detail, accent }: StatCardProps) => (
  <div className='group relative flex flex-col items-center gap-1 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-accent/5'>
    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accent ?? 'bg-muted text-muted-foreground')}>{icon}</div>
    <span className='text-2xl font-bold tabular-nums tracking-tight'>{value}</span>
    <span className='text-[11px] font-medium uppercase tracking-wider text-muted-foreground'>{label}</span>
    {detail && <span className='text-[10px] text-muted-foreground/70'>{detail}</span>}
  </div>
);

export const ImportDashboard = ({ storyId }: ImportDashboardProps) => {
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [, startTransition] = useTransition();

  const loadStats = useCallback(() => {
    startTransition(async () => {
      const result = await getImportStats(storyId);
      setStats(result);
    });
  }, [storyId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (!stats) {
    return (
      <div className='grid grid-cols-3 gap-2 sm:grid-cols-6 animate-pulse'>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className='h-24 rounded-xl bg-muted' />
        ))}
      </div>
    );
  }

  return (
    <div className='grid grid-cols-3 gap-2 sm:grid-cols-6'>
      <StatCard
        icon={<Users className='h-4 w-4' />}
        label='Characters'
        value={stats.characters.active}
        detail={stats.characters.total !== stats.characters.active ? `${stats.characters.total} total` : undefined}
        accent='bg-violet-500/10 text-violet-600 dark:text-violet-400'
      />
      <StatCard
        icon={<FileText className='h-4 w-4' />}
        label='Transcripts'
        value={stats.transcripts.total}
        detail={stats.transcripts.pending > 0 ? `${stats.transcripts.pending} pending` : 'all done'}
        accent='bg-blue-500/10 text-blue-600 dark:text-blue-400'
      />
      <StatCard
        icon={<BookOpen className='h-4 w-4' />}
        label='Moments'
        value={stats.moments.active}
        detail={stats.moments.deleted > 0 ? `${stats.moments.deleted} merged` : undefined}
        accent='bg-amber-500/10 text-amber-600 dark:text-amber-400'
      />
      <StatCard
        icon={<GitBranch className='h-4 w-4' />}
        label='Arcs'
        value={stats.arcs.total}
        detail={stats.arcs.totalLinkedMoments > 0 ? `${stats.arcs.totalLinkedMoments} linked` : undefined}
        accent='bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      />
      <StatCard
        icon={<MapPin className='h-4 w-4' />}
        label='Locations'
        value={stats.locations}
        accent='bg-rose-500/10 text-rose-600 dark:text-rose-400'
      />
      <StatCard
        icon={<MessageSquare className='h-4 w-4' />}
        label='Notes'
        value={stats.annotations}
        accent='bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
      />
    </div>
  );
};
