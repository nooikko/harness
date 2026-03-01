import { prisma } from '@harness/database';
import { PluginsNav } from './_components/plugins-nav';

type PluginsLayoutProps = { children: React.ReactNode };

type PluginsLayoutComponent = (props: PluginsLayoutProps) => Promise<React.ReactNode>;

const PluginsLayout: PluginsLayoutComponent = async ({ children }) => {
  const configs = await prisma.pluginConfig.findMany({ orderBy: { pluginName: 'asc' } });

  return (
    <div className='flex min-h-[calc(100vh-4rem)]'>
      <aside className='w-56 shrink-0 border-r'>
        <div className='p-4'>
          <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Plugins</p>
        </div>
        <PluginsNav configs={configs} />
      </aside>
      <main className='flex-1 overflow-auto'>{children}</main>
    </div>
  );
};

export default PluginsLayout;
