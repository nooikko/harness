type ValidateUrl = (url: string) => { valid: boolean; reason?: string };

const BLOCKED_SCHEMES = ['file:', 'data:', 'javascript:', 'vbscript:'];

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?fc00:/i,
  /^\[?fd00:/i,
  /^\[?fe80:/i,
  /^localhost$/i,
];

export const validateUrl: ValidateUrl = (url) => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  const scheme = parsed.protocol.toLowerCase();
  if (BLOCKED_SCHEMES.includes(scheme)) {
    return { valid: false, reason: `Blocked scheme: ${scheme}` };
  }

  if (scheme !== 'http:' && scheme !== 'https:') {
    return { valid: false, reason: `Unsupported scheme: ${scheme}` };
  }

  const hostname = parsed.hostname;
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, reason: `Blocked private/internal address: ${hostname}` };
    }
  }

  return { valid: true };
};
