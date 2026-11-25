'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminCrumb = {
  label: string;
  href?: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  overview: 'Overview',
  dashboard: 'Dashboard',
  shops: 'Shops',
  users: 'Users',
  leads: 'Leads',
  discover: 'Discover',
  inquiries: 'Inquiries',
  agent: 'Agent',
  activation: 'Activation',
  commerce: 'Commerce',
  credits: 'Credits',
  billing: 'Billing',
  subscriptions: 'Subscriptions',
  communications: 'Communications',
  whatsapp: 'WhatsApp',
  limits: 'Limits',
  features: 'Features',
  announcements: 'Announcements',
  health: 'Health',
  analytics: 'Analytics',
  audit: 'Audit log',
  settings: 'Settings',
  'bulk-ops': 'Bulk ops',
};

const DYNAMIC_PARENT_LABEL: Record<string, string> = {
  shops: 'Shop',
  leads: 'Lead',
  inquiries: 'Inquiry',
  users: 'User',
};

function isDynamicSegment(segment: string): boolean {
  if (SEGMENT_LABELS[segment]) return false;
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  // Long opaque ids
  if (segment.length >= 16 && /^[a-z0-9_-]+$/i.test(segment)) return true;
  return false;
}

function titleCase(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildAdminBreadcrumbs(pathname: string | null): AdminCrumb[] {
  const raw = (pathname || '/overview').split('?')[0].replace(/\/+$/, '') || '/overview';
  const segments = raw.split('/').filter(Boolean);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === 'overview')) {
    return [{ label: 'Overview' }];
  }

  const crumbs: AdminCrumb[] = [{ label: 'Overview', href: '/overview' }];
  let href = '';

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    href += `/${segment}`;
    const isLast = index === segments.length - 1;
    const parent = index > 0 ? segments[index - 1] : null;

    let label = SEGMENT_LABELS[segment];
    if (!label && isDynamicSegment(segment)) {
      label = (parent && DYNAMIC_PARENT_LABEL[parent]) || 'Details';
    }
    if (!label) label = titleCase(segment);

    // Skip redundant "Overview" root segment if somehow present mid-path
    if (segment === 'overview' && index === 0) continue;

    crumbs.push({
      label,
      href: isLast ? undefined : href,
    });
  }

  return crumbs;
}

export function AdminBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const crumbs = buildAdminBreadcrumbs(pathname);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('min-w-0', className)}
    >
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0 text-ink-300"
                  aria-hidden
                />
              ) : null}
              {index === 0 && crumb.href ? (
                <Link
                  href={crumb.href}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
                  aria-label="Overview"
                  title="Overview"
                >
                  <Home className="size-3.5" aria-hidden />
                </Link>
              ) : crumb.href ? (
                <Link
                  href={crumb.href}
                  className="truncate rounded-md px-1.5 py-0.5 text-ink-500 transition hover:bg-ink-50 hover:text-ink-900"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'truncate px-1.5 py-0.5 font-medium text-ink-900',
                    index === 0 && 'pl-0'
                  )}
                  aria-current="page"
                >
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Home className="size-3.5 text-ink-400" aria-hidden />
                      {crumb.label}
                    </span>
                  ) : (
                    crumb.label
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
