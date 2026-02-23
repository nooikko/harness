import { Suspense } from 'react';
import { ThreadDetail } from '../_components/thread-detail';

type ThreadPageProps = {
  params: Promise<{ 'thread-id': string }>;
};

type ThreadPageComponent = (props: ThreadPageProps) => Promise<React.ReactNode>;

/**
 * Thread detail page. Resolves route params, then delegates data fetching
 * to async server components wrapped in Suspense boundaries.
 */
const ThreadPage: ThreadPageComponent = async ({ params }) => {
  const { 'thread-id': threadId } = await params;

  return (
    <div className='flex h-full flex-col'>
      <Suspense>
        <ThreadDetail threadId={threadId} />
      </Suspense>
    </div>
  );
};

export default ThreadPage;
