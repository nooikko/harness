'use client';

import { SidebarMenuButton } from '@harness/ui';
import { ChevronDown, MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createThread } from '../_actions/create-thread';
import { listAgents } from '../_actions/list-agents';

type AgentOption = {
  id: string;
  name: string;
  enabled: boolean;
};

type NewThreadButtonComponent = () => React.ReactNode;

export const NewThreadButton: NewThreadButtonComponent = () => {
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

  // Close picker on outside click
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
      const { threadId } = await createThread({ agentId: agentId || undefined });
      router.push(`/chat/${threadId}`);
    });
  };

  const handleMainClick = () => {
    if (agents.length === 0) {
      handleCreate();
      return;
    }
    setShowPicker((prev) => !prev);
  };

  return (
    <div className='relative w-full' ref={pickerRef}>
      <SidebarMenuButton onClick={handleMainClick} disabled={isPending} className='gap-2 w-full'>
        <MessageSquarePlus className='h-4 w-4 shrink-0' />
        <span className='flex-1 text-left'>New Chat</span>
        {agents.length > 0 && (
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
        )}
      </SidebarMenuButton>

      {showPicker && (
        <div className='absolute left-0 top-full z-50 mt-1 w-full min-w-[180px] rounded-md border border-border bg-popover shadow-md'>
          <div className='p-1 flex flex-col gap-0.5'>
            <button
              type='button'
              onClick={() => handleCreate()}
              className='flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors'
            >
              No agent
            </button>
            <div className='my-0.5 border-t border-border' />
            {agents.map((agent) => (
              <button
                key={agent.id}
                type='button'
                onClick={() => handleCreate(agent.id)}
                className='flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors'
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
