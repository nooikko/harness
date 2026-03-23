'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';
import { parseTranscriptMessages, serializeTranscriptMessages } from '../_helpers/parse-transcript-messages';

type EditTranscriptMessageInput = {
  transcriptId: string;
  storyId: string;
  messageIndex: number;
  newContent: string;
};

type EditTranscriptMessageResult = { success: true } | { error: string };

type EditTranscriptMessage = (input: EditTranscriptMessageInput) => Promise<EditTranscriptMessageResult>;

export const editTranscriptMessage: EditTranscriptMessage = async (input) => {
  if (!input.transcriptId?.trim()) {
    return { error: 'Transcript ID is required' };
  }
  if (!input.storyId?.trim()) {
    return { error: 'Story ID is required' };
  }
  if (typeof input.messageIndex !== 'number' || input.messageIndex < 0) {
    return { error: 'Valid message index is required' };
  }
  if (!input.newContent?.trim()) {
    return { error: 'New content is required' };
  }

  try {
    const transcript = await prisma.storyTranscript.findUnique({
      where: { id: input.transcriptId },
      select: { rawContent: true },
    });
    if (!transcript) {
      return { error: 'Transcript not found' };
    }

    const messages = parseTranscriptMessages(transcript.rawContent);
    if (input.messageIndex >= messages.length) {
      return { error: 'Message index out of range' };
    }

    const updated = messages.map((m) => (m.index === input.messageIndex ? { ...m, content: input.newContent.trim() } : m));

    await prisma.storyTranscript.update({
      where: { id: input.transcriptId },
      data: { rawContent: serializeTranscriptMessages(updated) },
    });

    revalidatePath(`/stories/${input.storyId}/workspace`);
    return { success: true };
  } catch (err) {
    logServerError({
      action: 'editTranscriptMessage',
      error: err,
      context: { transcriptId: input.transcriptId },
    });
    return { error: 'Failed to edit message' };
  }
};
