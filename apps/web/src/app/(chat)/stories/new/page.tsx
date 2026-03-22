import type { Metadata } from 'next';
import { listAgents } from '../../chat/_actions/list-agents';
import { CreateStoryForm } from '../_components/create-story-form';

export const metadata: Metadata = {
  title: 'New Story | Harness Dashboard',
};

const NewStoryPage = async () => {
  const agents = await listAgents();

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-1'>
        <h1 className='text-lg font-semibold tracking-tight'>New Story</h1>
        <p className='text-sm text-muted-foreground'>Start a new interactive narrative.</p>
      </div>
      <CreateStoryForm agents={agents.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  );
};

export default NewStoryPage;
