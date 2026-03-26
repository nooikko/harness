import { listDevices } from '@harness/cast-devices';
import type { PluginRoute } from '@harness/plugin-contract';

export const deviceRoutes: PluginRoute[] = [
  {
    method: 'GET',
    path: '/devices',
    handler: async () => {
      const devices = listDevices();
      const options = [
        { label: 'First available', value: '__auto__' },
        ...devices.map((d) => ({
          label: `${d.name}${d.model ? ` (${d.model})` : ''}`,
          value: d.name,
        })),
      ];
      return { status: 200, body: { options } };
    },
  },
];
