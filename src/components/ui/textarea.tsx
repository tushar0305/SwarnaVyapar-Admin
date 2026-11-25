import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 transition placeholder:text-ink-300 focus:border-gold-500 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
