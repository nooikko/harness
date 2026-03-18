// Plugins table — displays all plugin configurations with inline toggle and settings link

import { prisma } from '@harness/database';
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import { Puzzle } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { pluginSettingsRegistry } from '@/generated/plugin-settings-registry';
import { RowMenu } from '../../_components/row-menu';
import { PluginStatusBadge } from './plugin-status-badge';
import { PluginToggle } from './plugin-toggle';

type SettingsEntry = (typeof pluginSettingsRegistry)[number] | undefined;

type GetSettingsEntry = (pluginName: string) => SettingsEntry;

const getSettingsEntry: GetSettingsEntry = (pluginName) => pluginSettingsRegistry.find((e) => e.pluginName === pluginName);

/** @internal Exported for testing only — consumers should use PluginsTable. */
export const PluginsTableInternal = async () => {
  const plugins = await prisma.pluginConfig.findMany({
    orderBy: [{ enabled: 'desc' }, { pluginName: 'asc' }],
  });

  if (plugins.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <Puzzle className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No plugins configured</p>
          <p className='text-xs text-muted-foreground/60'>Plugins are registered by the orchestrator at startup.</p>
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plugin</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className='text-right'>Settings</TableHead>
          <TableHead className='w-16'>Enabled</TableHead>
          <TableHead className='w-11' />
        </TableRow>
      </TableHeader>
      <TableBody>
        {plugins.map((plugin) => {
          const entry = getSettingsEntry(plugin.pluginName);
          const fieldCount = entry?.fields.length ?? 0;

          return (
            <TableRow key={plugin.id} className='group/row'>
              <TableCell variant='primary'>
                {entry ? (
                  <Link href={`/admin/plugins/${plugin.pluginName}`} className='hover:underline'>
                    {plugin.pluginName}
                  </Link>
                ) : (
                  plugin.pluginName
                )}
              </TableCell>
              <TableCell>
                <PluginStatusBadge pluginName={plugin.pluginName} enabled={plugin.enabled} />
              </TableCell>
              <TableCell className='text-right tabular-nums'>{fieldCount > 0 ? fieldCount : '\u2014'}</TableCell>
              <TableCell>
                <PluginToggle id={plugin.id} enabled={plugin.enabled} />
              </TableCell>
              <TableCell>
                {entry && <RowMenu actions={[{ label: 'Settings', icon: 'pencil', href: `/admin/plugins/${plugin.pluginName}` }]} />}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const PluginsTableSkeleton = () => (
  <div className='rounded-lg border border-border'>
    <div className='flex items-center gap-4 border-b border-border px-3.5 py-2'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className='h-3 w-20' />
      ))}
    </div>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className='flex items-center gap-4 border-b border-border/50 px-3.5 py-3'>
        <Skeleton className='h-3 w-24' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-8' />
        <Skeleton className='h-5 w-10 rounded-full' />
      </div>
    ))}
  </div>
);

/**
 * Drop-in plugins table with built-in Suspense boundary.
 * Streams the table as soon as data is ready; shows a skeleton until then.
 */
export const PluginsTable = () => (
  <Suspense fallback={<PluginsTableSkeleton />}>
    <PluginsTableInternal />
  </Suspense>
);
