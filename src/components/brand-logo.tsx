import Image from 'next/image';
import { cn } from '@/lib/utils';

const LOGO_SRC = '/favicon/web-app-manifest-192x192.png';

export function BrandLogo({
  size = 'md',
  className,
  priority = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  priority?: boolean;
}) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 72 : 40;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden rounded-md bg-[#fafaf0] ring-1 ring-ink-100',
        className
      )}
      style={{ width: dim, height: dim }}
    >
      <Image
        src={LOGO_SRC}
        alt="SwarnaVyapar"
        width={dim}
        height={dim}
        className="object-contain p-0.5"
        priority={priority}
      />
    </span>
  );
}

export function BrandWordmark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn('relative inline-block overflow-hidden rounded-md bg-[#fafaf0]', className)}>
      <Image
        src={LOGO_SRC}
        alt="SwarnaVyapar"
        width={192}
        height={192}
        className="h-14 w-auto object-contain sm:h-16"
        priority={priority}
      />
    </span>
  );
}
