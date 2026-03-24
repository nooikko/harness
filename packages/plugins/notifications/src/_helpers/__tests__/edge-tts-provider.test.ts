import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { edgeTtsProvider } from '../edge-tts-provider';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  unlink: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);
const mockReadFile = vi.mocked(readFile);
const mockUnlink = vi.mocked(unlink);

const createMockProcess = (exitCode = 0, stderr = '') => {
  const proc = {
    on: vi.fn(),
    stderr: {
      on: vi.fn(),
    },
  };

  // Wire up event handlers to fire automatically
  proc.on.mockImplementation((event: string, handler: (code: number | null) => void) => {
    if (event === 'close') {
      setTimeout(() => handler(exitCode), 0);
    }
    return proc;
  });

  proc.stderr.on.mockImplementation((event: string, handler: (data: Buffer) => void) => {
    if (event === 'data' && stderr) {
      setTimeout(() => handler(Buffer.from(stderr)), 0);
    }
    return proc.stderr;
  });

  return proc;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('edgeTtsProvider', () => {
  it('has the correct name', () => {
    expect(edgeTtsProvider.name).toBe('edge-tts');
  });

  describe('generate', () => {
    it('spawns edge-tts with correct arguments', async () => {
      const audioBuffer = Buffer.from('fake-audio-data');
      const proc = createMockProcess(0);
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
      mockReadFile.mockResolvedValue(audioBuffer);
      mockUnlink.mockResolvedValue(undefined);

      const result = await edgeTtsProvider.generate('Hello world', 'en-US-GuyNeural');

      expect(mockSpawn).toHaveBeenCalledWith(
        'edge-tts',
        expect.arrayContaining(['--text', 'Hello world', '--voice', 'en-US-GuyNeural', '--write-media', expect.stringContaining('.mp3')]),
        expect.objectContaining({ stdio: ['ignore', 'ignore', 'pipe'] }),
      );
      expect(result).toEqual(audioBuffer);
    });

    it('cleans up temp file after reading', async () => {
      const proc = createMockProcess(0);
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);
      mockReadFile.mockResolvedValue(Buffer.from('audio'));
      mockUnlink.mockResolvedValue(undefined);

      await edgeTtsProvider.generate('Test', 'en-US-GuyNeural');

      expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining('.mp3'));
    });

    it('throws when edge-tts process exits with non-zero code', async () => {
      const proc = createMockProcess(1, 'edge-tts: command not found');
      mockSpawn.mockReturnValue(proc as unknown as ChildProcess);

      await expect(edgeTtsProvider.generate('Hello', 'en-US-GuyNeural')).rejects.toThrow('edge-tts exited with code 1');
    });

    it('throws when text is empty', async () => {
      await expect(edgeTtsProvider.generate('', 'en-US-GuyNeural')).rejects.toThrow('Text cannot be empty');
    });
  });

  describe('listVoices', () => {
    it('returns a list of available voice names', async () => {
      const voices = await edgeTtsProvider.listVoices();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
      expect(voices).toContain('en-US-GuyNeural');
      expect(voices).toContain('en-US-JennyNeural');
    });
  });
});
