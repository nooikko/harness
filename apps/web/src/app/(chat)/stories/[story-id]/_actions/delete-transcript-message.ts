'use server';

import { prisma } from '@harness/database';
import { revalidatePath } from 'next/cache';
import { logServerError } from '@/lib/log-server-error';
import { parseTranscriptMessages, serializeTranscriptMessages } from '../_helpers/parse-transcript-messages';

type DeleteTranscriptMessageInput = {
  transcriptId: string;
  storyId: string;
  messageIndex: number;
};

type DeleteTranscriptMessageResult = { success: true } | { error: string };

type DeleteTranscriptMessage = (input: DeleteTranscriptMessageInput) => Promise<DeleteTranscriptMessageResult>;

export const deleteTranscriptMessage: DeleteTranscriptMessage = async (input) => {
  if (!input.transcriptId?.trim()) {
    return { error: 'Transcript ID is required' };
  }
  if (!input.storyId?.trim()) {
    return { error: 'Story ID is required' };
  }
  if (typeof input.messageIndex !== 'number' || input.messageIndex < 0) {
    return { error: 'Valid message index is required' };
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

    const updated = messages.filter((m) => m.index !== input.messageIndex);
    const reindexed = updated.map((m, i) => ({ ...m, index: i }));

    await prisma.storyTranscript.update({
      where: { id: input.transcriptId },
      data: { rawContent: serializeTranscriptMessages(reindexed) },
    });

    await prisma.transcriptAnnotation.deleteMany({
      where: {
        transcriptId: input.transcriptId,
        messageIndex: input.messageIndex,
      },
    });

    await prisma.$executeRaw`
      UPDATE "TranscriptAnnotation"
      SET "messageIndex" = "messageIndex" - 1
      WHERE "transcriptId" = ${input.transcriptId}
      AND "messageIndex" > ${input.messageIndex}
    `;

    revalidatePath(`/stories/${input.storyId}/workspace`);
    return { success: true };
  } catch (err) {
    logServerError({
      action: 'deleteTranscriptMessage',
      error: err,
      context: { transcriptId: input.transcriptId },
    });
    return { error: 'Failed to delete message' };
  }
};
