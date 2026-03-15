'use client';

import { Button, Label, Textarea } from '@harness/ui';
import { Check, Pencil, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { updateProject } from '../../../_actions/update-project';

type ProjectInstructionsPanelProps = {
  projectId: string;
  instructions: string | null;
};

type ProjectInstructionsPanelComponent = (props: ProjectInstructionsPanelProps) => React.ReactNode;

export const ProjectInstructionsPanel: ProjectInstructionsPanelComponent = ({ projectId, instructions }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(instructions ?? '');
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateProject(projectId, {
        instructions: value.trim() || undefined,
      });
      setIsEditing(false);
    });
  };

  const handleCancel = () => {
    setValue(instructions ?? '');
    setIsEditing(false);
  };

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <Label className='text-sm font-medium'>Instructions</Label>
        {!isEditing && (
          <button type='button' onClick={() => setIsEditing(true)} className='rounded-md p-1 text-muted-foreground hover:text-foreground'>
            <Pencil className='h-3.5 w-3.5' />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className='flex flex-col gap-2'>
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder='How the agent should behave in this project...' />
          <div className='flex justify-end gap-1'>
            <Button variant='ghost' size='sm' onClick={handleCancel} disabled={isPending}>
              <X className='mr-1 h-3 w-3' />
              Cancel
            </Button>
            <Button size='sm' onClick={handleSave} disabled={isPending}>
              <Check className='mr-1 h-3 w-3' />
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : instructions ? (
        <div className='rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap'>{instructions}</div>
      ) : (
        <p className='text-sm text-muted-foreground italic'>No instructions set. Add instructions to guide agent behavior.</p>
      )}
    </div>
  );
};
