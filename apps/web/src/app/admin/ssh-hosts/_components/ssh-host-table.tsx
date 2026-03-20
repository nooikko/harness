// SSH hosts table — lists configured SSH hosts with inline toggle and row actions

import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import { Plus, Server } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { RelativeTime } from '../../_components/relative-time';
import { RowMenu } from '../../_components/row-menu';
import { deleteSshHost } from '../_actions/delete-ssh-host';
import { listSshHosts } from '../_actions/list-ssh-hosts';
import { SshHostToggle } from './ssh-host-toggle';

/** @internal Exported for testing only — consumers should use SshHostTable. */
export const SshHostTableInternal = async () => {
  const hosts = await listSshHosts();

  if (hosts.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
        <Server className='h-8 w-8 text-muted-foreground/30' />
        <div className='flex flex-col gap-1'>
          <p className='text-sm text-muted-foreground'>No SSH hosts configured yet</p>
          <p className='text-xs text-muted-foreground/60'>Add a host to enable SSH automation.</p>
        </div>
        <Link
          href='/admin/ssh-hosts/new'
          className='mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90'
        >
          <Plus className='h-3.5 w-3.5' />
          Add Host
        </Link>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Host</TableHead>
          <TableHead className='w-16'>Port</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Last Seen</TableHead>
          <TableHead className='w-16'>Enabled</TableHead>
          <TableHead className='w-11' />
        </TableRow>
      </TableHeader>
      <TableBody>
        {hosts.map((host) => {
          const deleteAction = deleteSshHost.bind(null, host.id);

          return (
            <TableRow key={host.id} className='group/row'>
              <TableCell variant='primary'>
                <Link href={`/admin/ssh-hosts/${host.id}/edit`} className='hover:underline'>
                  {host.name}
                </Link>
              </TableCell>
              <TableCell variant='mono'>{host.hostname}</TableCell>
              <TableCell variant='mono'>{host.port}</TableCell>
              <TableCell variant='mono'>{host.username}</TableCell>
              <TableCell>
                <div className='flex flex-wrap gap-1'>
                  {host.tags.length > 0 ? (
                    host.tags.map((tag) => (
                      <Badge key={tag} variant='secondary' className='text-xs'>
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className='text-muted-foreground/50'>&mdash;</span>
                  )}
                </div>
              </TableCell>
              <TableCell>{host.lastSeenAt ? <RelativeTime date={host.lastSeenAt} /> : '\u2014'}</TableCell>
              <TableCell>
                <SshHostToggle id={host.id} enabled={host.enabled} />
              </TableCell>
              <TableCell>
                <RowMenu
                  actions={[
                    { label: 'Edit', icon: 'pencil', href: `/admin/ssh-hosts/${host.id}/edit` },
                    {
                      label: 'Delete',
                      icon: 'trash',
                      destructive: true,
                      onClick: async () => {
                        'use server';
                        await deleteAction();
                      },
                    },
                  ]}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

const SshHostTableSkeleton = () => (
  <div className='rounded-lg border border-border'>
    <div className='flex items-center gap-4 border-b border-border px-3.5 py-2'>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className='h-3 w-20' />
      ))}
    </div>
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className='flex items-center gap-4 border-b border-border/50 px-3.5 py-3'>
        <Skeleton className='h-3 w-28' />
        <Skeleton className='h-3 w-32' />
        <Skeleton className='h-3 w-10' />
        <Skeleton className='h-3 w-20' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 w-14' />
        <Skeleton className='h-5 w-10 rounded-full' />
      </div>
    ))}
  </div>
);

/**
 * Drop-in SSH hosts list with built-in Suspense boundary.
 * Streams the list as soon as data is ready; shows a skeleton until then.
 */
export const SshHostTable = () => (
  <Suspense fallback={<SshHostTableSkeleton />}>
    <SshHostTableInternal />
  </Suspense>
);
