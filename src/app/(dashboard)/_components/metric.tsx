import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Metric({
  label,
  value,
  scope,
  href,
  tone = 'default',
}: {
  label: string;
  value: string;
  scope?: string;
  href?: string;
  tone?: 'default' | 'attention';
}) {
  const body = (
    <div
      className={cn(
        'flex h-full min-h-[5.5rem] w-full min-w-0 flex-col rounded-lg border bg-white px-3.5 py-3 transition',
        tone === 'attention' ? 'border-amber-300' : 'border-ink-100',
        href && 'hover:border-gold-400'
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className="tnum mt-1 font-serif text-xl leading-tight text-ink-900 sm:text-[1.35rem]">
        {value}
      </p>
      {scope ? (
        <p className="mt-auto pt-1.5 text-xs leading-snug text-ink-500">{scope}</p>
      ) : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block h-full min-w-0 w-full focus-visible:rounded-lg">
      {body}
    </Link>
  );
}
