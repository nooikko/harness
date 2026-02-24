'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'ui';

type AdminNavLinkProps = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type AdminNavLinkComponent = (props: AdminNavLinkProps) => React.ReactNode;

export const AdminNavLink: AdminNavLinkComponent = ({ href, icon: Icon, label }) => {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
      )}
    >
      <Icon className='h-4 w-4 shrink-0' />
      {label}
    </Link>
  );
};
