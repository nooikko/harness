'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Maps route segments to human-readable labels.
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  'cron-jobs': 'Scheduled Tasks',
  'ssh-hosts': 'SSH Hosts',
  plugins: 'Plugins',
  tasks: 'Tasks',
  'agent-runs': 'Agent Runs',
  errors: 'Errors',
  threads: 'Threads',
  usage: 'Usage',
  profile: 'Profile',
  new: 'New',
  edit: 'Edit',
};

// Terminal segments that describe an action on the parent entity, not a page of their own.
// When present as the last segment, they're collapsed into the previous breadcrumb.
// e.g. /admin/cron-jobs/[id]/edit → "Scheduled Tasks > Morning Digest" (not "... > Edit")
const COLLAPSE_SEGMENTS = new Set(['edit']);

type AdminBreadcrumbProps = {
  /** Map of raw segment values to display labels. Use for dynamic segments like IDs. */
  labels?: Record<string, string>;
};

type AdminBreadcrumbComponent = (props: AdminBreadcrumbProps) => React.ReactNode;

export const AdminBreadcrumb: AdminBreadcrumbComponent = ({ labels }) => {
  const pathname = usePathname();
  let segments = pathname.split('/').filter(Boolean);

  // Collapse terminal action segments (e.g. "edit") — they don't need their own crumb
  if (segments.length > 0 && COLLAPSE_SEGMENTS.has(segments[segments.length - 1]!)) {
    segments = segments.slice(0, -1);
  }

  // Build breadcrumb items from path segments
  const items: { label: string; href: string }[] = [];
  let path = '';

  for (const segment of segments) {
    path += `/${segment}`;

    // Skip the "admin" segment — redundant since we're already in admin
    if (segment === 'admin') {
      continue;
    }

    const label = labels?.[segment] ?? SEGMENT_LABELS[segment] ?? segment;
    items.push({ label, href: path });
  }

  // Don't render breadcrumbs for top-level admin pages (only 1 item)
  if (items.length <= 1) {
    return null;
  }

  return (
    <nav aria-label='Breadcrumb' className='flex items-center gap-1.5 text-sm'>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.href} className='flex items-center gap-1.5'>
            {i > 0 && <ChevronRight className='h-3 w-3 text-muted-foreground/50' />}
            {isLast ? (
              <span className='font-medium text-foreground'>{item.label}</span>
            ) : (
              <Link href={item.href} className='text-muted-foreground transition-colors hover:text-foreground'>
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
};
