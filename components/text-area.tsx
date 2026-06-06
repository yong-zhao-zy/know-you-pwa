import { cn } from "@/lib/utils"
import type { TextareaHTMLAttributes } from "react"

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground",
        "placeholder:text-text-secondary outline-none transition-colors resize-none",
        "focus:border-primary focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...props}
    />
  )
}
