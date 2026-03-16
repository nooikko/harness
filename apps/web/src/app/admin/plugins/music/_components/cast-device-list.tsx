'use client';

import { Alert, AlertDescription, Badge, Button, Card, CardContent, Input, Skeleton } from '@harness/ui';
import { Pencil, Speaker, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { identifyDevice } from '../_actions/identify-device';
import { setDeviceAlias } from '../_actions/set-device-alias';

type CastDevice = {
  id: string;
  name: string;
  model: string;
  alias?: string;
  status: 'available' | 'playing' | 'offline';
};

type CastDeviceListComponent = () => React.ReactNode;

export const CastDeviceList: CastDeviceListComponent = () => {
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [identifyingId, setIdentifyingId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/plugins/music/devices');
      if (!res.ok) {
        setError('Failed to load devices');
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { devices: CastDevice[] };
      setDevices(data.devices);
      setError(null);
    } catch {
      setError('Could not reach orchestrator');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const handleIdentify = async (deviceId: string) => {
    setIdentifyingId(deviceId);
    const result = await identifyDevice(deviceId);
    if (!result.success) {
      setError(result.error ?? 'Failed to identify device');
    }
    setIdentifyingId(null);
  };

  const handleStartEdit = (device: CastDevice) => {
    setEditingId(device.id);
    setEditValue(device.alias ?? device.name);
  };

  const handleSaveAlias = async (deviceId: string) => {
    const result = await setDeviceAlias(deviceId, editValue);
    if (result.success) {
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, alias: editValue } : d)));
      setEditingId(null);
    } else {
      setError(result.error ?? 'Failed to save alias');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  type StatusConfig = {
    color: string;
    label: string;
  };

  const statusConfig: Record<CastDevice['status'], StatusConfig> = {
    available: { color: 'bg-green-500', label: 'Available' },
    playing: { color: 'bg-yellow-500', label: 'Playing' },
    offline: { color: 'bg-gray-400', label: 'Offline' },
  };

  return (
    <section className='space-y-3'>
      <div className='flex items-center gap-2'>
        <h3 className='text-sm font-medium'>Cast Devices</h3>
        {!loading && <Badge variant='secondary'>{devices.length}</Badge>}
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card>
          <CardContent className='space-y-3 pt-6'>
            <Skeleton className='h-12 w-full' />
            <Skeleton className='h-12 w-full' />
          </CardContent>
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className='pt-6'>
            <div className='flex flex-col items-center gap-2 py-6 text-center text-muted-foreground'>
              <Speaker className='h-8 w-8' />
              <p className='text-sm'>No Cast devices found</p>
              <p className='text-xs'>Ensure devices are on the same network as the orchestrator.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='divide-y pt-6'>
            {devices.map((device) => {
              const config = statusConfig[device.status];
              return (
                <div key={device.id} className='flex items-center gap-3 py-3 first:pt-0 last:pb-0'>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.color}`} title={config.label} />
                  <div className='flex-1'>
                    {editingId === device.id ? (
                      <div className='flex items-center gap-2'>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className='h-8 text-sm'
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void handleSaveAlias(device.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                        <Button size='sm' variant='outline' onClick={() => void handleSaveAlias(device.id)}>
                          Save
                        </Button>
                        <Button size='sm' variant='ghost' onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className='text-sm font-medium'>{device.alias ?? device.name}</p>
                        <p className='text-xs text-muted-foreground'>
                          {device.model}
                          {device.alias ? ` (${device.name})` : ''}
                        </p>
                      </>
                    )}
                  </div>
                  {editingId !== device.id && (
                    <div className='flex items-center gap-1'>
                      <Button size='sm' variant='ghost' onClick={() => handleStartEdit(device)} title='Set alias'>
                        <Pencil className='h-3.5 w-3.5' />
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => void handleIdentify(device.id)}
                        disabled={identifyingId === device.id || device.status === 'offline'}
                        title='Test / Identify'
                      >
                        <Volume2 className='h-3.5 w-3.5' />
                        {identifyingId === device.id ? '...' : 'Test'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
};
