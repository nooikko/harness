'use client';

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
} from '@harness/ui';
import { Check, Copy, KeyRound, Loader2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createSshHost } from '../_actions/create-ssh-host';
import { generateSshKey } from '../_actions/generate-ssh-key';
import { installSshKey } from '../_actions/install-ssh-key';
import { updateSshHost } from '../_actions/update-ssh-host';

type SshHostFormProps = {
  mode: 'create' | 'edit';
  hasKey?: boolean;
  defaultValues?: {
    id?: string;
    name?: string;
    hostname?: string;
    port?: number;
    username?: string;
    authMethod?: string;
    tags?: string[];
    enabled?: boolean;
  };
};

type SshHostFormComponent = (props: SshHostFormProps) => React.ReactNode;

const parseTags = (raw: string): string[] =>
  raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

export const SshHostForm: SshHostFormComponent = ({ mode, hasKey: initialHasKey, defaultValues }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(defaultValues?.name ?? '');
  const [hostname, setHostname] = useState(defaultValues?.hostname ?? '');
  const [port, setPort] = useState(String(defaultValues?.port ?? 22));
  const [username, setUsername] = useState(defaultValues?.username ?? '');
  const [authMethod, setAuthMethod] = useState(defaultValues?.authMethod ?? 'key');
  const [privateKey, setPrivateKey] = useState('');
  const [generatedPublicKey, setGeneratedPublicKey] = useState<string | null>(null);
  const [tagsRaw, setTagsRaw] = useState((defaultValues?.tags ?? []).join(', '));
  const [enabled, setEnabled] = useState(defaultValues?.enabled ?? true);
  const [copied, setCopied] = useState(false);
  const [keyInstalled, setKeyInstalled] = useState(initialHasKey ?? false);
  const [showKeyReplace, setShowKeyReplace] = useState(false);
  const [isInstalling, startInstallTransition] = useTransition();
  const [installPassword, setInstallPassword] = useState('');
  const [installSuccess, setInstallSuccess] = useState(false);

  const handleInstallKey = () => {
    if (!defaultValues?.id || !installPassword) {
      return;
    }
    setError(null);
    setSuccess(false);
    setInstallSuccess(false);

    startInstallTransition(async () => {
      const result = await installSshKey({
        hostId: defaultValues.id!,
        hostname,
        port: Number.parseInt(port, 10),
        username,
        password: installPassword,
      });

      if ('error' in result) {
        setError(result.error);
        setTimeout(() => setInstallPassword(''), 3000);
        return;
      }

      setInstallPassword('');
      setInstallSuccess(true);
      setKeyInstalled(true);
      setShowKeyReplace(false);
      setAuthMethod('key');
      router.refresh();
    });
  };

  const handleGenerateKey = () => {
    startGenerateTransition(async () => {
      const result = await generateSshKey();
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setPrivateKey(result.privateKey);
      setGeneratedPublicKey(result.publicKey);
      setError(null);
    });
  };

  const handleCopyPublicKey = () => {
    if (!generatedPublicKey) {
      return;
    }
    void navigator.clipboard.writeText(generatedPublicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setInstallSuccess(false);

    const parsedPort = Number.parseInt(port, 10);

    startTransition(async () => {
      if (mode === 'create') {
        const result = await createSshHost({
          name,
          hostname,
          port: parsedPort,
          username,
          authMethod,
          privateKey: authMethod === 'key' && privateKey ? privateKey : undefined,
          tags: parseTags(tagsRaw),
        });

        if ('error' in result) {
          setError(result.error);
          return;
        }

        router.push('/admin/ssh-hosts');
      } else {
        const result = await updateSshHost({
          id: defaultValues?.id ?? '',
          name,
          hostname,
          port: parsedPort,
          username,
          authMethod,
          privateKey: authMethod === 'key' && privateKey ? privateKey : undefined,
          tags: parseTags(tagsRaw),
        });

        if ('error' in result) {
          setError(result.error);
          return;
        }

        setSuccess(true);
        setPrivateKey(''); // Clear after save
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Add SSH Host' : 'Edit SSH Host'}</CardTitle>
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
              <AlertDescription>SSH host updated successfully.</AlertDescription>
            </Alert>
          )}

          {/* Name */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='ssh-host-name'>Name</Label>
            <Input
              id='ssh-host-name'
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder='e.g. prod-web-01'
              required
            />
          </div>

          {/* Hostname + Port row */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem]'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='ssh-host-hostname'>Hostname</Label>
              <Input
                id='ssh-host-hostname'
                value={hostname}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHostname(e.target.value)}
                placeholder='e.g. 192.168.1.100 or host.example.com'
                required
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='ssh-host-port'>Port</Label>
              <Input
                id='ssh-host-port'
                type='number'
                min={1}
                max={65535}
                value={port}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPort(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Username + Auth Method row */}
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='ssh-host-username'>Username</Label>
              <Input
                id='ssh-host-username'
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                placeholder='e.g. ubuntu'
                required
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='ssh-host-auth-method'>Auth Method</Label>
              <Select value={authMethod} onValueChange={setAuthMethod}>
                <SelectTrigger id='ssh-host-auth-method'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='key'>SSH Key</SelectItem>
                  <SelectItem value='password'>Password</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SSH Key section — only when auth method is key */}
          {authMethod === 'key' && (
            <>
              <Separator />
              {keyInstalled && !showKeyReplace ? (
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <Check className='h-4 w-4 text-green-400' />
                    <span className='text-sm text-muted-foreground'>SSH key is configured</span>
                  </div>
                  <Button type='button' variant='ghost' size='sm' className='text-xs' onClick={() => setShowKeyReplace(true)}>
                    Replace key
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col gap-3'>
                  <div className='flex items-center justify-between'>
                    <div className='flex flex-col gap-0.5'>
                      <Label htmlFor='ssh-host-private-key'>
                        Private Key
                        {mode === 'edit' && <span className='ml-1 text-xs text-muted-foreground'>(leave blank to keep existing)</span>}
                      </Label>
                      <p className='text-xs text-muted-foreground'>
                        OpenSSH-format private key. Use 'Generate Key Pair' or 'Install Key' for automatic setup.
                      </p>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='gap-1.5 shrink-0'
                      onClick={handleGenerateKey}
                      disabled={isGenerating}
                    >
                      {isGenerating ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <KeyRound className='h-3.5 w-3.5' />}
                      Generate Key Pair
                    </Button>
                  </div>
                  <Textarea
                    id='ssh-host-private-key'
                    value={privateKey}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrivateKey(e.target.value)}
                    placeholder='-----BEGIN PRIVATE KEY-----&#10;...'
                    rows={6}
                    className='font-mono resize-y text-xs'
                  />

                  {/* Generated public key display */}
                  {generatedPublicKey && (
                    <div className='flex flex-col gap-1.5'>
                      <div className='flex items-center justify-between'>
                        <Label className='text-xs text-muted-foreground'>Public Key (copy to authorized_keys)</Label>
                        <Button type='button' variant='ghost' size='sm' className='h-6 gap-1 px-2 text-xs' onClick={handleCopyPublicKey}>
                          <Copy className='h-3 w-3' />
                          {copied ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <Textarea readOnly value={generatedPublicKey} rows={4} className='font-mono text-xs resize-none bg-muted/50' />
                    </div>
                  )}

                  {/* Install Key via password — edit mode only */}
                  {mode === 'edit' && defaultValues?.id && (
                    <>
                      <Separator />
                      <div className='flex flex-col gap-3'>
                        <div className='flex flex-col gap-0.5'>
                          <Label>Install Key Automatically</Label>
                          <p className='text-xs text-muted-foreground'>
                            Enter the host password once to generate and install an SSH key. The password is used server-side and never stored.
                          </p>
                        </div>
                        {installSuccess ? (
                          <div className='flex items-center gap-2 rounded-md border border-green-800 bg-green-950 p-3 text-sm text-green-200'>
                            <Check className='h-4 w-4 shrink-0' />
                            Key generated and installed. Future connections will use key auth.
                          </div>
                        ) : (
                          <div className='flex items-center gap-2'>
                            <Input
                              type='password'
                              value={installPassword}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInstallPassword(e.target.value)}
                              placeholder='Host password'
                              className='flex-1'
                            />
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              className='gap-1.5 shrink-0'
                              onClick={handleInstallKey}
                              disabled={isInstalling || !installPassword}
                            >
                              {isInstalling ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Upload className='h-3.5 w-3.5' />}
                              Install Key
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
              <Separator />
            </>
          )}

          {/* Tags */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='ssh-host-tags'>
              Tags
              <span className='ml-1 text-xs text-muted-foreground'>(optional, comma-separated)</span>
            </Label>
            <Input
              id='ssh-host-tags'
              value={tagsRaw}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagsRaw(e.target.value)}
              placeholder='e.g. production, web, nginx'
            />
          </div>

          {/* Enabled */}
          <div className='flex items-center gap-2'>
            <Switch id='ssh-host-enabled' aria-label='Enabled' checked={enabled} onCheckedChange={setEnabled} />
            <Label htmlFor='ssh-host-enabled' className='font-normal cursor-pointer'>
              Enabled
            </Label>
          </div>

          {/* Actions */}
          <div className='flex justify-end gap-3'>
            <Button type='button' variant='outline' onClick={() => router.push('/admin/ssh-hosts')} disabled={isPending}>
              Cancel
            </Button>
            <Button type='submit' disabled={isPending}>
              {isPending ? (mode === 'create' ? 'Adding...' : 'Saving...') : mode === 'create' ? 'Add Host' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
