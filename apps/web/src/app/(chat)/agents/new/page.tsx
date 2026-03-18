import type { Metadata } from 'next';
import { CreateAgentForm } from '../_components/create-agent-form';

export const metadata: Metadata = {
  title: 'New Agent | Harness Dashboard',
  description: 'Create a new AI agent',
};

const NewAgentPage = () => {
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>New Agent</h1>
          <p className='text-sm text-muted-foreground'>Define a new AI agent persona.</p>
        </div>
      </div>
      <CreateAgentForm />
    </div>
  );
};

export default NewAgentPage;
