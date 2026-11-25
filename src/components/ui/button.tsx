import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-ink-300',
        gold: 'bg-gold-500 text-ink-900 hover:bg-gold-400 disabled:bg-gold-200',
        destructive: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
        outline: 'border border-ink-300 bg-white text-ink-800 hover:border-ink-500 hover:bg-ink-50',
        secondary: 'bg-ink-100 text-ink-800 hover:bg-ink-200',
        ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        link: 'text-gold-700 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 gap-1.5 px-3 text-xs',
        lg: 'h-10 px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
