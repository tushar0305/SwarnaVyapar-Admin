'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Link from 'next/link';
import { LogOut, Menu } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { cn } from '@/lib/utils';
import {
  ADMIN_CONTENT_X,
  ADMIN_SIDEBAR_COLLAPSED,
  ADMIN_SIDEBAR_EXPANDED,
} from './admin-layout';
import { AdminBreadcrumbs } from './admin-breadcrumbs';

function UserChip({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-ink-100 bg-ink-50/80 py-1 pl-1 pr-3">
      <span
        className="grid size-7 place-items-center rounded-full bg-ink-900 font-serif text-[11px] font-semibold text-white"
        aria-hidden
      >
        {name.trim().charAt(0).toUpperCase() || 'A'}
      </span>
      <div className="min-w-0 text-left">
        <p className="max-w-[10rem] truncate text-xs font-medium text-ink-800">{name}</p>
        <p className="text-[10px] uppercase tracking-wider text-ink-400">Audited</p>
      </div>
    </div>
  );
}

export function AdminHeader({
  name,
  pinned,
  onMenu,
}: {
  name: string;
  pinned: boolean;
  onMenu: () => void;
}) {
  const router = useRouter();

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Logout failed');
    }
  }

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      aria-label="Logout"
      className="grid size-10 place-items-center rounded-md border border-ink-200 bg-white text-ink-600 transition hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
    >
      <LogOut className="size-4" aria-hidden />
    </button>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex h-14 w-full items-stretch">
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2.5 px-4 sm:px-5 lg:flex-none lg:border-r lg:border-ink-200/80',
            'transition-[width] duration-200 ease-out',
            pinned
              ? `lg:px-4 ${ADMIN_SIDEBAR_EXPANDED}`
              : `lg:justify-center lg:px-2 ${ADMIN_SIDEBAR_COLLAPSED}`
          )}
        >
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-md text-ink-600 hover:bg-ink-100 hover:text-ink-900 lg:hidden"
            onClick={onMenu}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <Link
            href="/overview"
            className={cn('flex min-w-0 items-center gap-2.5', !pinned && 'lg:gap-0')}
            aria-label="SwarnaVyapar Admin home"
          >
            <BrandLogo size="sm" className="shadow-sm shadow-ink-900/5" />
            <div
              className={cn(
                'min-w-0 overflow-hidden transition-[max-width,opacity] duration-200',
                pinned ? 'max-w-[11rem] opacity-100' : 'lg:max-w-0 lg:opacity-0'
              )}
            >
              <p className="truncate text-sm font-semibold tracking-tight text-ink-900">
                SwarnaVyapar
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">
                Founder control
              </p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <div className="hidden sm:block">
              <UserChip name={name} />
            </div>
            {logoutButton}
          </div>
        </div>

        <div
          className={cn(
            'hidden min-w-0 flex-1 items-center gap-4 lg:flex',
            ADMIN_CONTENT_X
          )}
        >
          <AdminBreadcrumbs className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-3">
            <UserChip name={name} />
            {logoutButton}
          </div>
        </div>
      </div>

      {/* Mobile / tablet: orientation without crowding the brand row */}
      <div className={cn('border-t border-ink-100/80 lg:hidden', ADMIN_CONTENT_X, 'py-1.5')}>
        <AdminBreadcrumbs />
      </div>
    </header>
  );
}
