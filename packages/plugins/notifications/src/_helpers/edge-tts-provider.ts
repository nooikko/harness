import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TtsProvider } from './tts-provider';

// --- Constants ---

const EDGE_TTS_TIMEOUT_MS = 30_000;

/**
 * Curated list of English voices verified against edge-tts 7.x.
 * Each entry becomes a dropdown option in the admin UI settings.
 * Run `edge-tts --list-voices` for the full (all-language) list.
 */
export const VOICE_OPTIONS: { label: string; value: string }[] = [
  // US English
  { label: 'Ava Multilingual (Female, Expressive)', value: 'en-US-AvaMultilingualNeural' },
  { label: 'Ava (Female, Expressive)', value: 'en-US-AvaNeural' },
  { label: 'Emma Multilingual (Female, Cheerful)', value: 'en-US-EmmaMultilingualNeural' },
  { label: 'Emma (Female, Cheerful)', value: 'en-US-EmmaNeural' },
  { label: 'Jenny (Female, Friendly)', value: 'en-US-JennyNeural' },
  { label: 'Aria (Female, Confident)', value: 'en-US-AriaNeural' },
  { label: 'Michelle (Female, Friendly)', value: 'en-US-MichelleNeural' },
  { label: 'Ana (Female, Cute)', value: 'en-US-AnaNeural' },
  { label: 'Andrew Multilingual (Male, Warm)', value: 'en-US-AndrewMultilingualNeural' },
  { label: 'Andrew (Male, Warm)', value: 'en-US-AndrewNeural' },
  { label: 'Brian Multilingual (Male, Casual)', value: 'en-US-BrianMultilingualNeural' },
  { label: 'Brian (Male, Casual)', value: 'en-US-BrianNeural' },
  { label: 'Guy (Male, Newscast)', value: 'en-US-GuyNeural' },
  { label: 'Roger (Male, Lively)', value: 'en-US-RogerNeural' },
  { label: 'Eric (Male, Friendly)', value: 'en-US-EricNeural' },
  { label: 'Christopher (Male, Reliable)', value: 'en-US-ChristopherNeural' },
  { label: 'Steffan (Male, Professional)', value: 'en-US-SteffanNeural' },
  // UK English
  { label: 'Sonia — GB (Female)', value: 'en-GB-SoniaNeural' },
  { label: 'Libby — GB (Female)', value: 'en-GB-LibbyNeural' },
  { label: 'Maisie — GB (Female)', value: 'en-GB-MaisieNeural' },
  { label: 'Ryan — GB (Male)', value: 'en-GB-RyanNeural' },
  { label: 'Thomas — GB (Male)', value: 'en-GB-ThomasNeural' },
  // Australian English
  { label: 'Natasha — AU (Female)', value: 'en-AU-NatashaNeural' },
  { label: 'William Multilingual — AU (Male)', value: 'en-AU-WilliamMultilingualNeural' },
];

const KNOWN_VOICES = VOICE_OPTIONS.map((o) => o.value);

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
