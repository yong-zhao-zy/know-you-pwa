"use client"

import { cn } from "@/lib/utils"
import type { ButtonHTMLAttributes } from "react"

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "soft" | "ghost" | "outline"
  full?: boolean
}

export function AppButton({
  className,
  variant = "primary",
  full,
  disabled,
  ...props
}: AppButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition-all duration-150 outline-none active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0"

  const variants: Record<string, string> = {
    primary: "h-11 px-5 bg-primary text-primary-foreground hover:bg-[#b98fcf] active:bg-[#ad82c5]",
    soft: "h-10 px-4 bg-accent text-foreground hover:bg-[#ece3fb] active:bg-[#e2d6f7]",
    outline: "h-10 px-4 border border-border bg-card text-foreground hover:bg-muted active:bg-[#ededeb]",
    ghost: "h-9 px-3 text-foreground hover:bg-muted active:bg-[#ededeb]",
  }

  return (
    <button
      className={cn(base, variants[variant], full && "w-full", className)}
      disabled={disabled}
      {...props}
    />
  )
}
