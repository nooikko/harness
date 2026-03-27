// Wraps a promise with a configurable timeout.
// On timeout, rejects with HookTimeoutError and attaches a no-op .catch() to the
// original promise to suppress unhandled-rejection noise from the zombie.

export class HookTimeoutError extends Error {
  public readonly label: string;
  public readonly timeoutMs: number;
  public readonly elapsed: number;

  constructor(label: string, timeoutMs: number, elapsed: number) {
    super(`Hook timed out after ${timeoutMs}ms: ${label}`);
    this.name = 'HookTimeoutError';
    this.label = label;
    this.timeoutMs = timeoutMs;
    this.elapsed = elapsed;
  }
}

export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  const startedAt = Date.now();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      // Suppress unhandled rejection from the zombie promise
      promise.catch(() => {});
      reject(new HookTimeoutError(label, timeoutMs, Date.now() - startedAt));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
};
