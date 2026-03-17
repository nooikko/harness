import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE_DIR = join(tmpdir(), 'harness-playwright');

/** Per-traceId temp file registry. Tracks files for cleanup on pipeline complete. */
const registry = new Map<string, string[]>();

type EnsureTraceDir = (traceId: string) => string;

export const ensureTraceDir: EnsureTraceDir = (traceId) => {
  const dir = join(BASE_DIR, traceId);
  mkdirSync(dir, { recursive: true });
  return dir;
};

type TrackFile = (traceId: string, filePath: string) => void;

export const trackFile: TrackFile = (traceId, filePath) => {
  const files = registry.get(traceId) ?? [];
  files.push(filePath);
  registry.set(traceId, files);
};

type CleanupTrace = (traceId: string) => void;

export const cleanupTrace: CleanupTrace = (traceId) => {
  const dir = join(BASE_DIR, traceId);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  registry.delete(traceId);
};

type CleanupAll = () => void;

export const cleanupAll: CleanupAll = () => {
  if (existsSync(BASE_DIR)) {
    rmSync(BASE_DIR, { recursive: true, force: true });
  }
  registry.clear();
};

type GetTrackedFiles = (traceId: string) => string[];

export const getTrackedFiles: GetTrackedFiles = (traceId) => {
  return registry.get(traceId) ?? [];
};
