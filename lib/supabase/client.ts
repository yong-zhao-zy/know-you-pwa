import { createBrowserClient } from "@supabase/ssr"

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey)
  }

  return browserClient
}

export function requireSupabaseBrowserClient() {
  const client = getSupabaseBrowserClient()
  if (!client) {
    throw new Error("Supabase 环境变量未配置")
  }
  return client
}
