import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@harness/ui';
import Link from 'next/link';

type ScheduledTask = {
  id: string;
  name: string;
  schedule: string | null;
  fireAt: Date | null;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
};

type AgentScheduledTasksProps = {
  tasks: ScheduledTask[];
  agentId: string;
};

const formatDate = (date: Date | null): string => {
  if (!date) {
    return '—';
  }
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) {
    return 'just now';
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return d.toLocaleDateString();
};

const formatScheduleOrFireAt = (task: ScheduledTask): string => {
  if (task.schedule) {
    return task.schedule;
  }
  if (task.fireAt) {
    return new Date(task.fireAt).toLocaleString();
  }
  return '—';
};

type AgentScheduledTasksComponent = (props: AgentScheduledTasksProps) => React.ReactNode;

export const AgentScheduledTasks: AgentScheduledTasksComponent = ({ tasks, agentId }) => {
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>Scheduled Tasks</h3>
        <Button asChild size='sm' variant='outline'>
          <Link href={`/admin/cron-jobs/new?agentId=${agentId}`}>Add Task</Link>
        </Button>
      </div>
      {tasks.length === 0 ? (
        <p className='py-8 text-center text-sm text-muted-foreground'>No scheduled tasks. Create one to automate agent invocations.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Schedule / Fire At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className='font-medium'>{task.name}</TableCell>
                <TableCell>
                  <Badge variant='outline'>{task.schedule ? 'Recurring' : 'One-shot'}</Badge>
                </TableCell>
                <TableCell className='font-mono text-sm'>{formatScheduleOrFireAt(task)}</TableCell>
                <TableCell>
                  <Badge variant={task.enabled ? 'default' : 'secondary'}>{task.enabled ? 'Enabled' : 'Disabled'}</Badge>
                </TableCell>
                <TableCell className='text-sm text-muted-foreground'>{formatDate(task.lastRunAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
