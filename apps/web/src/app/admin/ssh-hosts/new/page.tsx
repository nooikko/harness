import type { Metadata } from 'next';
import { AdminBreadcrumb } from '../../_components/admin-breadcrumb';
import { SshHostForm } from '../_components/ssh-host-form';

export const metadata: Metadata = {
  title: 'Add SSH Host | Admin | Harness Dashboard',
};

type NewSshHostPageComponent = () => React.ReactNode;

const NewSshHostPage: NewSshHostPageComponent = () => {
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb />
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>Add SSH Host</h1>
          <p className='text-sm text-muted-foreground'>Configure an SSH connection target for agent automation.</p>
        </div>
      </div>
      <SshHostForm mode='create' />
    </div>
  );
};

export default NewSshHostPage;
