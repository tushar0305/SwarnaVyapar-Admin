'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { cn } from '@/lib/utils';
import {
  ADMIN_SIDEBAR_COLLAPSED,
  ADMIN_SIDEBAR_EXPANDED,
} from './admin-layout';
import {
  LayoutDashboard,
  Store,
  Users,
  UserRoundSearch,
  Bot,
  Sliders,
  Flag,
  Activity,
  BarChart3,
  Bell,
  Settings,
  Shield,
  CreditCard,
  MessageSquare,
  MessageCircle,
  IndianRupee,
  TrendingUp,
  Wallet,
  ShoppingBag,
  MapPinned,
  ClipboardList,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';

type NavItem = { name: string; href: string; icon: LucideIcon };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Command',
    items: [
      { name: 'Overview', href: '/overview', icon: LayoutDashboard },
      { name: 'Shops', href: '/shops', icon: Store },
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Leads', href: '/leads', icon: UserRoundSearch },
      { name: 'Discover', href: '/leads/discover', icon: MapPinned },
      { name: 'Inquiries', href: '/leads/inquiries', icon: ClipboardList },
      { name: 'Agent', href: '/agent', icon: Bot },
      { name: 'Activation', href: '/activation', icon: TrendingUp },
    ],
  },
  {
    label: 'Money',
    items: [
      { name: 'Commerce', href: '/commerce', icon: ShoppingBag },
      { name: 'Credits', href: '/credits', icon: Wallet },
      { name: 'Billing', href: '/billing', icon: IndianRupee },
      { name: 'Subscriptions', href: '/subscriptions', icon: CreditCard },
    ],
  },
  {
    label: 'Product',
    items: [
      { name: 'Communications', href: '/communications', icon: MessageSquare },
      { name: 'WhatsApp', href: '/whatsapp', icon: MessageCircle },
      { name: 'Limits', href: '/limits', icon: Sliders },
      { name: 'Features', href: '/features', icon: Flag },
      { name: 'Announcements', href: '/announcements', icon: Bell },
    ],
  },
  {
    label: 'Platform',
    items: [
      { name: 'Health', href: '/health', icon: Activity },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Audit log', href: '/audit', icon: Shield },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

function isItemActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/leads') {
    return (
      pathname === '/leads' ||
      (pathname.startsWith('/leads/') &&
        !pathname.startsWith('/leads/discover') &&
        !pathname.startsWith('/leads/inquiries'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  expanded,
  onNavigate,
}: {
  expanded: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5" aria-label="Admin">
      {groups.map((group) => (
        <div key={group.label}>
          <p
            className={cn(
              'overflow-hidden whitespace-nowrap px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-700/80 transition-opacity duration-200',
              expanded ? 'opacity-100' : 'h-0 opacity-0'
            )}
            aria-hidden={!expanded}
          >
            {group.label}
          </p>
          {!expanded ? (
            <div className="mx-auto mb-1.5 h-px w-5 bg-ink-100" aria-hidden />
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={expanded ? undefined : item.name}
                    aria-current={active ? 'page' : undefined}
                    aria-label={expanded ? undefined : item.name}
                    className={cn(
                      'group relative flex min-h-10 items-center rounded-lg text-sm transition-colors duration-150',
                      expanded ? 'gap-2.5 px-3' : 'justify-center px-0',
                      active
                        ? 'bg-ink-900 text-white shadow-sm shadow-ink-900/20'
                        : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                    )}
                  >
                    {active ? (
                      <span
                        className={cn(
                          'absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-gold-400',
                          expanded ? 'left-1' : 'left-0.5'
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <item.icon
                      className={cn(
                        'h-[1.125rem] w-[1.125rem] shrink-0 transition-colors',
                        active ? 'text-gold-300' : 'text-ink-500 group-hover:text-ink-800'
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'truncate font-medium transition-[opacity,max-width] duration-200',
                        expanded ? 'max-w-[10rem] opacity-100' : 'max-w-0 opacity-0'
                      )}
                    >
                      {item.name}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminNav({
  open,
  onClose,
  pinned,
  onPinnedChange,
}: {
  open: boolean;
  onClose: () => void;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  // After explicit Collapse, ignore hover/focus until the pointer leaves —
  // otherwise the rail stays open because the cursor is still over it.
  const [holdCollapsed, setHoldCollapsed] = useState(false);
  const expanded = pinned || ((!holdCollapsed && (hovered || focusWithin)));

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function togglePinned() {
    if (pinned) {
      onPinnedChange(false);
      setHoldCollapsed(true);
      setHovered(false);
      setFocusWithin(false);
      // Drop focus so focus-within doesn’t keep the rail expanded.
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      return;
    }
    setHoldCollapsed(false);
    onPinnedChange(true);
  }

  return (
    <>
      {/* Desktop: reserved rail width — hover expands as overlay so content doesn’t jump */}
      <div
        className={cn(
          'relative hidden shrink-0 lg:block',
          pinned ? ADMIN_SIDEBAR_EXPANDED : ADMIN_SIDEBAR_COLLAPSED
        )}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed left-0 top-14 z-30 hidden h-[calc(100dvh-3.5rem)] flex-col border-r border-ink-200/90 bg-gradient-to-b from-white via-white to-sand-50 lg:flex',
          'transition-[width,box-shadow] duration-200 ease-out',
          expanded ? ADMIN_SIDEBAR_EXPANDED : ADMIN_SIDEBAR_COLLAPSED,
          !pinned && expanded
            ? 'shadow-[8px_0_32px_-12px_rgba(22,22,15,0.18)]'
            : 'shadow-none'
        )}
        onMouseEnter={() => {
          if (holdCollapsed) return;
          setHovered(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
          setHoldCollapsed(false);
        }}
        onFocusCapture={() => {
          if (holdCollapsed) return;
          setFocusWithin(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusWithin(false);
          }
        }}
        aria-label="Admin navigation"
        data-expanded={expanded ? 'true' : 'false'}
        data-pinned={pinned ? 'true' : 'false'}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-300/70 to-transparent" />

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-3 scrollbar-hide">
          <NavLinks expanded={expanded} />
        </div>

        <div
          className={cn(
            'shrink-0 border-t border-ink-100/90 bg-white/70 p-2.5 backdrop-blur-sm',
            expanded ? 'px-2.5' : 'px-2'
          )}
        >
          <button
            type="button"
            onClick={togglePinned}
            onMouseDown={(event) => {
              // Prevent the button from taking focus before collapse runs,
              // which would re-expand via focus-within.
              if (pinned) event.preventDefault();
            }}
            className={cn(
              'flex min-h-10 w-full items-center rounded-lg text-sm text-ink-600 transition hover:bg-ink-50 hover:text-ink-900',
              expanded ? 'gap-2.5 px-3' : 'justify-center'
            )}
            aria-pressed={pinned}
            aria-label={pinned ? 'Collapse sidebar' : 'Keep sidebar open'}
            title={pinned ? 'Collapse sidebar' : 'Keep sidebar open'}
          >
            {pinned ? (
              <PanelLeftClose className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            ) : (
              <PanelLeftOpen className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
            )}
            <span
              className={cn(
                'truncate font-medium transition-opacity duration-200',
                expanded ? 'opacity-100' : 'sr-only opacity-0'
              )}
            >
              {pinned ? 'Collapse' : 'Keep open'}
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-[200] lg:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="animate-in-soft relative flex h-full w-[min(18.5rem,88vw)] flex-col border-r border-ink-100 bg-gradient-to-b from-white via-white to-sand-50 shadow-2xl"
          >
            <div className="flex h-14 items-center justify-between border-b border-ink-100 px-4">
              <div className="flex items-center gap-2.5">
                <BrandLogo size="sm" />
                <div>
                  <p className="text-sm font-semibold text-ink-900">SwarnaVyapar</p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
                    Founder control
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="grid size-10 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 py-3">
              <NavLinks expanded onNavigate={onClose} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
