import { prisma } from '@harness/database';

type GoogleConnectionStatusComponent = () => Promise<React.ReactNode>;

export const GoogleConnectionStatus: GoogleConnectionStatusComponent = async () => {
  const syncStates = await prisma.calendarSyncState.findMany({
    where: { calendarId: { startsWith: 'google:' } },
    select: {
      calendarId: true,
      lastSyncAt: true,
      syncStatus: true,
      metadata: true,
    },
    orderBy: { lastSyncAt: 'desc' },
  });

  if (syncStates.length === 0) {
    return null;
  }

  const mostRecentSync = syncStates.find((s) => s.lastSyncAt !== null);

  return (
    <div className='rounded-lg border p-4'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-medium'>Synced Calendars ({syncStates.length})</span>
          {mostRecentSync?.lastSyncAt && (
            <span className='text-xs text-muted-foreground'>Last sync: {mostRecentSync.lastSyncAt.toLocaleString()}</span>
          )}
        </div>
        <div className='flex flex-col gap-1'>
          {syncStates.map((state) => {
            const meta = state.metadata as {
              name?: string;
              primary?: boolean;
            } | null;
            return (
              <div key={state.calendarId} className='flex items-center gap-2 text-xs text-muted-foreground'>
                <span className={`h-1.5 w-1.5 rounded-full ${state.syncStatus === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                <span>
                  {meta?.name ?? state.calendarId}
                  {meta?.primary ? ' (primary)' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
