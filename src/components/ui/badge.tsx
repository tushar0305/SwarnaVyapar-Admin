import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-transparent',
  {
    variants: {
      variant: {
        default: 'bg-ink-900 text-white',
        secondary: 'bg-ink-100 text-ink-700',
        destructive: 'bg-red-50 text-red-700 ring-red-200',
        outline: 'bg-white text-ink-600 ring-ink-200',
        success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        warning: 'bg-amber-50 text-amber-800 ring-amber-200',
        gold: 'bg-gold-50 text-gold-700 ring-gold-200',
        info: 'bg-sky-50 text-sky-700 ring-sky-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
