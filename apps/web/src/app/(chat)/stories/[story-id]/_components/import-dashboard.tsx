'use client';

import { Card } from '@harness/ui';
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
};

const StatCard = ({ icon, label, value, detail }: StatCardProps) => (
  <Card className='flex items-center gap-3 px-4 py-3'>
    <div className='text-muted-foreground'>{icon}</div>
    <div className='flex flex-col gap-0'>
      <span className='text-lg font-semibold tabular-nums'>{value}</span>
      <span className='text-[10px] text-muted-foreground uppercase tracking-wide'>{label}</span>
      {detail && <span className='text-[10px] text-muted-foreground'>{detail}</span>}
    </div>
  </Card>
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
      <div className='grid grid-cols-3 gap-3 animate-pulse'>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className='h-20 rounded-lg bg-muted' />
        ))}
      </div>
    );
  }

  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
      <StatCard
        icon={<Users className='h-4 w-4' />}
        label='Characters'
        value={stats.characters.active}
        detail={stats.characters.total !== stats.characters.active ? `${stats.characters.total} total` : undefined}
      />
      <StatCard
        icon={<FileText className='h-4 w-4' />}
        label='Transcripts'
        value={stats.transcripts.total}
        detail={stats.transcripts.pending > 0 ? `${stats.transcripts.processed} processed, ${stats.transcripts.pending} pending` : 'all processed'}
      />
      <StatCard
        icon={<BookOpen className='h-4 w-4' />}
        label='Moments'
        value={stats.moments.active}
        detail={stats.moments.deleted > 0 ? `${stats.moments.deleted} merged/deleted` : undefined}
      />
      <StatCard
        icon={<GitBranch className='h-4 w-4' />}
        label='Arcs'
        value={stats.arcs.total}
        detail={stats.arcs.totalLinkedMoments > 0 ? `${stats.arcs.totalLinkedMoments} linked moments` : undefined}
      />
      <StatCard icon={<MapPin className='h-4 w-4' />} label='Locations' value={stats.locations} />
      <StatCard icon={<MessageSquare className='h-4 w-4' />} label='Annotations' value={stats.annotations} />
    </div>
  );
};
