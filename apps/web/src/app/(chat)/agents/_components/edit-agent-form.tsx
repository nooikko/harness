'use client';

import { Alert, AlertDescription, Button, Input, Label, Separator, Switch, Textarea } from '@harness/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateAgent } from '../../chat/_actions/update-agent';
import { updateAgentConfig } from '../../chat/_actions/update-agent-config';

type AgentFields = {
  id: string;
  name: string;
  slug: string;
  soul: string;
  identity: string;
  userContext: string | null;
  role: string | null;
  goal: string | null;
  backstory: string | null;
  enabled: boolean;
  version: number;
};

type AgentConfigFields = {
  memoryEnabled: boolean;
  reflectionEnabled: boolean;
} | null;

type EditAgentFormProps = {
  agent: AgentFields;
  agentConfig: AgentConfigFields;
};

type EditAgentFormComponent = (props: EditAgentFormProps) => React.ReactNode;

export const EditAgentForm: EditAgentFormComponent = ({ agent, agentConfig }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(agent.name);
  const [soul, setSoul] = useState(agent.soul);
  const [identity, setIdentity] = useState(agent.identity);
  const [role, setRole] = useState(agent.role ?? '');
  const [goal, setGoal] = useState(agent.goal ?? '');
  const [backstory, setBackstory] = useState(agent.backstory ?? '');
  const [userContext, setUserContext] = useState(agent.userContext ?? '');
  const [enabled, setEnabled] = useState(agent.enabled);

  const [memoryEnabled, setMemoryEnabled] = useState(agentConfig?.memoryEnabled ?? true);
  const [reflectionEnabled, setReflectionEnabled] = useState(agentConfig?.reflectionEnabled ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const [agentResult, configResult] = await Promise.all([
        updateAgent({
          id: agent.id,
          name,
          soul,
          identity,
          userContext: userContext || null,
          role: role || null,
          goal: goal || null,
          backstory: backstory || null,
          enabled,
        }),
        updateAgentConfig({
          agentId: agent.id,
          memoryEnabled,
          reflectionEnabled,
        }),
      ]);

      if ('error' in agentResult) {
        setError(agentResult.error);
        return;
      }

      if ('error' in configResult) {
        setError(configResult.error);
        return;
      }

      setSuccess(true);
    });
  };

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-8'>
      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>Agent updated successfully.</AlertDescription>
        </Alert>
      )}

      {/* Header: Name + metadata + status */}
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='edit-agent-name'>Name</Label>
          <Input
            id='edit-agent-name'
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            required
            className='text-lg font-semibold'
          />
        </div>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <span className='font-mono'>{agent.slug}</span>
            <span>&middot;</span>
            <span>v{agent.version}</span>
          </div>
          <div className='flex items-center gap-2'>
            <Switch id='edit-agent-enabled' checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor='edit-agent-enabled' className='font-normal cursor-pointer'>
              Enabled
            </Label>
          </div>
        </div>
      </div>

      {/* Soul */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-baseline justify-between'>
          <Label htmlFor='edit-agent-soul' className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
            Soul
          </Label>
          <span className='text-xs text-muted-foreground'>
            SOUL.md &middot; v{agent.version} &rarr; v{agent.version + 1} on save
          </span>
        </div>
        <Textarea
          id='edit-agent-soul'
          value={soul}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSoul(e.target.value)}
          required
          rows={12}
          className='font-mono text-[13px] leading-relaxed resize-y'
        />
      </div>

      {/* Identity */}
      <div className='flex flex-col gap-2'>
        <div className='flex items-baseline justify-between'>
          <Label htmlFor='edit-agent-identity' className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
            Identity
          </Label>
          <span className='text-xs text-muted-foreground'>IDENTITY.md</span>
        </div>
        <Textarea
          id='edit-agent-identity'
          value={identity}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIdentity(e.target.value)}
          required
          rows={8}
          className='font-mono text-[13px] leading-relaxed resize-y'
        />
      </div>

      {/* User Context */}
      <div className='flex flex-col gap-2'>
        <div className='flex flex-col gap-0.5'>
          <Label htmlFor='edit-agent-user-context' className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
            User Context
          </Label>
          <p className='text-xs text-muted-foreground'>Information about the user that this agent should always know.</p>
        </div>
        <Textarea
          id='edit-agent-user-context'
          value={userContext}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUserContext(e.target.value)}
          rows={4}
          className='resize-y'
        />
      </div>

      {/* Character: Role, Goal, Backstory */}
      <div className='flex flex-col gap-4'>
        <h3 className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>Character</h3>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='edit-agent-role' className='text-muted-foreground'>
              Role
            </Label>
            <Input
              id='edit-agent-role'
              value={role}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
              placeholder='e.g. Research Assistant'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='edit-agent-goal' className='text-muted-foreground'>
              Goal
            </Label>
            <Input
              id='edit-agent-goal'
              value={goal}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoal(e.target.value)}
              placeholder='e.g. Help users find information'
            />
          </div>
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='edit-agent-backstory' className='text-muted-foreground'>
            Backstory
          </Label>
          <Textarea
            id='edit-agent-backstory'
            value={backstory}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBackstory(e.target.value)}
            rows={3}
            className='resize-y'
          />
        </div>
      </div>

      <Separator />

      {/* Configuration */}
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-0.5'>
          <h3 className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>Configuration</h3>
          <p className='text-xs text-muted-foreground'>Feature flags that control agent behavior at runtime.</p>
        </div>
        <div className='flex flex-col gap-3'>
          <div className='flex cursor-pointer items-center gap-3 rounded-md border border-input px-3 py-2.5 transition-colors hover:bg-accent'>
            <Switch id='edit-agent-memory-enabled' checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
            <Label htmlFor='edit-agent-memory-enabled' className='font-normal cursor-pointer'>
              <div className='flex flex-col'>
                <span className='text-sm font-medium'>Episodic Memory</span>
                <span className='text-xs text-muted-foreground'>Write memories after each conversation</span>
              </div>
            </Label>
          </div>
          <div className='flex cursor-pointer items-center gap-3 rounded-md border border-input px-3 py-2.5 transition-colors hover:bg-accent'>
            <Switch id='edit-agent-reflection-enabled' checked={reflectionEnabled} onCheckedChange={setReflectionEnabled} />
            <Label htmlFor='edit-agent-reflection-enabled' className='font-normal cursor-pointer'>
              <div className='flex flex-col'>
                <span className='text-sm font-medium'>Reflection Cycle</span>
                <span className='text-xs text-muted-foreground'>Periodic meta-reflection on memories</span>
              </div>
            </Label>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className='flex justify-end gap-3 border-t border-border pt-4'>
        <Button type='button' variant='outline' onClick={() => router.push('/agents')} disabled={isPending}>
          Back to Agents
        </Button>
        <Button type='submit' disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
};
