'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@harness/ui';
import { Bot, Check, ChevronDown } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { listAgents } from '../_actions/list-agents';
import { updateThreadAgent } from '../_actions/update-thread-agent';

type Agent = {
  id: string;
  name: string;
};

type AgentSelectorProps = {
  threadId: string | null;
  currentAgentId: string | null;
  currentAgentName: string | null;
  onAgentChange?: (agentId: string, agentName: string) => void;
};

type AgentSelectorComponent = (props: AgentSelectorProps) => React.ReactNode;

export const AgentSelector: AgentSelectorComponent = ({ threadId, currentAgentId, currentAgentName, onAgentChange }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAgents().then((result) => {
      if (!cancelled) {
        setAgents(result.filter((a) => a.enabled).map((a) => ({ id: a.id, name: a.name })));
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (agent: Agent) => {
    if (onAgentChange) {
      onAgentChange(agent.id, agent.name);
      return;
    }
    if (threadId) {
      startTransition(async () => {
        await updateThreadAgent(threadId, agent.id);
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending || !loaded}
        className='flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
        aria-label='Select agent'
      >
        <Bot className='h-3 w-3' />
        {currentAgentName ?? 'Select agent'}
        <ChevronDown className='h-3 w-3' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' side='top' className='w-36'>
        {agents.map((agent) => (
          <DropdownMenuItem key={agent.id} onClick={() => handleSelect(agent)} className='flex items-center justify-between text-xs'>
            <span>{agent.name}</span>
            {currentAgentId === agent.id && <Check className='h-3 w-3 shrink-0' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
