'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@harness/ui';
import { useRef, useState, useTransition } from 'react';
import { renameThread } from '../_actions/rename-thread';
import { updateThreadInstructions } from '../_actions/update-thread-instructions';
import { updateThreadModel } from '../_actions/update-thread-model';
import { updateThreadProject } from '../_actions/update-thread-project';

type ProjectOption = {
  id: string;
  name: string;
};

type ManageThreadModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  currentName: string | null;
  currentModel: string | null;
  currentInstructions: string | null;
  currentProjectId: string | null;
  projects: ProjectOption[];
};

// Sentinel value for the default (Haiku) model option — Radix Select forbids empty string values.
const MODEL_DEFAULT_SENTINEL = 'default';

const MODEL_OPTIONS: { value: string; label: string; description?: string }[] = [
  { value: MODEL_DEFAULT_SENTINEL, label: 'Haiku', description: 'Default' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
  { value: 'claude-opus-4-6', label: 'Opus' },
];

type ManageThreadModalComponent = (props: ManageThreadModalProps) => React.ReactNode;

// Sentinel value for the "no project" option — Radix Select forbids empty string values.
const PROJECT_NONE_SENTINEL = '_none';

export const ManageThreadModal: ManageThreadModalComponent = ({
  open,
  onOpenChange,
  threadId,
  currentName,
  currentModel,
  currentInstructions,
  currentProjectId,
  projects,
}) => {
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<string>(currentModel ?? MODEL_DEFAULT_SENTINEL);
  const projectRef = useRef<string>(currentProjectId ?? PROJECT_NONE_SENTINEL);
  const [customInstructions, setCustomInstructions] = useState(currentInstructions ?? '');

  const handleSave = () => {
    startTransition(async () => {
      const newName = nameRef.current?.value ?? '';
      const newModelValue = modelRef.current;
      // Convert sentinel back to null (no model override = use default Haiku)
      const newModel = newModelValue === MODEL_DEFAULT_SENTINEL ? null : newModelValue;
      const newProjectId = projectRef.current === PROJECT_NONE_SENTINEL ? null : projectRef.current;

      const nameChanged = newName.trim() !== (currentName ?? '').trim() && newName.trim() !== '';
      const modelChanged = newModel !== currentModel;
      const instructionsChanged = customInstructions !== (currentInstructions ?? '');
      const projectChanged = newProjectId !== currentProjectId;

      if (nameChanged) {
        await renameThread(threadId, newName);
      }
      if (modelChanged) {
        await updateThreadModel(threadId, newModel);
      }
      if (instructionsChanged) {
        await updateThreadInstructions(threadId, customInstructions);
      }
      if (projectChanged) {
        await updateThreadProject(threadId, newProjectId);
      }

      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-2'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='thread-name'>Name</Label>
            <Input id='thread-name' ref={nameRef} defaultValue={currentName ?? ''} placeholder='Chat name' />
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='thread-model'>Model</Label>
            <Select
              defaultValue={currentModel ?? MODEL_DEFAULT_SENTINEL}
              onValueChange={(val) => {
                modelRef.current = val;
              }}
            >
              <SelectTrigger id='thread-model'>
                <SelectValue placeholder='Select model' />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    {opt.description ? <span className='ml-1 text-muted-foreground'>({opt.description})</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {projects.length > 0 && (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='thread-project'>Project</Label>
              <Select
                defaultValue={currentProjectId ?? PROJECT_NONE_SENTINEL}
                onValueChange={(val) => {
                  projectRef.current = val;
                }}
              >
                <SelectTrigger id='thread-project'>
                  <SelectValue placeholder='Select project' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROJECT_NONE_SENTINEL}>None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='thread-instructions'>Custom Instructions</Label>
            <Textarea
              id='thread-instructions'
              placeholder='Additional instructions added to every prompt in this chat. Leave blank for defaults.'
              rows={3}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
