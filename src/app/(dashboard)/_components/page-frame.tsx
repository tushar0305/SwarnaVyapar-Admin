import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Consistent vertical stack for dashboard pages — keeps headers and widgets on one column. */
export function PageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex w-full flex-col gap-6', className)}>{children}</div>
  );
}
