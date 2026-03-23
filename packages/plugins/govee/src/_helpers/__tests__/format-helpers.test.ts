import { describe, expect, it } from 'vitest';
import { formatDevices } from '../format-helpers';
import type { GoveeDevice } from '../govee-types';

const device1: GoveeDevice = {
  sku: 'H6008',
  device: 'AA:BB:CC:DD',
  deviceName: 'Living Room Light',
  type: 'devices.types.light',
  capabilities: [
    { type: 'devices.capabilities.on_off', instance: 'powerSwitch' },
    { type: 'devices.capabilities.range', instance: 'brightness' },
    { type: 'devices.capabilities.color_setting', instance: 'colorTemperatureK' },
  ],
};

const device2: GoveeDevice = {
  sku: 'H6159',
  device: 'EE:FF:00:11',
  deviceName: 'Bedroom Strip',
  type: 'devices.types.light',
  capabilities: [
    { type: 'devices.capabilities.on_off', instance: 'powerSwitch' },
    { type: 'devices.capabilities.color_setting', instance: 'colorRgb' },
  ],
};

describe('formatDevices', () => {
  it('formats devices as readable markdown', () => {
    const result = formatDevices([device1, device2]);
    expect(result).toContain('Living Room Light');
    expect(result).toContain('Bedroom Strip');
    expect(result).toContain('H6008');
    expect(result).toContain('H6159');
  });

  it('shows capabilities', () => {
    const result = formatDevices([device2]);
    expect(result).toContain('color');
  });

  it('returns message for empty list', () => {
    const result = formatDevices([]);
    expect(result).toContain('No devices found');
  });
});
