import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireSupabaseAdminClient } from "@/lib/supabase/admin"

type ResetInboxRow = {
  id: string
  account_user: string
  code: string
  expires_at: string
  created_at: string
}

type ProfileRow = {
  id: string
  email: string
  nickname: string
  avatar_color: string
}

async function getTokenUserId(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) return null

  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getTokenUserId(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = requireSupabaseAdminClient()
    const { data, error } = await supabase
      .from("password_reset_requests")
      .select("id,account_user,code,expires_at,created_at")
      .eq("friend_user", userId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(5)
    if (error) throw error

    const rows = (data ?? []) as ResetInboxRow[]
    const accountIds = [...new Set(rows.map((row) => row.account_user))]
    const { data: profiles, error: profilesError } =
      accountIds.length === 0
        ? { data: [], error: null }
        : await supabase.from("profiles").select("*").in("id", accountIds)
    if (profilesError) throw profilesError

    const profileMap = new Map((profiles as ProfileRow[]).map((profile) => [profile.id, profile]))
    return NextResponse.json({
      requests: rows.map((row) => {
        const profile = profileMap.get(row.account_user)
        return {
          id: row.id,
          code: row.code,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          account: profile
            ? {
                id: profile.id,
                email: profile.email,
                nickname: profile.nickname,
                avatarColor: profile.avatar_color,
              }
            : null,
        }
      }),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取验证码失败" },
      { status: 500 },
    )
  }
}
