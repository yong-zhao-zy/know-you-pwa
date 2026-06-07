import { NextResponse } from "next/server"
import { requireSupabaseAdminClient } from "@/lib/supabase/admin"

type ProfileRow = {
  id: string
  email: string
}

function createCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: Request) {
  try {
    const { email, friendId } = (await request.json()) as { email?: string; friendId?: string }
    const cleanEmail = email?.trim().toLowerCase()
    if (!cleanEmail || !friendId) {
      return NextResponse.json({ error: "请选择接收验证码的好友" }, { status: 400 })
    }

    const supabase = requireSupabaseAdminClient()
    const { data: account, error: accountError } = await supabase
      .from("profiles")
      .select("id,email")
      .eq("email", cleanEmail)
      .maybeSingle()
    if (accountError) throw accountError
    if (!account) {
      return NextResponse.json({ error: "没有找到这个邮箱对应的账号" }, { status: 404 })
    }

    const accountId = (account as ProfileRow).id
    const { data: friendship, error: friendshipError } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", accountId)
      .eq("friend_id", friendId)
      .maybeSingle()
    if (friendshipError) throw friendshipError
    if (!friendship) {
      return NextResponse.json({ error: "只能选择该账号已添加的好友" }, { status: 403 })
    }

    const code = createCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const { error: updateError } = await supabase
      .from("password_reset_requests")
      .update({ status: "expired" })
      .eq("account_user", accountId)
      .eq("status", "pending")
    if (updateError) throw updateError

    const { data, error } = await supabase
      .from("password_reset_requests")
      .insert({
        account_user: accountId,
        friend_user: friendId,
        code,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id,expires_at")
      .single()
    if (error) throw error

    return NextResponse.json({ requestId: data.id, expiresAt: data.expires_at })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "验证码发送失败" },
      { status: 500 },
    )
  }
}
