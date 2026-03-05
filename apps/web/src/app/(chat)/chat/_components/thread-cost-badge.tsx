import 'server-only';

import { Badge, Skeleton } from '@harness/ui';
import { formatCost } from '@/app/admin/usage/_helpers/format-cost';
import { getThreadCost } from '../_actions/get-thread-cost';

type ThreadCostBadgeProps = {
  threadId: string;
};

type ThreadCostBadgeComponent = (props: ThreadCostBadgeProps) => Promise<React.ReactNode>;

export const ThreadCostBadge: ThreadCostBadgeComponent = async ({ threadId }) => {
  const { totalCost } = await getThreadCost(threadId);

  if (totalCost === 0) {
    return null;
  }

  return (
    <Badge variant='secondary' className='font-mono text-xs'>
      {formatCost(totalCost)}
    </Badge>
  );
};

type ThreadCostBadgeSkeletonComponent = () => React.ReactNode;

export const ThreadCostBadgeSkeleton: ThreadCostBadgeSkeletonComponent = () => <Skeleton className='h-5 w-14 rounded-full' />;
