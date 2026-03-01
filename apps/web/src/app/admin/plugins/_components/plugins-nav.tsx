'use client';

import type { PluginConfig } from '@harness/database';
import { cn } from '@harness/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type PluginsNavProps = { configs: PluginConfig[] };

type PluginsNavComponent = (props: PluginsNavProps) => React.ReactNode;

export const PluginsNav: PluginsNavComponent = ({ configs }) => {
  const pathname = usePathname();

  return (
    <nav className='flex flex-col gap-1 p-3'>
      <Link
        href='/admin/plugins'
        className={cn('rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted', pathname === '/admin/plugins' && 'bg-muted font-medium')}
      >
        All Plugins
      </Link>
      {configs.map((config) => (
        <Link
          key={config.pluginName}
          href={`/admin/plugins/${config.pluginName}`}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted',
            pathname === `/admin/plugins/${config.pluginName}` && 'bg-muted font-medium',
          )}
        >
          <span className={cn('size-2 shrink-0 rounded-full', config.enabled ? 'bg-green-500' : 'bg-muted-foreground')} />
          {config.pluginName}
        </Link>
      ))}
    </nav>
  );
};
