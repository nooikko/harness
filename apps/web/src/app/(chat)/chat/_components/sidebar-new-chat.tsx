'use client';

import { Button } from '@harness/ui';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createThread } from '../_actions/create-thread';
import { listAgents } from '../_actions/list-agents';

type AgentOption = {
  id: string;
  name: string;
  enabled: boolean;
};

type SidebarNewChatComponent = () => React.ReactNode;

export const SidebarNewChat: SidebarNewChatComponent = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listAgents().then((list) => {
      setAgents(list.filter((a) => a.enabled));
    });
  }, []);

  useEffect(() => {
    if (!showPicker) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const handleCreate = (agentId?: string) => {
    setShowPicker(false);
    startTransition(async () => {
      const { threadId } = await createThread({
        agentId: agentId || undefined,
      });
      router.push(`/chat/${threadId}`);
    });
  };

  const handleClick = () => {
    if (agents.length === 0) {
      handleCreate();
      return;
    }
    setShowPicker((prev) => !prev);
  };

  return (
    <div className='relative' ref={pickerRef}>
      <Button variant='ghost' onClick={handleClick} disabled={isPending} className='w-full justify-start gap-2 text-sm font-normal'>
        <Plus className='h-4 w-4' />
        <span>New chat</span>
      </Button>

      {showPicker && (
        <div className='absolute left-0 top-full z-50 mt-1 w-full min-w-[180px] rounded-md border border-border bg-popover shadow-md'>
          <div className='flex flex-col gap-0.5 p-1'>
            <button
              type='button'
              onClick={() => handleCreate()}
              className='flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground'
            >
              No agent
            </button>
            <div className='my-0.5 border-t border-border' />
            {agents.map((agent) => (
              <button
                key={agent.id}
                type='button'
                onClick={() => handleCreate(agent.id)}
                className='flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground'
              >
                {agent.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
