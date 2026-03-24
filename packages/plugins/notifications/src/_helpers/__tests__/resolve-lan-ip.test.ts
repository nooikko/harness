import { networkInterfaces } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { resolveLanIp } from '../resolve-lan-ip';

vi.mock('node:os', () => ({
  networkInterfaces: vi.fn(),
}));

const mockNetworkInterfaces = vi.mocked(networkInterfaces);

describe('resolveLanIp', () => {
  it('returns the first non-internal IPv4 address', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null }],
      en0: [
        { address: 'fe80::1', family: 'IPv6', internal: false, netmask: '', mac: '', cidr: null, scopeid: 0 },
        { address: '192.168.1.50', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null },
      ],
    });

    expect(resolveLanIp()).toBe('192.168.1.50');
  });

  it('skips internal and IPv6 addresses', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null }],
      en0: [{ address: 'fe80::1', family: 'IPv6', internal: false, netmask: '', mac: '', cidr: null, scopeid: 0 }],
      en1: [{ address: '10.0.0.5', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null }],
    });

    expect(resolveLanIp()).toBe('10.0.0.5');
  });

  it('falls back to 127.0.0.1 when no LAN interface is found', () => {
    mockNetworkInterfaces.mockReturnValue({
      lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null }],
    });

    expect(resolveLanIp()).toBe('127.0.0.1');
  });

  it('handles empty network interfaces', () => {
    mockNetworkInterfaces.mockReturnValue({});

    expect(resolveLanIp()).toBe('127.0.0.1');
  });
});
