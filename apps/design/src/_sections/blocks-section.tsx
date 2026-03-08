import { gooeyToast } from 'goey-toast';
import { useState } from 'react';
import { ChatInput } from '../blocks/chat-input';
import { EventCard } from '../blocks/event-card';
import { AssistantMessage, UserMessage } from '../blocks/message-block';
import { SmartStack } from '../blocks/smart-stack';
import { type ThreadItem, ThreadListItem } from '../blocks/thread-list-item';

// ─── Shared ───────────────────────────────────────────────────────────────────

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: 16,
    }}
  >
    {children}
  </div>
);

const BlockGrid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>{children}</div>
);

// ─── Message Block + Event Cards ──────────────────────────────────────────────

const MessageBlockShowcase = () => {
  const [musicPlaying, setMusicPlaying] = useState(true);

  return (
    <div>
      <SectionLabel>Messages &amp; Event Cards</SectionLabel>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.6 }}>
        Event cards appear inline after the agent acts — quick controls right where the user is looking.
      </p>
      <div
        style={{
          background: 'var(--surface-page)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <UserMessage content='Dim the kitchen lights to 40% and play something chill.' />
        <AssistantMessage
          content={'Done — both running now.\n\n- **Kitchen lights** dimmed to **40%**\n- **Lo-Fi Study Beats** casting to Living Room'}
          thinking={[
            {
              summary: 'The user wants two things: dim kitchen lights to 40% and play something chill. I should call home_assistant and music tools.',
            },
          ]}
          tools={[
            { tool: 'home_assistant__set_brightness', args: '{ "area": "kitchen", "pct": 40 }', result: '{ "ok": true, "brightness": 40 }' },
            {
              tool: 'music__play',
              args: '{ "query": "lo-fi chill", "device": "living_room" }',
              result: '{ "track": "Lo-Fi Study Beats", "cast": true }',
            },
          ]}
          meta={{ model: 'claude-sonnet-4-6', duration: '2.1s' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            <EventCard icon='💡' title='Kitchen lights' detail='Brightness set to 40%' meta='40%' />
            <EventCard
              icon='♫'
              title='Lo-Fi Study Beats'
              detail={`Living Room · Cast · ${musicPlaying ? 'playing' : 'paused'}`}
              accent
              action={{ icon: musicPlaying ? '⏸' : '▶', onClick: () => setMusicPlaying((v) => !v) }}
            />
          </div>
        </AssistantMessage>
        <UserMessage content='What did the morning digest cover today?' />
        <AssistantMessage
          content={`Here's a summary of this morning's digest:\n\n### Highlights\n- **3 PRs merged** overnight — \`plugin-cron\`, \`identity-scoping\`, \`discord-reply\`\n- Memory consolidation archived **14 entries** from last week\n- No anomalies in token usage (avg \`$0.003\` / thread)\n\n### Action items\n1. Review the \`validator\` plugin change — logic gate moved\n2. Calendar event at **2:00 PM** — sprint retro\n\n> Weekly Review is still scheduled for **Friday 5:00 PM MST**.`}
          tools={[{ tool: 'context__read_digest', args: '{ "date": "today" }', result: '{ "entries": 7, "prs": 3, "anomalies": 0 }' }]}
          meta={{ model: 'claude-sonnet-4-6', duration: '3.4s' }}
        />
        <UserMessage content='Remind me about the weekly review on Friday.' />
        <AssistantMessage
          content={`Done. I'll fire a reminder into this thread **Friday at 5:00 PM MST**.\n\nYou can cancel or reschedule it anytime by saying *"cancel my Friday reminder"*.`}
          tools={[
            {
              tool: 'cron__schedule_task',
              args: '{ "name": "Weekly Review", "fireAt": "2026-03-07T00:00:00Z" }',
              result: '{ "id": "clx8f2", "ok": true }',
            },
          ]}
          meta={{ model: 'claude-haiku-4-5' }}
        >
          <div style={{ marginBottom: 10 }}>
            <EventCard icon='⏱' title='Weekly Review' detail='Scheduled one-shot task' meta='Fri 5:00 PM' />
          </div>
        </AssistantMessage>
      </div>
    </div>
  );
};

// ─── Thread List Item ──────────────────────────────────────────────────────────

const THREADS: ThreadItem[] = [
  { name: 'Primary Assistant', agent: 'primary', preview: 'Done — kitchen set to 40%.', time: '7:14', active: true },
  { name: 'Morning Digest', agent: 'primary', preview: 'Your summary is ready.', time: 'Yesterday', unread: true },
  { name: 'Dev planning', agent: 'dev', preview: 'The PR looks good to merge.', time: 'Mon' },
  { name: 'Kitchen lights', agent: 'home', preview: 'Set to 40% brightness.', time: 'Mon' },
  { name: 'Weekly Review', agent: 'primary', preview: 'Scheduled for Friday 5pm.', time: 'Sun' },
];

const ThreadListShowcase = () => (
  <div>
    <SectionLabel>Thread List Item</SectionLabel>
    <div
      style={{
        background: 'var(--surface-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Recents
        </div>
      </div>
      <div style={{ padding: '6px 4px' }}>
        {THREADS.map((t) => (
          <ThreadListItem key={t.name} {...t} />
        ))}
      </div>
    </div>
  </div>
);

// ─── Smart Stack ──────────────────────────────────────────────────────────────

const SmartStackShowcase = () => (
  <div>
    <SectionLabel>Smart Stack — bottom-left persistent widget</SectionLabel>
    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.6 }}>
      One compact zone. Flip between plugin widgets. Shows the most relevant one. Never scrolls away.
    </p>
    <div
      style={{
        background: 'var(--surface-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 16,
        minHeight: 320,
        position: 'relative',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.5 }}>bottom-left zone</div>
      <SmartStack />
    </div>
  </div>
);

// ─── Chat Input ───────────────────────────────────────────────────────────────

const ChatInputShowcase = () => (
  <div>
    <SectionLabel>Chat Input</SectionLabel>
    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 20, lineHeight: 1.6 }}>
      Lexical-based rich text editor. Agent and model selectors inline. Slash commands slide up from input.
    </p>
    <div
      style={{
        background: 'var(--surface-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '220px 24px 24px',
      }}
    >
      <ChatInput />
    </div>
  </div>
);

