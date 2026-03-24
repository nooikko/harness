import { networkInterfaces } from 'node:os';

// --- Types ---

type ResolveLanIp = () => string;

// --- Implementation ---

export const resolveLanIp: ResolveLanIp = () => {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    if (!entries) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.internal && entry.family === 'IPv4') {
        return entry.address;
      }
    }
  }

  return '127.0.0.1';
};
