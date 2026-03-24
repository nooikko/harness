'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { createThread } from '../_actions/create-thread';
import { sendMessage } from '../_actions/send-message';
import { ChatInput } from './chat-input';

type NewChatAreaComponent = () => React.ReactNode;

export const NewChatArea: NewChatAreaComponent = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Local selections — applied when thread is created
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const handleAgentChange = useCallback((agentId: string, agentName: string) => {
    setSelectedAgentId(agentId);
    setSelectedAgentName(agentName);
  }, []);

  const handleModelChange = useCallback((model: string | null) => {
    setSelectedModel(model);
  }, []);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isPending) {
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
    },
    [isPending, selectedAgentId, selectedModel, router],
  );

  return (
    <ChatInput
      threadId={null}
      currentModel={selectedModel}
      currentAgentId={selectedAgentId}
      currentAgentName={selectedAgentName}
      currentEffort={null}
      currentPermissionMode={null}
      onSubmitAction={handleSubmit}
      onAgentChange={handleAgentChange}
      onModelChange={handleModelChange}
      disabled={isPending}
      error={error}
    />
  );
};
