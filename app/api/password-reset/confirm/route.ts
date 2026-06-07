import { NextResponse } from "next/server"
import { requireSupabaseAdminClient } from "@/lib/supabase/admin"

type ResetRequestRow = {
  id: string
  account_user: string
  code: string
  status: "pending" | "used" | "expired"
  expires_at: string
}

export async function POST(request: Request) {
  try {
    const { email, code, newPassword } = (await request.json()) as {
      email?: string
      code?: string
      newPassword?: string
    }
    const cleanEmail = email?.trim().toLowerCase()
    const cleanCode = code?.trim()
    if (!cleanEmail || !cleanCode || !newPassword) {
      return NextResponse.json({ error: "请填写邮箱、验证码和新密码" }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "新密码至少需要 6 位" }, { status: 400 })
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

    const { data: resetRequest, error: requestError } = await supabase
      .from("password_reset_requests")
      .select("*")
      .eq("account_user", account.id)
      .eq("code", cleanCode)
      .eq("status", "pending")
      .maybeSingle()
    if (requestError) throw requestError
    if (!resetRequest) {
      return NextResponse.json({ error: "验证码不正确或已失效" }, { status: 400 })
    }

    const row = resetRequest as ResetRequestRow
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await supabase.from("password_reset_requests").update({ status: "expired" }).eq("id", row.id)
      return NextResponse.json({ error: "验证码已过期，请重新申请" }, { status: 400 })
    }

    const { error: updateUserError } = await supabase.auth.admin.updateUserById(row.account_user, {
      password: newPassword,
    })
    if (updateUserError) throw updateUserError

    const { error: updateRequestError } = await supabase
      .from("password_reset_requests")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", row.id)
    if (updateRequestError) throw updateRequestError

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "密码修改失败" },
      { status: 500 },
    )
  }
}
