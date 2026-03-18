import { isIPv6 } from 'node:net';

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

type IsPrivateIp = (hostname: string) => boolean;

const isPrivateIp: IsPrivateIp = (hostname) => {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
};

/**
 * Extracts the IPv4 address from an IPv4-mapped IPv6 address.
 * Handles both hex-encoded (::ffff:7f00:1) and dotted (::ffff:127.0.0.1) forms.
 * Returns null if the address is not an IPv4-mapped IPv6 address.
 */
type ExtractMappedIpv4 = (hostname: string) => string | null;

const extractMappedIpv4: ExtractMappedIpv4 = (hostname) => {
  if (!isIPv6(hostname)) {
    return null;
  }

  const lower = hostname.toLowerCase();

  // Dotted notation: ::ffff:192.168.1.1
  const dottedMatch = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dottedMatch) {
    return dottedMatch[1] as string;
  }

  // Hex notation: ::ffff:7f00:1 (URL.hostname strips brackets and normalizes)
  const hexMatch = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMatch) {
    const hi = Number.parseInt(hexMatch[1] as string, 16);
    const lo = Number.parseInt(hexMatch[2] as string, 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }

  return null;
};

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

  if (isPrivateIp(hostname)) {
    return {
      valid: false,
      reason: `Blocked private/internal address: ${hostname}`,
    };
  }

  // Check IPv4-mapped IPv6 addresses (e.g., [::ffff:127.0.0.1], [::ffff:7f00:1])
  // URL.hostname keeps brackets around IPv6 addresses — strip them for isIPv6/regex checks
  const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const mappedIpv4 = extractMappedIpv4(bare);
  if (mappedIpv4 && isPrivateIp(mappedIpv4)) {
    return {
      valid: false,
      reason: `Blocked private/internal address: ${hostname}`,
    };
  }

  return { valid: true };
};
