// Plugins list — displays all plugin configurations with toggle controls

import { prisma } from '@harness/database';
import { Badge, Button, Skeleton } from '@harness/ui';
import { Suspense } from 'react';
import { togglePlugin } from '../_actions/toggle-plugin';

type HasSettings = (settings: unknown) => boolean;

const hasSettings: HasSettings = (settings) => {
  if (!settings) {
    return false;
  }
  if (typeof settings === 'object' && Object.keys(settings).length === 0) {
    return false;
  }
  return true;
};

/** @internal Exported for testing only — consumers should use PluginsTable. */
export const PluginsTableInternal = async () => {
  const plugins = await prisma.pluginConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });

  if (plugins.length === 0) {
    return (
      <div className='py-12 text-center'>
        <p className='text-sm text-muted-foreground/60'>No plugins configured.</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col'>
      {plugins.map((plugin, i) => (
        <div key={plugin.id}>
          {i > 0 && <div className='mx-1 h-px bg-border/40' />}
          <div className='group flex items-center justify-between gap-4 px-1 py-4'>
            <div className='flex items-center gap-2.5'>
              <span className='text-sm font-medium'>{plugin.pluginName}</span>
              <Badge variant={plugin.enabled ? 'default' : 'secondary'} className='text-[11px]'>
                {plugin.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              {hasSettings(plugin.settings) && <span className='text-xs text-muted-foreground/70'>Configured</span>}
            </div>
            <div className='opacity-0 transition-opacity group-hover:opacity-100'>
              <form action={togglePlugin.bind(null, plugin.id)}>
                <Button variant='ghost' size='sm' type='submit'>
                  {plugin.enabled ? 'Disable' : 'Enable'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PluginsTableSkeleton = () => (
  <div className='flex flex-col gap-4 py-4'>
    <Skeleton className='h-10 w-full' />
    <Skeleton className='h-10 w-full' />
    <Skeleton className='h-10 w-full' />
  </div>
);

/**
 * Drop-in plugins list with built-in Suspense boundary.
 * Streams the list as soon as data is ready; shows a skeleton until then.
 */
export const PluginsTable = () => (
  <Suspense fallback={<PluginsTableSkeleton />}>
    <PluginsTableInternal />
  </Suspense>
);
