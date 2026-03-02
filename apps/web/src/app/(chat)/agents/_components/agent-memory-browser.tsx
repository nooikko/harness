'use client';

import type { MemoryType } from '@harness/database';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteAgentMemory } from '../../chat/_actions/delete-agent-memory';

type MemoryEntry = {
  id: string;
  content: string;
  type: MemoryType;
  importance: number;
  threadId: string | null;
  createdAt: Date;
  lastAccessedAt: Date;
};

type AgentMemoryBrowserProps = {
  agentId: string;
  memories: MemoryEntry[];
};

type FilterTab = 'ALL' | MemoryType;

const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  EPISODIC: 'Episodic',
  SEMANTIC: 'Semantic',
  REFLECTION: 'Reflection',
};

const IMPORTANCE_COLOR = (importance: number): string => {
  if (importance >= 9) {
    return 'text-red-600 dark:text-red-400';
  }
  if (importance >= 7) {
    return 'text-orange-600 dark:text-orange-400';
  }
  if (importance >= 5) {
    return 'text-yellow-600 dark:text-yellow-400';
  }
  return 'text-muted-foreground';
};

const formatRelativeDate = (date: Date): string => {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) {
    return 'just now';
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return new Date(date).toLocaleDateString();
};

type AgentMemoryBrowserComponent = (props: AgentMemoryBrowserProps) => React.ReactNode;

export const AgentMemoryBrowser: AgentMemoryBrowserComponent = ({ agentId, memories }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = activeFilter === 'ALL' ? memories : memories.filter((m) => m.type === activeFilter);

  const handleDelete = (memoryId: string) => {
    if (confirmDeleteId !== memoryId) {
      setConfirmDeleteId(memoryId);
      return;
    }
    setDeletingId(memoryId);
    setConfirmDeleteId(null);
    startTransition(async () => {
      await deleteAgentMemory(memoryId, agentId);
      setDeletingId(null);
      router.refresh();
    });
  };

  const tabs: FilterTab[] = ['ALL', 'EPISODIC', 'SEMANTIC', 'REFLECTION'];
  const counts: Record<FilterTab, number> = {
    ALL: memories.length,
    EPISODIC: memories.filter((m) => m.type === 'EPISODIC').length,
    SEMANTIC: memories.filter((m) => m.type === 'SEMANTIC').length,
    REFLECTION: memories.filter((m) => m.type === 'REFLECTION').length,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        {/* Filter tabs */}
        <div className='flex gap-1 border-b'>
          {tabs.map((tab) => (
            <button
              key={tab}
              type='button'
              onClick={() => setActiveFilter(tab)}
              className={[
                'px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeFilter === tab ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab === 'ALL' ? 'All' : MEMORY_TYPE_LABELS[tab]}
              <span className='ml-1.5 text-xs text-muted-foreground'>{counts[tab]}</span>
            </button>
          ))}
        </div>

        {/* Memory list */}
        {filtered.length === 0 ? (
          <p className='py-8 text-center text-sm text-muted-foreground'>
            {memories.length === 0 ? 'No memories yet. Memories accumulate as the agent interacts.' : `No ${activeFilter.toLowerCase()} memories.`}
          </p>
        ) : (
          <ul className='flex flex-col divide-y'>
            {filtered.map((memory) => (
              <li key={memory.id} className='flex gap-3 py-3 first:pt-0 last:pb-0'>
                {/* Importance indicator */}
                <div className='flex flex-col items-center gap-1 pt-0.5 w-8 shrink-0'>
                  <span className={`text-sm font-bold tabular-nums ${IMPORTANCE_COLOR(memory.importance)}`}>{memory.importance}</span>
                  <span className='text-[10px] text-muted-foreground leading-none'>imp</span>
                </div>

                {/* Content */}
                <div className='flex-1 flex flex-col gap-1 min-w-0'>
                  <p className='text-sm leading-snug line-clamp-3'>{memory.content}</p>
                  <div className='flex items-center gap-2'>
                    <Badge variant='outline' className='text-[10px] px-1.5 py-0'>
                      {MEMORY_TYPE_LABELS[memory.type]}
                    </Badge>
                    <span className='text-xs text-muted-foreground'>{formatRelativeDate(memory.createdAt)}</span>
                    {memory.threadId && (
                      <span className='text-xs text-muted-foreground font-mono truncate max-w-[120px]'>{memory.threadId.slice(0, 8)}…</span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <div className='shrink-0'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    disabled={isPending && deletingId === memory.id}
                    onClick={() => handleDelete(memory.id)}
                    className={confirmDeleteId === memory.id ? 'text-destructive hover:text-destructive' : ''}
                  >
                    {deletingId === memory.id ? 'Deleting…' : confirmDeleteId === memory.id ? 'Confirm' : 'Delete'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
