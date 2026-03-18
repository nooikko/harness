'use client';

import { AlertTriangle, CheckCircle2, Circle, Clock, ListTodo } from 'lucide-react';
import type { ContentBlockProps } from './registry';

type Task = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  projectName?: string;
  blockedBy?: string[];
};

type PriorityColor = (priority?: string) => string;

const priorityColor: PriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'critical':
    case 'urgent':
      return 'text-destructive';
    case 'high':
      return 'text-orange-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-muted-foreground/50';
    default:
      return 'text-muted-foreground';
  }
};

type StatusIcon = (status: string) => React.ReactNode;

const statusIcon: StatusIcon = (status) => {
  switch (status.toUpperCase()) {
    case 'DONE':
    case 'COMPLETED':
      return <CheckCircle2 className='h-4 w-4 text-green-500' />;
    case 'IN_PROGRESS':
    case 'ACTIVE':
      return <Clock className='h-4 w-4 text-primary' />;
    case 'BLOCKED':
      return <AlertTriangle className='h-4 w-4 text-destructive' />;
    default:
      return <Circle className='h-4 w-4 text-muted-foreground/40' />;
  }
};

type FormatDueDate = (iso: string) => { text: string; isOverdue: boolean };

const formatDueDate: FormatDueDate = (iso) => {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    }
    if (diffDays === 0) {
      return { text: 'Due today', isOverdue: false };
    }
    if (diffDays === 1) {
      return { text: 'Due tomorrow', isOverdue: false };
    }
    if (diffDays <= 7) {
      return { text: `Due in ${diffDays}d`, isOverdue: false };
    }
    return { text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), isOverdue: false };
  } catch {
    return { text: iso, isOverdue: false };
  }
};

type TaskListBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const TaskListBlock: TaskListBlockComponent = ({ data }) => {
  const tasks = (data.tasks ?? []) as Task[];
  const doneCount = tasks.filter((t) => t.status.toUpperCase() === 'DONE' || t.status.toUpperCase() === 'COMPLETED').length;

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
        <ListTodo className='h-3.5 w-3.5' />
        <span>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          {doneCount > 0 && <span className='ml-1 text-green-500'>({doneCount} done)</span>}
        </span>
      </div>
      <div className='space-y-0.5'>
        {tasks.map((task) => {
          const due = task.dueDate ? formatDueDate(task.dueDate) : null;
          const isDone = task.status.toUpperCase() === 'DONE' || task.status.toUpperCase() === 'COMPLETED';

          return (
            <div key={task.id} className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${isDone ? 'opacity-50' : 'hover:bg-muted/20'}`}>
              <div className='mt-0.5 shrink-0'>{statusIcon(task.status)}</div>
              <div className='min-w-0 flex-1'>
                <p className={`text-sm ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                <div className='mt-0.5 flex flex-wrap items-center gap-2 text-xs'>
                  {task.priority && <span className={`font-medium ${priorityColor(task.priority)}`}>{task.priority}</span>}
                  {due && <span className={due.isOverdue ? 'text-destructive' : 'text-muted-foreground'}>{due.text}</span>}
                  {task.projectName && <span className='rounded bg-muted px-1.5 py-0.5 text-muted-foreground'>{task.projectName}</span>}
                  {task.blockedBy && task.blockedBy.length > 0 && <span className='text-destructive/70'>blocked by {task.blockedBy.length}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskListBlock;
