'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { createStory } from '../../chat/_actions/create-story';

type AgentOption = { id: string; name: string };

type CreateStoryFormProps = {
  agents: AgentOption[];
};

type CreateStoryFormComponent = (props: CreateStoryFormProps) => React.ReactNode;

export const CreateStoryForm: CreateStoryFormComponent = ({ agents }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [premise, setPremise] = useState('');
  const [agentId, setAgentId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      startTransition(async () => {
        const result = await createStory({
          name,
          premise: premise || undefined,
          agentId: agentId || undefined,
        });
        if ('error' in result) {
          setError(result.error);
          return;
        }
        router.push(`/stories/${result.storyId}`);
      });
    },
    [name, premise, agentId, router],
  );

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='story-name'>Name</Label>
        <Input id='story-name' value={name} onChange={(e) => setName(e.target.value)} placeholder='The Elena Arc' required />
      </div>

      <div className='flex flex-col gap-2'>
        <Label htmlFor='story-premise'>Premise</Label>
        <Textarea
          id='story-premise'
          value={premise}
          onChange={(e) => setPremise(e.target.value)}
          placeholder='Setting, genre, rules, or initial scene...'
          rows={4}
        />
      </div>

      <div className='flex flex-col gap-2'>
        <Label htmlFor='story-agent'>Agent</Label>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger id='story-agent'>
            <SelectValue placeholder='Select an agent (optional)' />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className='text-sm text-destructive'>{error}</p>}

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='outline' onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Story'}
        </Button>
      </div>
    </form>
  );
};
