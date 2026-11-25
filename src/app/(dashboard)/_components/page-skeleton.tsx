import { cn } from '@/lib/utils';

export function PageSkeleton({
  metrics = 4,
  panels = 1,
  hideHeader = false,
  className,
}: {
  metrics?: number;
  panels?: number;
  hideHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-live="polite">
      {!hideHeader ? (
        <div className="space-y-2">
          <div className="h-3 w-16 shimmer rounded bg-ink-100" />
          <div className="h-8 w-48 shimmer rounded-md bg-ink-100 sm:w-64" />
          <div className="h-4 w-full max-w-md shimmer rounded bg-ink-100" />
        </div>
      ) : null}

      {metrics > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: metrics }).map((_, i) => (
            <div key={i} className="h-[5.5rem] shimmer rounded-lg bg-ink-100" />
          ))}
        </div>
      ) : null}

      {Array.from({ length: panels }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'shimmer rounded-lg bg-ink-100',
            i === 0 ? 'h-72' : 'h-48'
          )}
        />
      ))}
    </div>
  );
}
