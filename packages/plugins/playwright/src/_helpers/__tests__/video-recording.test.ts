import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { PluginContext, PluginToolMeta } from '@harness/plugin-contract';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

vi.mock('../browser-manager', () => ({
  getPage: vi.fn(),
  getPageWithRecording: vi.fn(),
  closePageForThread: vi.fn().mockResolvedValue(undefined),
  isRecordingActive: vi.fn(),
}));

vi.mock('../temp-tracker', () => ({
  ensureTraceDir: vi.fn().mockReturnValue('/tmp/harness-playwright/trace-1'),
}));

vi.mock('node:fs', () => ({
  readdirSync: vi.fn().mockReturnValue(['abc123.webm']),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('webm-video-data')),
}));

import { closePageForThread, getPage, getPageWithRecording, isRecordingActive } from '../browser-manager';
import { cleanupRecordingState, startRecording, stopRecording } from '../video-recording';

const mockUploadFile = vi.fn().mockResolvedValue({ fileId: 'video-file-1', relativePath: 'threads/t1/video.webm' });
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
const mockCtx = { uploadFile: mockUploadFile, logger: mockLogger } as unknown as PluginContext;
const mockMeta: PluginToolMeta = { threadId: 'thread-1', traceId: 'trace-1' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startRecording', () => {
  it('starts recording and navigates back to current URL', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);
    const mockPage = { url: vi.fn().mockReturnValue('https://example.com') };
    (getPage as Mock).mockResolvedValue(mockPage);
    const recordingPage = { goto: vi.fn().mockResolvedValue(undefined) };
    (getPageWithRecording as Mock).mockResolvedValue(recordingPage);

    const result = await startRecording(mockCtx, {}, mockMeta);

    expect(result).toContain('Video recording started');
    expect(result).toContain('https://example.com');
    expect(getPageWithRecording).toHaveBeenCalledWith('thread-1', {
      videoDir: expect.stringContaining('videos'),
    });
    expect(recordingPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
  });

  it('returns error if already recording', async () => {
    (isRecordingActive as Mock).mockReturnValue(true);

    const result = await startRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('already active');
  });

  it('handles no existing page gracefully', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);
    (getPage as Mock).mockRejectedValue(new Error('no page'));
    const recordingPage = { goto: vi.fn() };
    (getPageWithRecording as Mock).mockResolvedValue(recordingPage);

    const result = await startRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('Video recording started');
    expect(recordingPage.goto).not.toHaveBeenCalled();
  });

  it('uses "unknown" when traceId is missing', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);
    (getPage as Mock).mockRejectedValue(new Error('no page'));
    (getPageWithRecording as Mock).mockResolvedValue({ goto: vi.fn() });

    await startRecording(mockCtx, {}, { threadId: 'thread-1' });
    // ensureTraceDir should have been called (with 'unknown' trace ID internally)
    expect(getPageWithRecording).toHaveBeenCalled();
  });

  it('returns error on getPageWithRecording failure', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);
    (getPage as Mock).mockRejectedValue(new Error('no page'));
    (getPageWithRecording as Mock).mockRejectedValue(new Error('browser crashed'));

    const result = await startRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('Error starting recording');
    expect(result).toContain('browser crashed');
  });

  it('returns error with string throw', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);
    (getPage as Mock).mockRejectedValue(new Error('no page'));
    (getPageWithRecording as Mock).mockRejectedValue('string error');

    const result = await startRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('string error');
  });
});

describe('stopRecording', () => {
  const setupRecording = async () => {
    (isRecordingActive as Mock).mockReturnValue(false);
    const mockPage = { url: vi.fn().mockReturnValue('https://example.com') };
    (getPage as Mock).mockResolvedValue(mockPage);
    (getPageWithRecording as Mock).mockResolvedValue({ goto: vi.fn().mockResolvedValue(undefined) });
    await startRecording(mockCtx, {}, mockMeta);
    vi.clearAllMocks();
    // Restore fs mocks cleared by vi.clearAllMocks
    (readdirSync as Mock).mockReturnValue(['abc123.webm']);
    (readFile as Mock).mockResolvedValue(Buffer.from('webm-video-data'));
  };

  it('stops recording, uploads video, and returns file info', async () => {
    await setupRecording();
    (isRecordingActive as Mock).mockReturnValue(true);

    const result = await stopRecording(mockCtx, {}, mockMeta);

    expect(result).toContain('Video recording saved');
    expect(result).toContain('file ID: video-file-1');
    expect(closePageForThread).toHaveBeenCalledWith('thread-1');
    expect(mockUploadFile).toHaveBeenCalledWith({
      filename: expect.stringContaining('recording-'),
      buffer: expect.any(Buffer),
      mimeType: 'video/webm',
      scope: 'THREAD',
      threadId: 'thread-1',
    });
  });

  it('returns error if no active recording', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);

    const result = await stopRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('No active recording');
  });

  it('handles no video file produced', async () => {
    await setupRecording();
    (isRecordingActive as Mock).mockReturnValue(true);
    (readdirSync as Mock).mockReturnValue([]);

    const result = await stopRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('no video file was produced');
  });

  it('returns error on upload failure', async () => {
    await setupRecording();
    (isRecordingActive as Mock).mockReturnValue(true);
    mockUploadFile.mockRejectedValueOnce(new Error('disk full'));

    const result = await stopRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('Error stopping recording');
    expect(result).toContain('disk full');
  });

  it('handles non-Error throw in stop', async () => {
    await setupRecording();
    (isRecordingActive as Mock).mockReturnValue(true);
    (closePageForThread as Mock).mockRejectedValueOnce('context destroyed');

    const result = await stopRecording(mockCtx, {}, mockMeta);
    expect(result).toContain('context destroyed');
  });
});

describe('cleanupRecordingState', () => {
  it('is a no-op when no recording is active', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);

    await cleanupRecordingState('thread-1', mockCtx);
    expect(closePageForThread).not.toHaveBeenCalled();
  });

  it('auto-saves abandoned recording', async () => {
    // Start a recording to populate videoDirs
    (isRecordingActive as Mock).mockReturnValue(false);
    (getPage as Mock).mockRejectedValue(new Error('no page'));
    (getPageWithRecording as Mock).mockResolvedValue({ goto: vi.fn() });
    await startRecording(mockCtx, {}, mockMeta);
    vi.clearAllMocks();
    (readdirSync as Mock).mockReturnValue(['abc123.webm']);
    (readFile as Mock).mockResolvedValue(Buffer.from('webm-video-data'));

    // Now simulate cleanup with active recording
    (isRecordingActive as Mock).mockReturnValue(true);

    await cleanupRecordingState('thread-1', mockCtx);

    expect(closePageForThread).toHaveBeenCalledWith('thread-1');
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringContaining('recording-auto-'),
        mimeType: 'video/webm',
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('auto-saved'));
  });

  it('handles cleanup failure gracefully', async () => {
    (isRecordingActive as Mock).mockReturnValue(false);
    (getPage as Mock).mockRejectedValue(new Error('no page'));
    (getPageWithRecording as Mock).mockResolvedValue({ goto: vi.fn() });
    await startRecording(mockCtx, {}, mockMeta);
    vi.clearAllMocks();

    (isRecordingActive as Mock).mockReturnValue(true);
    (closePageForThread as Mock).mockRejectedValueOnce(new Error('already closed'));

    await cleanupRecordingState('thread-1', mockCtx);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to auto-save'));
  });
});
