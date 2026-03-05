'use client';

import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from '@harness/ui';
import { Bot, Check, ChevronDown } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { listAgents } from '../_actions/list-agents';
import { updateThreadAgent } from '../_actions/update-thread-agent';

type Agent = {
  id: string;
  name: string;
};

type AgentSelectorProps = {
  threadId: string;
  currentAgentId: string | null;
  currentAgentName: string | null;
};

type AgentSelectorComponent = (props: AgentSelectorProps) => React.ReactNode;

export const AgentSelector: AgentSelectorComponent = ({ threadId, currentAgentId, currentAgentName }) => {
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      const result = await listAgents();
      if (!cancelled) {
        setAgents(result.filter((a) => a.enabled).map((a) => ({ id: a.id, name: a.name })));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSelect = (agentId: string) => {
    setOpen(false);
    startTransition(async () => {
      await updateThreadAgent(threadId, agentId);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={isPending}
        className='flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
        aria-label='Select agent'
      >
        <Bot className='h-3 w-3' />
        {currentAgentName ?? 'Select agent'}
        <ChevronDown className='h-3 w-3' />
      </PopoverTrigger>
      <PopoverContent align='start' side='top' className='w-52 p-0'>
        <Command className='[&_[data-slot=command-input-wrapper]_svg]:hidden'>
          <CommandInput placeholder='Search agents...' className='h-8 text-xs' />
          <CommandList>
            <CommandEmpty>No agents found.</CommandEmpty>
            {agents.map((agent) => (
              <CommandItem key={agent.id} value={agent.name} onSelect={() => handleSelect(agent.id)} className='text-xs'>
                <span className='flex-1'>{agent.name}</span>
                {currentAgentId === agent.id && <Check className='h-3 w-3 shrink-0' />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
