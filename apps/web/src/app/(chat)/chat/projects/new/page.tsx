import type { Metadata } from 'next';
import { NewProjectPageForm } from './_components/new-project-page-form';

export const metadata: Metadata = {
  title: 'New Project | Harness Dashboard',
  description: 'Create a new project',
};

const NewProjectPage = () => {
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 animate-[fade-in_150ms_ease-out]'>
      <div className='flex flex-col gap-2'>
        <div>
          <h1 className='text-lg font-semibold tracking-tight'>New Project</h1>
          <p className='text-sm text-muted-foreground'>Create a project to group related chats and configure agent behavior.</p>
        </div>
      </div>
      <NewProjectPageForm />
    </div>
  );
};

export default NewProjectPage;
