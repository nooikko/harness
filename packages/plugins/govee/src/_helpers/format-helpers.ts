import type { GoveeDevice } from './govee-types';

type FormatDevices = (devices: GoveeDevice[]) => string;

const summarizeCapabilities = (device: GoveeDevice): string => {
  const caps: string[] = [];
  for (const c of device.capabilities) {
    if (c.instance === 'powerSwitch') {
      caps.push('on/off');
    }
    if (c.instance === 'brightness') {
      caps.push('brightness');
    }
    if (c.instance === 'colorRgb') {
      caps.push('color');
    }
    if (c.instance === 'colorTemperatureK') {
      caps.push('color temp');
    }
    if (c.instance === 'lightScene') {
      caps.push('scenes');
    }
  }
  return caps.join(', ');
};

export const formatDevices: FormatDevices = (devices) => {
  if (devices.length === 0) {
    return 'No devices found.';
  }

  const lines = devices.map((d) => {
    const caps = summarizeCapabilities(d);
    return `- **${d.deviceName}** (${d.sku}) — ${caps || 'basic'}`;
  });

  return `## Devices\n\n${lines.join('\n')}`;
};
