'use client';

import { Badge, Button, cn, Textarea } from '@harness/ui';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { WsContext } from '@/app/_components/ws-provider';
import { sendMessage } from '@/app/(chat)/chat/_actions/send-message';
import { clearThreadMessages } from '../../_actions/clear-thread-messages';
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
      prompt: `Here are the uploaded transcripts for this story:\n${transcriptList}\n\nFor each transcript, call mcp__harness__storytelling__import_transcript with the transcript ID to extract characters and moments. Start with the first unprocessed one${unprocessedIds.length > 0 ? ` (ID: ${unprocessedIds[0]})` : ''}. Report what characters you find after each one.`,
    },
    {
      label: 'Process All',
      prompt: `Here are the uploaded transcripts:\n${transcriptList}\n\n${unprocessed.length > 0 ? `Process these unprocessed transcripts in order using mcp__harness__storytelling__import_transcript:\n${unprocessed.map((t) => `- ${t.label}: ${t.id}`).join('\n')}\n\nCall the tool once for each ID. Report progress after each.` : 'All transcripts are already processed.'}`,
    },
    {
      label: 'Find Duplicates',
      prompt:
        'Use mcp__harness__storytelling__detect_duplicates to find duplicate moments across the story. Present results with recommendations on which to merge.',
    },
    {
      label: 'Discover Arcs',
      prompt:
        'Use mcp__harness__storytelling__discover_arc_moments to find narrative arcs from the extracted moments. Look for character development, recurring themes, and story progression.',
    },
  ];
};

export const WorkspaceChatPanel = ({ storyId: _storyId, threadId, transcripts: initialTranscripts }: WorkspaceChatPanelProps) => {
  const [transcripts, setTranscripts] = useState(initialTranscripts);
  const quickActions = buildQuickActions(transcripts);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [_processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const { selection } = useWorkspaceSelection();

  // Refresh transcript processed status
  const loadTranscripts = useCallback(async () => {
    const res = await fetch(`/api/stories/${_storyId}/transcripts`);
    if (res.ok) {
      const data = await res.json();
      setTranscripts(data.transcripts ?? []);
    }
  }, [_storyId]);

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

  // WebSocket for live pipeline status
  const [pipelineStep, setPipelineStep] = useState<string | null>(null);
  const wsCtx = useContext(WsContext);
  useEffect(() => {
    if (!wsCtx) {
      return;
    }
    const stepLabels: Record<string, string> = {
      onMessage: 'Received message...',
      onBeforeInvoke: 'Preparing prompt...',
      invoking: 'Claude is thinking...',
      onAfterInvoke: 'Processing response...',
    };
    const unsubStep = wsCtx.subscribe('pipeline:step', (data) => {
      const d = data as { threadId?: string; step?: string };
      if (d.threadId === threadId) {
        setPipelineStep(stepLabels[d.step ?? ''] ?? d.step ?? null);
      }
    });
    const unsubComplete = wsCtx.subscribe('pipeline:complete', (data) => {
      const d = data as { threadId?: string };
      if (d.threadId === threadId) {
        setIsProcessing(false);
        setPipelineStep(null);
        loadMessages();
        loadTranscripts();
      }
    });
    const unsubError = wsCtx.subscribe('pipeline:error', (data) => {
      const d = data as { threadId?: string; error?: string };
      if (d.threadId === threadId) {
        setIsProcessing(false);
        setPipelineStep(null);
        loadMessages();
        loadTranscripts();
      }
    });
    return () => {
      unsubStep();
      unsubComplete();
      unsubError();
    };
  }, [wsCtx, threadId, loadMessages, loadTranscripts]);

  // Clear chat
  const handleClear = useCallback(() => {
    startTransition(async () => {
      const result = await clearThreadMessages({ threadId, storyId: _storyId });
      if ('success' in result) {
        setMessages([]);
        prevMessageCountRef.current = 0;
        setIsProcessing(false);
        setPipelineStep(null);
      }
    });
  }, [threadId, _storyId]);

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
        <span className='flex-1 text-xs font-medium'>AI Assistant</span>
        {isPending && <Loader2 className='h-3 w-3 animate-spin text-muted-foreground' />}
        {messages.length > 0 && (
          <Button
            variant='ghost'
            size='icon'
            className='h-6 w-6 p-0 text-muted-foreground'
            title='Clear chat history'
            onClick={handleClear}
            disabled={isPending}
          >
            <Trash2 className='h-3 w-3' />
          </Button>
        )}
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
            {pipelineStep ?? 'Starting pipeline...'}
            {elapsedSeconds > 0 && ` (${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')})`}
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
            .filter((m) => m.kind === 'text' || (m.kind === 'status' && m.content.startsWith('Pipeline error:')))
            .map((msg) => {
              const isError = msg.kind === 'status';
              return (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg px-3 py-2',
                    isError ? 'bg-red-500/10 border border-red-500/20 mr-8' : msg.role === 'user' ? 'bg-blue-500/10 ml-8' : 'bg-muted/50 mr-8',
                  )}
                >
                  <span className='text-[10px] font-medium text-muted-foreground'>
                    {isError ? 'Error' : msg.role === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <p className='text-xs whitespace-pre-wrap wrap-break-word'>{isError ? msg.content.replace('Pipeline error: ', '') : msg.content}</p>
                </div>
              );
            })}
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
