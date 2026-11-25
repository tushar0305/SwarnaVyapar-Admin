import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 transition file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-300 focus:border-gold-500 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
