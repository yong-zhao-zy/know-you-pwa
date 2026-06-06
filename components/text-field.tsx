import { cn } from "@/lib/utils"
import type { InputHTMLAttributes } from "react"

export function TextField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground",
        "placeholder:text-text-secondary outline-none transition-colors",
        "focus:border-primary focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...props}
    />
  )
}
