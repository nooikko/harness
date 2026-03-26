import { describe, expect, it, vi } from 'vitest';
import { deviceRoutes } from '../device-routes';

vi.mock('@harness/cast-devices', () => ({
  listDevices: vi.fn(() => [
    { name: 'Living Room', host: '192.168.1.10', port: 8009, id: 'lr1', model: 'Google Home' },
    { name: 'Kitchen', host: '192.168.1.20', port: 8009, id: 'k1', model: undefined },
  ]),
}));

describe('deviceRoutes', () => {
  const devicesRoute = deviceRoutes[0]!;

  it('has a GET /devices route', () => {
    expect(devicesRoute.method).toBe('GET');
    expect(devicesRoute.path).toBe('/devices');
  });

  it('returns options with "First available" plus discovered devices', async () => {
    const mockCtx = {} as Parameters<typeof devicesRoute.handler>[0];
    const mockReq = { params: {}, query: {} } as Parameters<typeof devicesRoute.handler>[1];

    const result = await devicesRoute.handler(mockCtx, mockReq);

    expect(result.status).toBe(200);
    const body = result.body as { options: Array<{ label: string; value: string }> };
    expect(body.options).toHaveLength(3);
    expect(body.options[0]).toEqual({ label: 'First available', value: '__auto__' });
    expect(body.options[1]).toEqual({ label: 'Living Room (Google Home)', value: 'Living Room' });
    expect(body.options[2]).toEqual({ label: 'Kitchen', value: 'Kitchen' });
  });

  it('returns only "First available" when no devices found', async () => {
    const { listDevices } = await import('@harness/cast-devices');
    vi.mocked(listDevices).mockReturnValueOnce([]);

    const mockCtx = {} as Parameters<typeof devicesRoute.handler>[0];
    const mockReq = { params: {}, query: {} } as Parameters<typeof devicesRoute.handler>[1];

    const result = await devicesRoute.handler(mockCtx, mockReq);

    const body = result.body as { options: Array<{ label: string; value: string }> };
    expect(body.options).toHaveLength(1);
    expect(body.options[0]).toEqual({ label: 'First available', value: '__auto__' });
  });
});
