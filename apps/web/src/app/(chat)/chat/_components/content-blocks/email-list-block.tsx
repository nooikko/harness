'use client';

import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Mail, Paperclip } from 'lucide-react';
import { useState } from 'react';
import type { ContentBlockProps } from './registry';

type EmailSummary = {
  id: string;
  from: { name: string; email: string };
  subject: string;
  preview: string;
  body?: string;
  bodyType?: 'html' | 'text';
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  webLink?: string;
  importance?: 'low' | 'normal' | 'high';
};

type EmailCardProps = {
  email: EmailSummary;
};

type FormatTime = (iso: string) => string;

const formatTime: FormatTime = (iso) => {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    if (diffHours < 168) {
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

type GetInitials = (name: string) => string;

const getInitials: GetInitials = (name) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return (parts[0]?.[0] ?? '?').toUpperCase();
  }
  return `${(parts[0]?.[0] ?? '').toUpperCase()}${(parts[parts.length - 1]?.[0] ?? '').toUpperCase()}`;
};

type StripHtml = (html: string) => string;

const stripHtml: StripHtml = (html) => {
  // Strip HTML tags and decode common entities for safe plain-text display
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

type EmailCardComponent = (props: EmailCardProps) => React.ReactNode;

const EmailCard: EmailCardComponent = ({ email }) => {
  const [expanded, setExpanded] = useState(false);

  const bodyText = email.body && email.bodyType === 'html' ? stripHtml(email.body) : email.body;

  return (
    <div className={`rounded-md border transition-colors ${email.isRead ? 'border-border/40 bg-background' : 'border-border bg-muted/30'}`}>
      <button
        type='button'
        onClick={() => setExpanded(!expanded)}
        className='flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/20 transition-colors'
      >
        {/* Avatar */}
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${email.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}
        >
          {getInitials(email.from.name)}
        </div>

        {/* Content */}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className={`truncate text-sm ${email.isRead ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>{email.from.name}</span>
            <span className='shrink-0 text-xs text-muted-foreground/60'>{formatTime(email.receivedAt)}</span>
            {email.importance === 'high' && <AlertTriangle className='h-3 w-3 shrink-0 text-destructive' />}
            {email.hasAttachments && <Paperclip className='h-3 w-3 shrink-0 text-muted-foreground/50' />}
          </div>
          <p className={`truncate text-sm ${email.isRead ? 'text-muted-foreground/70' : 'text-foreground'}`}>{email.subject}</p>
          <p className='truncate text-xs text-muted-foreground/60'>{email.preview}</p>
        </div>

        {/* Expand indicator */}
        <div className='mt-1 shrink-0 text-muted-foreground/40'>
          {expanded ? <ChevronDown className='h-3.5 w-3.5' /> : <ChevronRight className='h-3.5 w-3.5' />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className='border-t border-border/30 px-3 py-3'>
          <div className='mb-2 flex items-center gap-2 text-xs text-muted-foreground'>
            <span>
              From: {email.from.name} &lt;{email.from.email}&gt;
            </span>
            {email.webLink && (
              <a
                href={email.webLink}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 text-primary hover:underline'
              >
                Open <ExternalLink className='h-3 w-3' />
              </a>
            )}
          </div>
          <pre className='whitespace-pre-wrap text-sm text-foreground/80 font-sans'>{bodyText ?? email.preview}</pre>
        </div>
      )}
    </div>
  );
};

type EmailListBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const EmailListBlock: EmailListBlockComponent = ({ data }) => {
  const emails = (data.emails ?? []) as EmailSummary[];
  const unreadCount = emails.filter((e) => !e.isRead).length;

  return (
    <div className='space-y-1.5'>
      <div className='flex items-center gap-2 px-1 text-xs text-muted-foreground'>
        <Mail className='h-3.5 w-3.5' />
        <span>
          {emails.length} email{emails.length !== 1 ? 's' : ''}
          {unreadCount > 0 && <span className='ml-1 font-medium text-primary'>({unreadCount} unread)</span>}
        </span>
      </div>
      <div className='space-y-1'>
        {emails.map((email) => (
          <EmailCard key={email.id} email={email} />
        ))}
      </div>
    </div>
  );
};

export default EmailListBlock;
