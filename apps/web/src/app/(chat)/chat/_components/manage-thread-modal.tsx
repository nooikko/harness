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
import { useRef, useTransition } from 'react';
import { renameThread } from '../_actions/rename-thread';
import { updateThreadModel } from '../_actions/update-thread-model';
import { MODEL_OPTIONS } from '../_helpers/model-options';

type ManageThreadModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  currentName: string | null;
  currentModel: string | null;
};

type ManageThreadModalComponent = (props: ManageThreadModalProps) => React.ReactNode;

export const ManageThreadModal: ManageThreadModalComponent = ({ open, onOpenChange, threadId, currentName, currentModel }) => {
  const [isPending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<string>(currentModel ?? '');

  const handleSave = () => {
    startTransition(async () => {
      const newName = nameRef.current?.value ?? '';
      const newModel = modelRef.current;

      const nameChanged = newName.trim() !== (currentName ?? '').trim() && newName.trim() !== '';
      const modelChanged = newModel !== (currentModel ?? '');

      if (nameChanged) {
        await renameThread(threadId, newName);
      }
      if (modelChanged) {
        await updateThreadModel(threadId, newModel || null);
      }

      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
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
              defaultValue={currentModel ?? ''}
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

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='thread-instructions'>Custom Instructions</Label>
            {/* TODO: wire up saving custom instructions once the DB field exists */}
            <Textarea
              id='thread-instructions'
              placeholder='Additional instructions added to every prompt in this chat. Leave blank for defaults.'
              rows={3}
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
