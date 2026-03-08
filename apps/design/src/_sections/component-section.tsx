import { ChevronDownIcon, CopyIcon, PencilIcon, PlusCircleIcon, XIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type React from 'react';
import { useState } from 'react';
import { Alert } from '../components/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/alert-dialog';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/collapsible';
import { CommandDialog, CommandEmpty, CommandFooter, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/command';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/dropdown-menu';
import { Input } from '../components/input';
import { Kbd } from '../components/kbd';
import { Label } from '../components/label';
import { Popover, PopoverContent, PopoverTrigger } from '../components/popover';
import { Progress } from '../components/progress';
import { ScrollArea } from '../components/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/select';
import { Separator } from '../components/separator';
import { Skeleton } from '../components/skeleton';
import { Switch } from '../components/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/table';
import { Tabs, TabsList, TabsTrigger } from '../components/tabs';
import { Textarea } from '../components/textarea';
import { Tooltip } from '../components/tooltip';

// ─── Shared ───────────────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}
  >
    {children}
  </div>
);

const focusRing = { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px oklch(0.540 0.165 285 / 0.12)' };
const noRing = { borderColor: 'var(--border)', boxShadow: '0 0 0 0px transparent' };

// ─── Buttons ──────────────────────────────────────────────────────────────────
const ButtonShowcase = () => (
  <div>
    <SectionLabel>Buttons</SectionLabel>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant='default'>Send message</Button>
        <Button variant='ghost'>Cancel</Button>
        <Button variant='destructive'>Delete thread</Button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant='ghost' size='sm'>
          + New chat
        </Button>
        <Button variant='secondary' size='sm'>
          Edit agent
        </Button>
      </div>
    </div>
  </div>
);

// ─── Badges ───────────────────────────────────────────────────────────────────
const BadgeShowcase = () => (
  <div>
    <SectionLabel>Badges</SectionLabel>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Badge variant='active'>Active</Badge>
      <Badge variant='success'>Success</Badge>
      <Badge variant='warning'>Warning</Badge>
      <Badge variant='error'>Error</Badge>
      <Badge variant='neutral'>Neutral</Badge>
    </div>
  </div>
);

// ─── Label ────────────────────────────────────────────────────────────────────
const LabelShowcase = () => (
  <div>
    <SectionLabel>Label</SectionLabel>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 280 }}>
      <Label htmlFor='agent-name'>Agent name</Label>
      <Input id='agent-name' placeholder='Primary Assistant' />
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Shown in the sidebar and chat header.</span>
    </div>
  </div>
);

// ─── Input ────────────────────────────────────────────────────────────────────
const InputShowcase = () => (
  <div>
    <SectionLabel>Input</SectionLabel>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
      <Input type='text' placeholder='Search threads...' />
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Focus to see accent ring</span>
    </div>
  </div>
);

// ─── Textarea ─────────────────────────────────────────────────────────────────
const TextareaShowcase = () => (
  <div>
    <SectionLabel>Textarea</SectionLabel>
    <div style={{ maxWidth: 320 }}>
      <Textarea placeholder='Write agent instructions...' rows={4} />
    </div>
  </div>
);

// ─── Select ───────────────────────────────────────────────────────────────────
const SelectShowcase = () => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <SectionLabel>Select</SectionLabel>
      <Select open={open} onOpenChange={setOpen} defaultValue='haiku'>
        <SelectTrigger className='w-60'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent sideOffset={4}>
          <SelectItem value='haiku'>claude-haiku-4-5</SelectItem>
          <SelectItem value='sonnet'>claude-sonnet-4-6</SelectItem>
          <SelectItem value='opus'>claude-opus-4-6</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

