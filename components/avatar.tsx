import { cn } from "@/lib/utils"

interface AvatarProps {
  nickname: string
  color?: string
  size?: number
  className?: string
}

export function Avatar({ nickname, color = "#E8E0F0", size = 40, className }: AvatarProps) {
  const initial = nickname.trim().slice(0, 1) || "?"
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-medium text-foreground", className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}
