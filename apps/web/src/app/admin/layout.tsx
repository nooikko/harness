import { SidebarInset, SidebarProvider } from '@harness/ui';
import type { Metadata } from 'next';
import { AdminSidebar } from './_components/admin-sidebar';

export const metadata: Metadata = {
  title: 'Admin | Harness Dashboard',
  description: 'Manage cron jobs, plugins, tasks, agent runs, and threads',
};

type AdminLayoutProps = {
  children: React.ReactNode;
};

type AdminLayoutComponent = (props: AdminLayoutProps) => React.ReactNode;

const AdminLayout: AdminLayoutComponent = ({ children }) => {
  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <main className='flex flex-1 flex-col overflow-y-auto'>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;
