import type { Metadata } from 'next';
import { CreateAgentForm } from '../_components/create-agent-form';

export const metadata: Metadata = {
  title: 'New Agent | Harness Dashboard',
  description: 'Create a new AI agent',
};

const NewAgentPage = () => {
  return (
    <div className='flex w-full flex-col gap-6 p-6 max-w-3xl'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>New Agent</h1>
        <p className='text-sm text-muted-foreground'>Define a new AI agent persona with soul and identity.</p>
      </div>
      <CreateAgentForm />
    </div>
  );
};

export default NewAgentPage;
