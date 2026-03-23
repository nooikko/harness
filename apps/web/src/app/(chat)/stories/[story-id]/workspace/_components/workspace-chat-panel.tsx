'use client';

import { Badge, Button, cn, Textarea } from '@harness/ui';
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

type TranscriptInfo = {
  id: string;
  label: string;
  processed: boolean;
  sortOrder: number;
};

type WorkspaceChatPanelProps = {
  storyId: string;
  threadId: string;
  transcripts: TranscriptInfo[];
};

type QuickAction = {
  label: string;
  prompt: string;
};

type BuildQuickActions = (transcripts: TranscriptInfo[]) => QuickAction[];

const buildQuickActions: BuildQuickActions = (transcripts) => {
  const transcriptList = transcripts.map((t) => `- "${t.label}" (ID: ${t.id}, processed: ${t.processed})`).join('\n');
  const unprocessed = transcripts.filter((t) => !t.processed);
  const unprocessedIds = unprocessed.map((t) => t.id);

  return [
    {
      label: 'Scan Characters',
      prompt: `Here are the uploaded transcripts for this story:\n${transcriptList}\n\nFor each transcript, call storytelling__import_transcript with the transcript ID to extract characters and moments. Start with the first unprocessed one${unprocessedIds.length > 0 ? ` (ID: ${unprocessedIds[0]})` : ''}. Report what characters you find after each one.`,
    },
    {
      label: 'Process All',
      prompt: `Here are the uploaded transcripts:\n${transcriptList}\n\n${unprocessed.length > 0 ? `Process these unprocessed transcripts in order using storytelling__import_transcript:\n${unprocessed.map((t) => `- ${t.label}: ${t.id}`).join('\n')}\n\nCall the tool once for each ID. Report progress after each.` : 'All transcripts are already processed.'}`,
    },
    {
      label: 'Find Duplicates',
      prompt:
        'Use storytelling__detect_duplicates to find duplicate moments across the story. Present results with recommendations on which to merge.',
    },
    {
      label: 'Discover Arcs',
      prompt:
        'Use storytelling__discover_arc_moments to find narrative arcs from the extracted moments. Look for character development, recurring themes, and story progression.',
    },
  ];
};

export const WorkspaceChatPanel = ({ storyId: _storyId, threadId, transcripts: transcriptList }: WorkspaceChatPanelProps) => {
  const quickActions = buildQuickActions(transcriptList);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [_processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const { selection } = useWorkspaceSelection();

  // Load chat messages
  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/messages?threadId=${threadId}&limit=50`);
    if (res.ok) {
      const data = await res.json();
      const incoming: ChatMessage[] = data.messages ?? [];
      setMessages(incoming);

      // Detect new assistant message to clear processing state
      const assistantCount = incoming.filter((m) => m.kind === 'text' && m.role === 'assistant').length;
      const prevAssistantCount = prevMessageCountRef.current;
      if (assistantCount > prevAssistantCount && prevAssistantCount > 0) {
        setIsProcessing(false);
      }
      prevMessageCountRef.current = assistantCount;
    }
  }, [threadId]);

  // Adaptive polling: fast when processing, slow when idle
  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, isProcessing ? 1000 : 5000);
    return () => clearInterval(interval);
  }, [loadMessages, isProcessing]);

  // Elapsed time counter while processing
  useEffect(() => {
    if (isProcessing) {
      setProcessingStartedAt(Date.now());
      setElapsedSeconds(0);
      const timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
    setProcessingStartedAt(null);
    setElapsedSeconds(0);
  }, [isProcessing]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Shared send helper — accepts the final prompt string
  const sendToThread = useCallback(
    (prompt: string) => {
      setIsProcessing(true);
      startTransition(async () => {
        await sendMessage(threadId, prompt);
        // Reload once immediately for the user message echo
        setTimeout(loadMessages, 500);
      });
    },
    [threadId, loadMessages],
  );

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

    sendToThread(enrichedInput);
    setInput('');
  }, [input, selection, sendToThread]);

  const sendQuickAction = useCallback(
    (prompt: string) => {
      sendToThread(prompt);
    },
    [sendToThread],
  );

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

      {/* Quick actions */}
      <div className='flex items-center gap-1.5 border-b px-3 py-2 overflow-x-auto'>
        <span className='text-[10px] text-muted-foreground shrink-0'>Quick:</span>
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant='outline'
            size='sm'
            className='h-6 text-[10px] shrink-0'
            disabled={isProcessing || isPending}
            onClick={() => sendQuickAction(action.prompt)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className='flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b'>
          <Loader2 className='h-3 w-3 animate-spin text-muted-foreground shrink-0' />
          <span className='text-[10px] text-muted-foreground'>
            {(() => {
              const statusMsgs = messages.filter((m) => m.kind === 'pipeline_step' || m.kind === 'status');
              const latest = statusMsgs[statusMsgs.length - 1];
              const stepLabels: Record<string, string> = {
                onMessage: 'Received message...',
                onBeforeInvoke: 'Preparing prompt...',
                invoking: 'Claude is thinking...',
                onAfterInvoke: 'Processing response...',
                'Pipeline started': 'Starting pipeline...',
                'Pipeline completed': 'Done',
              };
              const label = latest ? (stepLabels[latest.content] ?? latest.content) : 'Processing...';
              const elapsed = elapsedSeconds > 0 ? ` (${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')})` : '';
              return `${label}${elapsed}`;
            })()}
          </span>
          {elapsedSeconds > 60 && (
            <Button variant='ghost' size='sm' className='h-5 shrink-0 text-[10px] text-muted-foreground' onClick={() => setIsProcessing(false)}>
              Dismiss
            </Button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className='min-h-0 flex-1 overflow-y-auto' ref={scrollRef}>
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
      </div>

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
