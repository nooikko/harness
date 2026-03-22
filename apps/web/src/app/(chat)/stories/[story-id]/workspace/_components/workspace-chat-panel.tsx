'use client';

import { Badge, Button, cn, ScrollArea, Textarea } from '@harness/ui';
import { Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { sendMessage } from '@/app/(chat)/chat/_actions/send-message';
import { useWorkspaceSelection } from './workspace-context';

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  kind: string;
  createdAt: string;
};

type WorkspaceChatPanelProps = {
  storyId: string;
  threadId: string;
};

export const WorkspaceChatPanel = ({ storyId: _storyId, threadId }: WorkspaceChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { selection } = useWorkspaceSelection();

  // Load chat messages
  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?threadId=${threadId}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
  }, [threadId]);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 3 seconds (simple approach; WebSocket is better)
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (!input.trim()) {
      return;
    }

    // Build context-enriched message
    let enrichedInput = input;

    if (selection.messageContent && selection.messageIndex !== null) {
      const selectedPart = selection.selectedText ? `Selected text: "${selection.selectedText}"\n\n` : '';
      enrichedInput = `${selectedPart}[Context: Message #${selection.messageIndex} from the transcript]\n"${selection.messageContent.slice(0, 500)}"\n\n${input}`;
    }

    startTransition(async () => {
      await sendMessage(threadId, enrichedInput);
      setInput('');
      // Reload messages after a short delay for the pipeline to process
      setTimeout(loadMessages, 1000);
      setTimeout(loadMessages, 3000);
      setTimeout(loadMessages, 8000);
    });
  }, [input, threadId, selection, loadMessages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className='flex h-full flex-col'>
      {/* Chat header */}
      <div className='flex items-center gap-2 border-b px-3 py-2'>
        <span className='text-xs font-medium'>AI Assistant</span>
        {isPending && <Loader2 className='h-3 w-3 animate-spin text-muted-foreground' />}
      </div>

      {/* Selection context indicator */}
      {selection.messageIndex !== null && (
        <div className='flex items-center gap-2 border-b bg-blue-500/5 px-3 py-1.5'>
          <Badge variant='outline' className='text-[10px]'>
            Msg #{selection.messageIndex}
          </Badge>
          {selection.selectedText && <span className='text-[10px] text-muted-foreground truncate'>"{selection.selectedText.slice(0, 50)}"</span>}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className='flex-1' ref={scrollRef}>
        <div className='flex flex-col gap-2 p-3'>
          {messages.length === 0 && (
            <div className='py-8 text-center text-xs text-muted-foreground'>
              This is your import assistant. Upload transcripts, then ask me to scan them, find characters, extract moments, or search for specific
              content.
            </div>
          )}
          {messages
            .filter((m) => m.kind === 'text')
            .map((msg) => (
              <div
                key={msg.id}
                className={cn('flex flex-col gap-1 rounded-lg px-3 py-2', msg.role === 'user' ? 'bg-blue-500/10 ml-8' : 'bg-muted/50 mr-8')}
              >
                <span className='text-[10px] font-medium text-muted-foreground'>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                <p className='text-xs whitespace-pre-wrap break-words'>{msg.content}</p>
              </div>
            ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className='border-t p-3'>
        <div className='flex gap-2'>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ask about the transcripts, or select a message and ask here...'
            rows={2}
            className='flex-1 text-xs resize-none'
          />
          <Button size='sm' className='h-auto self-end' onClick={handleSend} disabled={isPending || !input.trim()}>
            <Send className='h-3 w-3' />
          </Button>
        </div>
      </div>
    </div>
  );
};
