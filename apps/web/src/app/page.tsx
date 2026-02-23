import { Button } from 'ui';

const Home = () => {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center p-24'>
      <main className='flex flex-col items-center gap-8 text-center'>
        <h1 className='text-6xl font-bold tracking-tight'>Harness Dashboard</h1>
        <p className='text-xl text-muted-foreground max-w-2xl'>Monitor threads, tasks, cron jobs, and agent activity in real time.</p>
        <div className='flex gap-4'>
          <Button size='lg'>View Threads</Button>
          <Button variant='outline' size='lg'>
            View Tasks
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Home;
