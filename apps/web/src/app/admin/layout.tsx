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
    <div className='flex h-full flex-1'>
      <AdminSidebar />
      <main className='flex-1 overflow-auto'>{children}</main>
    </div>
  );
};

export default AdminLayout;
