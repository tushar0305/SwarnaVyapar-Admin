'use client';

import { getRelativeTime } from '@/lib/utils';

export function UpdatedAt({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>Updated {getRelativeTime(iso)}</span>;
}
