'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from 'ui';

type NavLinkProps = {
  href: string;
  children: React.ReactNode;
};

type NavLinkComponent = (props: NavLinkProps) => React.ReactNode;

export const NavLink: NavLinkComponent = ({ href, children }) => {
  const pathname = usePathname();

  const isActive = href === '/' ? pathname === '/' || pathname.startsWith('/chat') : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
        isActive ? 'text-foreground bg-secondary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
      )}
    >
      {children}
    </Link>
  );
};
