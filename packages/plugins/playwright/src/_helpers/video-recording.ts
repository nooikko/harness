import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { closePageForThread, getPage, getPageWithRecording, isRecordingActive } from './browser-manager';
import { ensureTraceDir } from './temp-tracker';

/** Tracks video output directories per thread for retrieval after recording stops. */
const videoDirs = new Map<string, string>();

type StartRecording = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const startRecording: StartRecording = async (_ctx, _input, meta) => {
  if (isRecordingActive(meta.threadId)) {
    return 'Recording is already active on this thread. Call stop_recording first.';
  }

  try {
    // Get current page URL before closing
    let currentUrl = 'about:blank';
    try {
      const currentPage = await getPage(meta.threadId);
      currentUrl = currentPage.url();
    } catch {
      // No existing page — that's fine
    }

    const traceId = meta.traceId ?? 'unknown';
    const videoDir = join(ensureTraceDir(traceId), 'videos');
    videoDirs.set(meta.threadId, videoDir);

    // Create a new context with video recording (closes existing context first)
    const page = await getPageWithRecording(meta.threadId, { videoDir });

    // Navigate back to where we were
    if (currentUrl && currentUrl !== 'about:blank') {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    }

    return [
      'Video recording started.',
      currentUrl !== 'about:blank' ? `Navigated back to: ${currentUrl}` : '',
      '',
      'Recording captures all page activity. Call stop_recording when done to save the video as a file attachment.',
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    videoDirs.delete(meta.threadId);
    return `Error starting recording: ${err instanceof Error ? err.message : String(err)}`;
  }
};

type StopRecording = (ctx: PluginContext, input: Record<string, unknown>, meta: PluginToolMeta) => Promise<string>;

export const stopRecording: StopRecording = async (ctx, _input, meta) => {
  const videoDir = videoDirs.get(meta.threadId);
  if (!videoDir || !isRecordingActive(meta.threadId)) {
    return 'No active recording on this thread. Call start_recording first.';
  }

  try {
    // Close the context to finalize the video file
    await closePageForThread(meta.threadId);
    videoDirs.delete(meta.threadId);

    // Find the .webm file Playwright created
    const videoPath = findVideoFile(videoDir);
    if (!videoPath) {
      return 'Recording stopped but no video file was produced. The recording may have been too short.';
    }

    // Read and upload the video
    const buffer = await readFile(videoPath);
    const filename = `recording-${Date.now()}.webm`;
    const { fileId } = await ctx.uploadFile({
      filename,
      buffer,
      mimeType: 'video/webm',
      scope: 'THREAD',
      threadId: meta.threadId,
    });

    return [
      `Video recording saved: ${filename} (file ID: ${fileId})`,
      `Size: ${(buffer.byteLength / 1024).toFixed(1)} KB`,
      '',
      'The video has been persisted as a file attachment on this thread and will be visible in the chat UI.',
    ].join('\n');
  } catch (err) {
    videoDirs.delete(meta.threadId);
    return `Error stopping recording: ${err instanceof Error ? err.message : String(err)}`;
  }
};

/** Safety net: if the agent forgot to call stop_recording, finalize and upload the video.
 *  Must be called BEFORE cleanupTrace (which deletes the trace dir) and BEFORE closePageForThread. */
type CleanupRecordingState = (threadId: string, ctx: PluginContext) => Promise<void>;

export const cleanupRecordingState: CleanupRecordingState = async (threadId, ctx) => {
  const videoDir = videoDirs.get(threadId);
  if (!videoDir || !isRecordingActive(threadId)) {
    videoDirs.delete(threadId);
    return;
  }

  try {
    // Close context to finalize the video file
    await closePageForThread(threadId);
    videoDirs.delete(threadId);

    const videoPath = findVideoFile(videoDir);
    if (!videoPath) {
      return;
    }

    const buffer = await readFile(videoPath);
    const filename = `recording-auto-${Date.now()}.webm`;
    await ctx.uploadFile({
      filename,
      buffer,
      mimeType: 'video/webm',
      scope: 'THREAD',
      threadId,
    });

    ctx.logger.info(`playwright: auto-saved abandoned recording for thread ${threadId}`);
  } catch (err) {
    ctx.logger.warn(`playwright: failed to auto-save recording for thread ${threadId}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    videoDirs.delete(threadId);
  }
};

// --- Internal helpers ---

type FindVideoFile = (dir: string) => string | null;

const findVideoFile: FindVideoFile = (dir) => {
  try {
    const files = readdirSync(dir);
    const webm = files.find((f) => f.endsWith('.webm'));
    return webm ? join(dir, webm) : null;
  } catch {
    return null;
  }
};
