import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { MarkdownContent } from '../_components/markdown-content';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolCall = { tool: string; args: string; result: string };
type ThinkingBlock = { summary: string };
type ActivityMetaProps = { model?: string; duration?: string; agent?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const modelLabel = (model: string) => (model.includes('haiku') ? 'Haiku' : model.includes('opus') ? 'Opus' : 'Sonnet');

// ─── Inline expand/collapse rows ──────────────────────────────────────────────

const ToolCallRow = ({ tool, args, result }: ToolCall) => {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div style={{ fontSize: 12 }}>
      <button
        type='button'
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          fontFamily: 'inherit',
          color: 'var(--text-tertiary)',
          textAlign: 'left',
        }}
      >
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ fontSize: 9, opacity: 0.5 }}>
          ▶
        </motion.span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{tool}</span>
        <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{args}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginLeft: 14,
                marginBottom: 4,
                padding: '5px 10px',
                background: 'var(--surface-active)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}
            >
              {result}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ThinkingRow = ({ summary }: ThinkingBlock) => {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div style={{ fontSize: 12 }}>
      <button
        type='button'
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0',
          fontFamily: 'inherit',
          color: 'var(--text-tertiary)',
          textAlign: 'left',
        }}
      >
        <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }} style={{ fontSize: 9, opacity: 0.5 }}>
          ▶
        </motion.span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>⊙ Thinking</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                marginLeft: 14,
                marginBottom: 4,
                padding: '5px 10px',
                background: 'var(--surface-active)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.6,
              }}
            >
              {summary}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Messages ─────────────────────────────────────────────────────────────────

type AssistantMessageProps = {
  content: string;
  tools?: ToolCall[];
  thinking?: ThinkingBlock[];
  meta?: ActivityMetaProps;
  children?: React.ReactNode;
};

const AssistantMessage = ({ content, tools = [], thinking, meta, children }: AssistantMessageProps) => {
  const hasHeader = !!(meta?.model || meta?.duration || meta?.agent);
  const hasPreContent = (thinking && thinking.length > 0) || tools.length > 0;

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
      }}
    >
      {/* Header — agent dot + model + duration */}
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              flexShrink: 0,
            }}
          />
          {meta?.agent && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{meta.agent}</span>}
          {meta?.model && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{modelLabel(meta.model)}</span>
          )}
          {meta?.duration && (
            <>
              <span style={{ fontSize: 11, color: 'var(--border-strong)', userSelect: 'none' }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{meta.duration}</span>
            </>
          )}
        </div>
      )}

      {/* Pre-content — thinking + tool calls */}
      {hasPreContent && (
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {thinking && thinking.length > 0 && (
            <div>
              {thinking.map((t, i) => (
                <ThinkingRow key={i} {...t} />
              ))}
            </div>
          )}
          {tools.length > 0 && (
            <div>
              {tools.map((t) => (
                <ToolCallRow key={t.tool} {...t} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {children}
        <MarkdownContent content={content} />
      </div>
    </div>
  );
};

const UserMessage = ({ content }: { content: string }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
    <div
      style={{
        background: 'var(--accent-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)',
        padding: '10px 14px',
        fontSize: 14,
        color: 'var(--text-primary)',
        lineHeight: 1.6,
        maxWidth: '80%',
      }}
    >
      {content}
    </div>
  </div>
);

export { UserMessage, AssistantMessage, ToolCallRow, ThinkingRow };
export type { ToolCall, ThinkingBlock, ActivityMetaProps };
