import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  tone = 'default',
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: 'default' | 'attention';
}) {
  const hasHeader = title != null || description != null || action != null;

  return (
    <section
      className={cn(
        'rounded-lg border bg-white',
        tone === 'attention' ? 'border-amber-300' : 'border-ink-100',
        className
      )}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-50 px-4 py-3">
          <div className="min-w-0">
            {title != null ? (
              <h2 className="text-sm font-semibold text-ink-800">{title}</h2>
            ) : null}
            {description != null ? (
              <p className="mt-0.5 text-xs text-ink-500">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
