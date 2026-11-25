'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from './admin-header';
import { AdminNav } from './admin-nav';
import {
  ADMIN_CONTENT_X,
  ADMIN_CONTENT_Y,
  ADMIN_NAV_PIN_STORAGE_KEY,
} from './admin-layout';

export function AdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pinReady, setPinReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ADMIN_NAV_PIN_STORAGE_KEY);
      if (stored === '1') setPinned(true);
      if (stored === '0') setPinned(false);
    } catch {
      // ignore
    }
    setPinReady(true);
  }, []);

  useEffect(() => {
    if (!pinReady) return;
    try {
      window.localStorage.setItem(ADMIN_NAV_PIN_STORAGE_KEY, pinned ? '1' : '0');
    } catch {
      // ignore
    }
  }, [pinned, pinReady]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  function handlePinnedChange(next: boolean) {
    setPinned(next);
  }

  return (
    <div className="min-h-dvh bg-ink-50/70">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>
      <AdminHeader
        name={adminName}
        pinned={pinned}
        onMenu={() => setMobileOpen(true)}
      />
      <div className="flex w-full items-start">
        <AdminNav
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          pinned={pinned}
          onPinnedChange={handlePinnedChange}
        />
        <main
          id="admin-main"
          className={`min-w-0 flex-1 ${ADMIN_CONTENT_X} ${ADMIN_CONTENT_Y}`}
        >
          <div className="w-full animate-in-soft">{children}</div>
        </main>
      </div>
    </div>
  );
}
