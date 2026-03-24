import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TtsProvider } from './tts-provider';

// --- Constants ---

const EDGE_TTS_TIMEOUT_MS = 30_000;

/**
 * Hardcoded list of commonly used English voices.
 * edge-tts supports many more — run `edge-tts --list-voices` for the full list.
 * We list a curated subset to avoid spawning a subprocess just to list voices.
 */
const KNOWN_VOICES = [
  'en-US-GuyNeural',
  'en-US-JennyNeural',
  'en-US-AriaNeural',
  'en-US-DavisNeural',
  'en-US-AmberNeural',
  'en-US-AnaNeural',
  'en-US-AndrewNeural',
  'en-US-BrandonNeural',
  'en-US-ChristopherNeural',
  'en-US-CoraNeural',
  'en-US-ElizabethNeural',
  'en-US-EricNeural',
  'en-US-JacobNeural',
  'en-US-MichelleNeural',
  'en-US-MonicaNeural',
  'en-US-RogerNeural',
  'en-US-SteffanNeural',
  'en-GB-RyanNeural',
  'en-GB-SoniaNeural',
  'en-AU-NatashaNeural',
  'en-AU-WilliamNeural',
];

// --- Helpers ---

type RunEdgeTts = (args: string[]) => Promise<void>;

const runEdgeTts: RunEdgeTts = (args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn('edge-tts', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`edge-tts timed out after ${EDGE_TTS_TIMEOUT_MS}ms`));
    }, EDGE_TTS_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`edge-tts exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
        return;
      }
      resolve();
    });
  });
};

// --- Provider ---

export const edgeTtsProvider: TtsProvider = {
  name: 'edge-tts',

  generate: async (text: string, voice: string): Promise<Buffer> => {
    if (!text) {
      throw new Error('Text cannot be empty');
    }

    const outPath = join(tmpdir(), `harness-tts-${randomUUID()}.mp3`);

    await runEdgeTts(['--text', text, '--voice', voice, '--write-media', outPath]);

    const buffer = await readFile(outPath);

    // Clean up temp file — fire-and-forget
    void unlink(outPath).catch(() => {});

    return buffer;
  },

  listVoices: async (): Promise<string[]> => {
    return [...KNOWN_VOICES];
  },
};