// ─── Card ─────────────────────────────────────────────────────────────────────
const CardShowcase = () => (
  <div>
    <SectionLabel>Card</SectionLabel>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
      {/* Card with header, content, footer */}
      <Card>
        <CardHeader>
          <CardTitle>Morning Digest</CardTitle>
          <CardDescription>Runs daily at 7:00 AM</CardDescription>
        </CardHeader>
        <CardContent>Summarize overnight emails, calendar for today, and any pending tasks.</CardContent>
        <CardFooter>
          <Button variant='ghost' size='sm'>
            Edit
          </Button>
          <Button variant='default' size='sm'>
            Run now
          </Button>
        </CardFooter>
      </Card>

      {/* Flat card — content only */}
      <Card>
        <CardHeader>
          <CardDescription className='uppercase tracking-widest text-[11px] font-semibold'>Memory</CardDescription>
        </CardHeader>
        <CardContent className='text-foreground'>Quinn prefers concise responses and dislikes unnecessary qualifiers.</CardContent>
      </Card>
    </div>
  </div>
);

// ─── Alert ────────────────────────────────────────────────────────────────────
const AlertShowcase = () => (
  <div>
    <SectionLabel>Alert</SectionLabel>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 380 }}>
      <Alert variant='info' icon='ℹ'>
        Context files updated. Changes take effect next message.
      </Alert>
      <Alert variant='success' icon='✓'>
        Agent identity saved successfully.
      </Alert>
      <Alert variant='warning' icon='⚠'>
        Token limit approaching. Consider summarizing this thread.
      </Alert>
      <Alert variant='destructive' icon='✕'>
        Pipeline failed. Claude returned an empty response.
      </Alert>
    </div>
  </div>
);

// ─── Alert Dialog ─────────────────────────────────────────────────────────────
const AlertDialogShowcase = () => (
  <div>
    <SectionLabel>Alert Dialog</SectionLabel>
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>Delete thread</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete thread?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>Morning Digest</strong> and all its messages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className='bg-destructive text-white hover:bg-destructive/90'>Delete thread</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);

