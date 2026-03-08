import { motion } from 'motion/react';
import * as React from 'react';
import { Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from 'ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreadItem = {
  name: string;
  agent: string;
  preview: string;
  time: string;
  active?: boolean;
  unread?: boolean;
  onManage?: () => void;
  onDelete?: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

const ThreadListItem = ({ name, agent, preview, time, active, unread, onManage, onDelete }: ThreadItem) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <motion.div
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        padding: '9px 12px',
        borderRadius: 'var(--radius-md)',
        background: active ? 'var(--accent-subtle)' : hovered ? 'var(--surface-hover)' : 'transparent',
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-out)',
        position: 'relative',
      }}
    >
      {/* Name + time row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {unread && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
          <span
            style={{
              fontSize: 13,
              fontWeight: active || unread ? 600 : 400,
              color: active ? 'var(--accent)' : 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 160,
            }}
          >
            {name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{time}</span>
          {/* Actions menu — shown on hover */}
          {hovered && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type='button'
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'var(--text-tertiary)',
                    padding: '0 2px',
                    lineHeight: 1,
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  ···
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={onManage}>Manage</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant='destructive' onClick={onDelete}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Preview + agent pill row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {preview}
        </span>
        <Badge variant={active ? 'active' : 'neutral'} className='shrink-0 px-1.5 py-px text-[10px]'>
          {agent}
        </Badge>
      </div>
    </motion.div>
  );
};

export { ThreadListItem };
export type { ThreadItem };
