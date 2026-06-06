type ClassValue = string | number | false | null | undefined | Record<string, boolean>

export function cn(...inputs: ClassValue[]) {
  return inputs
    .flatMap((input) => {
      if (!input) return []
      if (typeof input === "string" || typeof input === "number") return [String(input)]
      return Object.entries(input)
        .filter(([, active]) => active)
        .map(([className]) => className)
    })
    .join(" ")
}
