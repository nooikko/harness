import { prisma } from '@harness/database';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminBreadcrumb } from '../../../_components/admin-breadcrumb';
import { SshHostForm } from '../../_components/ssh-host-form';

type EditSshHostPageProps = {
  params: Promise<{ id: string }>;
};

export const generateMetadata = async ({ params }: EditSshHostPageProps): Promise<Metadata> => {
  const { id } = await params;
  const host = await prisma.sshHost.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: host ? `Edit ${host.name} | Admin | Harness Dashboard` : 'Host Not Found',
  };
};

type EditSshHostPageComponent = (props: EditSshHostPageProps) => Promise<React.ReactNode>;

const EditSshHostPage: EditSshHostPageComponent = async ({ params }) => {
  const { id } = await params;

  const host = await prisma.sshHost.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      hostname: true,
      port: true,
      username: true,
      authMethod: true,
      tags: true,
      enabled: true,
      privateKey: true, // only used to derive hasKey boolean below, never sent to client
    },
  });

  if (!host) {
    notFound();
  }

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <AdminBreadcrumb labels={{ [id]: host.name }} />
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>Edit: {host.name}</h1>
          <p className='text-sm text-muted-foreground'>Update the connection details or replace the SSH key.</p>
        </div>
      </div>
      <SshHostForm
        mode='edit'
        hasKey={!!host.privateKey}
        defaultValues={{
          id: host.id,
          name: host.name,
          hostname: host.hostname,
          port: host.port,
          username: host.username,
          authMethod: host.authMethod,
          tags: host.tags,
          enabled: host.enabled,
        }}
      />
    </div>
  );
};

export default EditSshHostPage;
