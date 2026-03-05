'use client';

import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Separator, Switch, Textarea } from '@harness/ui';
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
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <CardTitle>Edit Agent</CardTitle>
        <div className='flex items-center gap-2'>
          <span className='text-xs text-muted-foreground'>v{agent.version}</span>
          <span className='text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded'>{agent.slug}</span>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className='flex flex-col gap-6'>
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

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-name'>Name</Label>
              <Input id='edit-agent-name' value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-enabled'>Status</Label>
              <div className='flex items-center gap-2 h-10'>
                <Switch id='edit-agent-enabled' checked={enabled} onCheckedChange={setEnabled} />
                <Label htmlFor='edit-agent-enabled' className='font-normal cursor-pointer'>
                  Enabled
                </Label>
              </div>
            </div>
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='edit-agent-soul'>
              Soul
              <span className='ml-1 text-xs text-muted-foreground'>(SOUL.md content — incrementing version {agent.version + 1} on save)</span>
            </Label>
            <Textarea
              id='edit-agent-soul'
              value={soul}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSoul(e.target.value)}
              required
              rows={10}
              className='min-h-[160px] font-mono resize-y'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='edit-agent-identity'>
              Identity
              <span className='ml-1 text-xs text-muted-foreground'>(IDENTITY.md content)</span>
            </Label>
            <Textarea
              id='edit-agent-identity'
              value={identity}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIdentity(e.target.value)}
              required
              rows={8}
              className='min-h-[120px] font-mono resize-y'
            />
          </div>

          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='edit-agent-user-context'>
              User Context
              <span className='ml-1 text-xs text-muted-foreground'>(optional — information about the user that this agent should always know)</span>
            </Label>
            <Textarea
              id='edit-agent-user-context'
              value={userContext}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setUserContext(e.target.value)}
              rows={4}
              className='min-h-[80px] resize-y'
            />
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-role'>
                Role
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Input id='edit-agent-role' value={role} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)} />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='edit-agent-goal'>
                Goal
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Input id='edit-agent-goal' value={goal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoal(e.target.value)} />
            </div>
            <div className='flex flex-col gap-1.5 sm:col-span-3'>
              <Label htmlFor='edit-agent-backstory'>
                Backstory
                <span className='ml-1 text-xs text-muted-foreground'>(optional)</span>
              </Label>
              <Textarea
                id='edit-agent-backstory'
                value={backstory}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBackstory(e.target.value)}
                rows={4}
                className='min-h-[80px] resize-y'
              />
            </div>
          </div>

          <Separator />

          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1'>
              <Label>Agent Configuration</Label>
              <p className='text-xs text-muted-foreground'>Feature flags that control agent behavior at runtime.</p>
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <div className='flex items-center gap-2'>
                <Switch id='edit-agent-memory-enabled' checked={memoryEnabled} onCheckedChange={setMemoryEnabled} />
                <Label htmlFor='edit-agent-memory-enabled' className='font-normal cursor-pointer'>
                  Episodic Memory
                  <span className='ml-1 text-xs text-muted-foreground'>(write memories after each conversation)</span>
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch id='edit-agent-reflection-enabled' checked={reflectionEnabled} onCheckedChange={setReflectionEnabled} />
                <Label htmlFor='edit-agent-reflection-enabled' className='font-normal cursor-pointer'>
                  Reflection Cycle
                  <span className='ml-1 text-xs text-muted-foreground'>(periodic meta-reflection on memories)</span>
                </Label>
              </div>
            </div>
          </div>

          <div className='flex justify-end gap-3'>
            <Button type='button' variant='outline' onClick={() => router.push('/agents')} disabled={isPending}>
              Back to Agents
            </Button>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