// ─── Dialog ───────────────────────────────────────────────────────────────────
const DialogShowcase = () => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <SectionLabel>Dialog</SectionLabel>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant='ghost'>Edit agent</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
            <DialogDescription>Update your agent's identity and soul.</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Name', placeholder: 'Primary Assistant' },
              { label: 'Role', placeholder: 'Personal AI assistant' },
            ].map(({ label, placeholder }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor={`dialog-${label}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {label}
                </label>
                <motion.div
                  animate={focused ? focusRing : noRing}
                  transition={{ duration: 0.15 }}
                  style={{ border: '1px solid', borderRadius: 'var(--radius-md)', background: 'var(--surface-page)' }}
                >
                  <input
                    id={`dialog-${label}`}
                    placeholder={placeholder}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{
                      padding: '9px 12px',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      width: '100%',
                    }}
                  />
                </motion.div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='ghost'>Cancel</Button>
            </DialogClose>
            <Button variant='default'>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Dropdown Menu ────────────────────────────────────────────────────────────
const DropdownMenuShowcase = () => (
  <div>
    <SectionLabel>Dropdown Menu</SectionLabel>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost'>Thread options ▾</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>
          <PencilIcon />
          Rename thread
        </DropdownMenuItem>
        <DropdownMenuItem>
          <PlusCircleIcon />
          Add to project
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CopyIcon />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant='destructive'>
          <XIcon />
          Delete thread
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

// ─── Popover ──────────────────────────────────────────────────────────────────
const PopoverShowcase = () => (
  <div>
    <SectionLabel>Popover</SectionLabel>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='ghost'>Filter threads</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 12,
          }}
        >
          Filter by
        </div>
        {['All threads', 'Cron jobs', 'With agent', 'Archived'].map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 'var(--radius-sm)',
                border: '1.5px solid',
                borderColor: i === 0 ? 'var(--accent)' : 'var(--border)',
                background: i === 0 ? 'var(--accent)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i === 0 && <span style={{ color: 'white', fontSize: 9, lineHeight: 1 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  </div>
);

// ─── Command ──────────────────────────────────────────────────────────────────
const COMMAND_ITEMS = [
  {
    group: 'Threads',
    items: [
      { icon: '↗', label: 'Morning Digest' },
      { icon: '↗', label: 'Dev planning' },
    ],
  },
  {
    group: 'Actions',
    items: [
      { icon: '+', label: 'New chat' },
      { icon: '⊕', label: 'New agent' },
      { icon: '⚙', label: 'Settings' },
    ],
  },
];

const CommandShowcase = () => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <SectionLabel>Command</SectionLabel>
      <Button variant='ghost' onClick={() => setOpen(true)}>
        Search or jump to…
        <Kbd>⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder='Search threads, agents, actions…' />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {COMMAND_ITEMS.map(({ group, items }) => (
            <CommandGroup key={group} heading={group}>
              {items.map(({ icon, label }) => (
                <CommandItem key={label} onSelect={() => setOpen(false)}>
                  <span style={{ color: 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>{icon}</span>
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
        <CommandFooter />
      </CommandDialog>
    </div>
  );
};

// ─── Collapsible ──────────────────────────────────────────────────────────────
const CollapsibleShowcase = () => (
  <div>
    <SectionLabel>Collapsible</SectionLabel>
    <Collapsible className='max-w-xs'>
      <CollapsibleTrigger className='flex w-full cursor-pointer items-center justify-between rounded-md border border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50 data-[state=open]:rounded-b-none'>
        Agent memories
        <ChevronDownIcon className='size-3.5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180' />
      </CollapsibleTrigger>
      <CollapsibleContent className='rounded-b-md border border-t-0 border-border'>
        {['Quinn prefers concise responses.', 'Works best with morning check-ins.', 'Dislikes unnecessary qualifiers.'].map((memory, i) => (
          <div key={i} className={`px-3.5 py-2 text-xs leading-relaxed text-muted-foreground${i > 0 ? ' border-t border-border/60' : ''}`}>
            {memory}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  </div>
);

// ─── Scroll Area ──────────────────────────────────────────────────────────────
const THREAD_NAMES = [
  'Morning Digest',
  'Dev planning',
  'Kitchen lights',
  'Music queue',
  'Calendar sync',
  'Weekly review',
  'Agent report',
  'Task list',
  'Project notes',
  'Memory review',
  'Code review',
  'Daily standup',
];

const ScrollAreaShowcase = () => (
  <div>
    <SectionLabel>Scroll Area</SectionLabel>
    <ScrollArea className='rounded-md border border-border bg-card' style={{ width: 280, height: 160 }}>
      {THREAD_NAMES.map((name, i) => (
        <div key={i} style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          Thread {i + 1} — {name}
        </div>
      ))}
    </ScrollArea>
  </div>
);

// ─── Table ────────────────────────────────────────────────────────────────────
const TABLE_ROWS = [
  { thread: 'Morning Digest', agent: 'Primary Assistant', model: 'haiku-4-5', tokens: '1,240', status: 'Active' },
  { thread: 'Dev planning', agent: 'Primary Assistant', model: 'sonnet-4-6', tokens: '8,430', status: 'Active' },
  { thread: 'Kitchen lights', agent: 'Home Agent', model: 'haiku-4-5', tokens: '312', status: 'Active' },
  { thread: 'Weekly review', agent: 'Primary Assistant', model: 'opus-4-6', tokens: '22,100', status: 'Archived' },
];

const TableShowcase = () => (
  <div>
    <SectionLabel>Table</SectionLabel>
    <Table style={{ maxWidth: 520 }}>
      <TableHeader>
        {['Thread', 'Agent', 'Model', 'Tokens', 'Status'].map((h) => (
          <TableHead key={h}>{h}</TableHead>
        ))}
      </TableHeader>
      <TableBody>
        {TABLE_ROWS.map((row, i) => (
          <TableRow key={i}>
            <TableCell variant='primary'>{row.thread}</TableCell>
            <TableCell>{row.agent}</TableCell>
            <TableCell variant='mono'>{row.model}</TableCell>
            <TableCell variant='mono'>{row.tokens}</TableCell>
            <TableCell>
              <span
                style={{
                  padding: '2px 8px',
                  background: row.status === 'Active' ? 'var(--accent-subtle)' : 'var(--surface-active)',
                  color: row.status === 'Active' ? 'var(--accent)' : 'var(--text-tertiary)',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {row.status}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

// ─── Switch ───────────────────────────────────────────────────────────────────
const SwitchShowcase = () => {
  const [states, setStates] = useState({ memory: true, reflection: false, notifications: true });
  const toggle = (key: keyof typeof states) => setStates((s) => ({ ...s, [key]: !s[key] }));
  return (
    <div>
      <SectionLabel>Switch</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(Object.entries(states) as [keyof typeof states, boolean][]).map(([key, on]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 240 }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{key}</span>
            <Switch checked={on} onCheckedChange={() => toggle(key)} />
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
const TabsShowcase = () => (
  <div>
    <SectionLabel>Tabs</SectionLabel>
    <Tabs defaultValue='Overview' className='max-w-[400px]'>
      <TabsList>
        {['Overview', 'Memory', 'Activity', 'Settings'].map((tab) => (
          <TabsTrigger key={tab} value={tab}>
            {tab}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  </div>
);

// ─── Progress ─────────────────────────────────────────────────────────────────
const ProgressShowcase = () => (
  <div>
    <SectionLabel>Progress</SectionLabel>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
      {[
        { label: 'Pipeline', value: 0.72 },
        { label: 'Token usage', value: 0.38 },
        { label: 'Memory capacity', value: 0.91 },
      ].map(({ label, value }) => (
        <Progress key={label} label={label} value={value} />
      ))}
    </div>
  </div>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonShowcase = () => (
  <div>
    <SectionLabel>Skeleton</SectionLabel>
    <div className='flex max-w-[280px] flex-col gap-2.5'>
      {[0, 1, 2].map((i) => (
        <div key={i} className='flex items-center gap-2.5'>
          <Skeleton className='size-8 shrink-0' style={{ animationDelay: `${i * 0.1}s` }} />
          <div className='flex flex-1 flex-col gap-1.5'>
            <Skeleton className='h-3' style={{ width: `${70 - i * 10}%`, animationDelay: `${i * 0.1}s` }} />
            <Skeleton className='h-2.5' style={{ width: `${50 - i * 5}%`, animationDelay: `${i * 0.15}s` }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const TooltipShowcase = () => (
  <div>
    <SectionLabel>Tooltip</SectionLabel>
    <div className='flex gap-2'>
      {[
        { label: '⌘K', tip: 'Command palette' },
        { label: '⌘N', tip: 'New chat' },
        { label: '⌘/', tip: 'Toggle sidebar' },
      ].map(({ label, tip }) => (
        <Tooltip key={label} content={tip}>
          <Kbd>{label}</Kbd>
        </Tooltip>
      ))}
    </div>
  </div>
);

// ─── Separator ────────────────────────────────────────────────────────────────
const SeparatorShowcase = () => (
  <div>
    <SectionLabel>Separator</SectionLabel>
    <div className='flex max-w-xs flex-col gap-4'>
      <Separator />
      <div className='flex items-center gap-2.5'>
        <Separator className='flex-1' />
        <span className='text-[11px] font-medium text-muted-foreground'>Today</span>
        <Separator className='flex-1' />
      </div>
    </div>
  </div>
);

// ─── Main section ─────────────────────────────────────────────────────────────
export const ComponentSection = () => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Components</h1>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 14 }}>Full packages/ui primitive stack. Approve here, implement there.</p>
    <p style={{ color: 'var(--text-tertiary)', marginBottom: 48, fontSize: 13 }}>
      Chat input, message bubbles, pipeline indicator, and widget card are design targets — they get their own section when we're ready to build them.
    </p>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <ButtonShowcase />
        <BadgeShowcase />
        <LabelShowcase />
        <InputShowcase />
        <TextareaShowcase />
        <SelectShowcase />
        <CardShowcase />
        <AlertShowcase />
        <TableShowcase />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <SwitchShowcase />
        <TabsShowcase />
        <ProgressShowcase />
        <SkeletonShowcase />
        <TooltipShowcase />
        <SeparatorShowcase />
        <CollapsibleShowcase />
        <ScrollAreaShowcase />
        <DropdownMenuShowcase />
        <PopoverShowcase />
        <DialogShowcase />
        <AlertDialogShowcase />
        <CommandShowcase />
      </div>
    </div>
  </div>
);
