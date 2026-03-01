// Plugins table — displays all plugin configurations with toggle controls

import { prisma } from '@harness/database';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@harness/ui';
import { Suspense } from 'react';
import { togglePlugin } from '../_actions/toggle-plugin';

type StatusVariant = 'default' | 'secondary';

type GetStatusVariant = (enabled: boolean) => StatusVariant;

const getStatusVariant: GetStatusVariant = (enabled) => {
  return enabled ? 'default' : 'secondary';
};

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
      <Card>
        <CardHeader>
          <CardTitle>Plugins</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>No plugins configured.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plugins</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plugin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Settings</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plugins.map((plugin) => (
              <TableRow key={plugin.id}>
                <TableCell className='font-medium'>{plugin.pluginName}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(plugin.enabled)}>{plugin.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </TableCell>
                <TableCell className='text-sm text-muted-foreground'>{hasSettings(plugin.settings) ? 'Configured' : 'No settings'}</TableCell>
                <TableCell>
                  <form action={togglePlugin.bind(null, plugin.id)}>
                    <Button variant='outline' size='sm' type='submit'>
                      {plugin.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const PluginsTableSkeleton = () => <Skeleton className='h-80 w-full' />;

/**
 * Drop-in plugins table with built-in Suspense boundary.
 * Streams the table as soon as data is ready; shows a skeleton until then.
 */
export const PluginsTable = () => (
  <Suspense fallback={<PluginsTableSkeleton />}>
    <PluginsTableInternal />
  </Suspense>
);
