import { Label } from '@harness/ui';
import { Lock } from 'lucide-react';

type ProjectMemoryPanelProps = {
  memory: string | null;
};

type ProjectMemoryPanelComponent = (props: ProjectMemoryPanelProps) => React.ReactNode;

export const ProjectMemoryPanel: ProjectMemoryPanelComponent = ({ memory }) => {
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <Label className='text-sm font-medium'>Memory</Label>
        <Lock className='h-3.5 w-3.5 text-muted-foreground' />
      </div>
      {memory ? (
        <div className='rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap'>{memory}</div>
      ) : (
        <p className='text-sm text-muted-foreground italic'>No memory yet. The agent will build this over time.</p>
      )}
    </div>
  );
};
