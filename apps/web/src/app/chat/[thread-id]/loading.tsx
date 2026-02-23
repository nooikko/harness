import { Skeleton } from 'ui';

type LoadingComponent = () => React.ReactNode;

/**
 * Route-level loading skeleton for the thread detail page.
 * Displayed while the Server Component fetches thread + messages.
 */
const Loading: LoadingComponent = () => {
  return (
    <output className='flex h-full flex-col' aria-label='Loading thread'>
      {/* Header skeleton */}
      <div className='flex items-center gap-3 border-b border-border px-6 py-3'>
        <Skeleton className='h-5 w-5' />
        <div className='flex flex-col gap-1.5'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='h-3 w-24' />
        </div>
      </div>
      {/* Message skeleton */}
      <div className='flex flex-1 flex-col gap-4 p-4'>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`skeleton-msg-${i}`} className={`flex w-full gap-3 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className='flex max-w-[75%] gap-3 rounded-lg px-4 py-3'>
              <Skeleton className='h-4 w-4 shrink-0' />
              <div className='flex flex-col gap-1.5'>
                <Skeleton className='h-4' style={{ width: `${150 + ((i * 50) % 200)}px` }} />
                <Skeleton className='h-4' style={{ width: `${100 + ((i * 30) % 150)}px` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <span className='sr-only'>Loading thread content...</span>
    </output>
  );
};

export default Loading;
