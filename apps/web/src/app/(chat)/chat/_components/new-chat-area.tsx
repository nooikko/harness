'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@harness/ui';
import { Bot, Check, ChevronDown, SendHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createThread } from '../_actions/create-thread';
import { listAgents } from '../_actions/list-agents';
import { sendMessage } from '../_actions/send-message';
import { MODEL_OPTIONS } from '../_helpers/model-options';

type Agent = {
  id: string;
  name: string;
};

const getModelLabel = (model: string | null): string => {
  if (!model) {
    return 'Haiku';
  }
  const option = MODEL_OPTIONS.find((o) => o.value === model);
  return option?.label ?? model;
};

type NewChatAreaComponent = () => React.ReactNode;

export const NewChatArea: NewChatAreaComponent = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Local selections — applied when thread is created
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Load agents on mount
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let cancelled = false;
    listAgents().then((result) => {
      if (!cancelled) {
        setAgents(result.filter((a) => a.enabled).map((a) => ({ id: a.id, name: a.name })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = () => {
    const text = textareaRef.current?.value.trim();
    if (!text || isPending) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const { threadId } = await createThread({
        agentId: selectedAgentId ?? undefined,
        model: selectedModel ?? undefined,
      });
      const result = await sendMessage(threadId, text);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push(`/chat/${threadId}`);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className='mx-auto w-full max-w-4xl bg-background px-4 pb-4 pt-3 sm:px-6'>
      {error && <p className='mb-2 text-xs text-destructive'>{error}</p>}
      <div className='rounded-xl border border-border bg-background'>
        <div className='px-3 pt-2 pb-1'>
          <textarea
            ref={textareaRef}
            className='max-h-34 min-h-10 w-full resize-none overflow-y-auto bg-transparent text-sm outline-none placeholder:text-muted-foreground focus:placeholder:text-transparent'
            placeholder='Send a message to start a new chat…'
            onKeyDown={handleKeyDown}
            disabled={isPending}
            rows={1}
          />
        </div>
        <div className='flex items-center justify-between px-3 pb-2'>
          <div className='flex items-center gap-2'>
            {/* Agent selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className='flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
                aria-label='Select agent'
              >
                <Bot className='h-3 w-3' />
                {selectedAgentName ?? 'Select agent'}
                <ChevronDown className='h-3 w-3' />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start' side='top' className='w-36'>
                {agents.map((agent) => (
                  <DropdownMenuItem
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setSelectedAgentName(agent.name);
                    }}
                    className='flex items-center justify-between text-xs'
                  >
                    <span>{agent.name}</span>
                    {selectedAgentId === agent.id && <Check className='h-3 w-3 shrink-0' />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Model selector */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className='flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
                aria-label='Select model'
              >
                {getModelLabel(selectedModel)}
                <ChevronDown className='h-3 w-3' />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start' side='top' className='w-36'>
                {MODEL_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setSelectedModel(opt.value || null)}
                    className='flex items-center justify-between text-xs'
                  >
                    <span>
                      {opt.label}
                      {opt.description ? <span className='ml-1 text-muted-foreground'>({opt.description})</span> : null}
                    </span>
                    {(selectedModel ?? '') === opt.value && <Check className='h-3 w-3 shrink-0' />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button type='button' size='icon' className='h-7 w-7' disabled={isPending} onClick={handleSubmit} aria-label='Send message'>
            <SendHorizontal className='h-3.5 w-3.5' />
          </Button>
        </div>
      </div>
      <p className='mt-1 text-[10px] text-muted-foreground/40'>Enter to send · Shift+Enter for new line</p>
    </div>
  );
};
