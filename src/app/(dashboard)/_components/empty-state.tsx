import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-10 text-center',
        className
      )}
    >
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