// ─── Gooey Toast ──────────────────────────────────────────────────────────────

const TOAST_TRIGGERS = [
  { label: 'Success', fn: () => gooeyToast.success('Task complete', { description: 'Memory Consolidation ran and archived 14 entries.' }) },
  { label: 'Error', fn: () => gooeyToast.error('Plugin failed', { description: 'Discord plugin lost connection. Attempting to reconnect...' }) },
  { label: 'Info', fn: () => gooeyToast.info('Job scheduled', { description: 'Weekly Review will fire Friday at 5:00 PM MST.' }) },
  { label: 'Warning', fn: () => gooeyToast.warning('High token usage', { description: 'This thread is approaching the context limit.' }) },
];

const GooeyToastDemo = () => (
  <div>
    <SectionLabel>Gooey Toast</SectionLabel>
    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16, lineHeight: 1.6 }}>
      Pill-to-card morphing notifications via goey-toast. SVG blob morph driven by spring physics.
    </p>
    <div style={{ display: 'flex', gap: 8 }}>
      {TOAST_TRIGGERS.map((ex) => (
        <button
          key={ex.label}
          type='button'
          onClick={ex.fn}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-card)';
          }}
          style={{
            padding: '5px 11px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.12s',
          }}
        >
          {ex.label}
        </button>
      ))}
    </div>
  </div>
);

// ─── Main ──────────────────────────────────────────────────────────────────────

export const BlocksSection = () => (
  <div>
    <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Blocks</h1>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 48, fontSize: 14 }}>
      Composite components built from primitives. These are the actual UI building blocks of the Harness interface.
    </p>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
      <BlockGrid>
        <MessageBlockShowcase />
        <ThreadListShowcase />
      </BlockGrid>

      <BlockGrid>
        <SmartStackShowcase />
        <ChatInputShowcase />
      </BlockGrid>

      <GooeyToastDemo />
    </div>
  </div>
);
