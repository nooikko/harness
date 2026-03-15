import { prisma } from '@harness/database';
import Link from 'next/link';
import { SearchTrigger } from './search-trigger';
import { UserMenu } from './user-menu';

type TopBarComponent = () => Promise<React.ReactNode>;

export const TopBar: TopBarComponent = async () => {
  const profile = await prisma.userProfile.findUnique({
    where: { id: 'singleton' },
    select: { name: true },
  });

  const name = profile?.name ?? 'User';

  return (
    <header className='flex h-12 shrink-0 items-center border-b border-border bg-background px-4'>
      <Link href='/' className='text-sm font-semibold tracking-tight text-foreground'>
        Harness
      </Link>
      <div className='mx-auto'>
        <SearchTrigger />
      </div>
      <UserMenu name={name} />
    </header>
  );
};
