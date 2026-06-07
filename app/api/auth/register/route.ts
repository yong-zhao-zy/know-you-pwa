import { NextResponse } from "next/server"
import { requireSupabaseAdminClient } from "@/lib/supabase/admin"
import { pickColor } from "@/lib/storage"

export async function POST(request: Request) {
  try {
    const { email, password, nickname } = (await request.json()) as {
      email?: string
      password?: string
      nickname?: string
    }
    const cleanEmail = email?.trim().toLowerCase()
    const cleanNickname = nickname?.trim()

    if (!cleanEmail || !password || !cleanNickname) {
      return NextResponse.json({ error: "请完整填写所有信息" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少需要 6 位" }, { status: 400 })
    }

    const supabase = requireSupabaseAdminClient()
    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        nickname: cleanNickname,
        avatar_color: pickColor(),
      },
    })

    if (error) {
      const message = error.message.toLowerCase().includes("already")
        ? "这个邮箱已经注册过，请直接登录或使用忘记密码"
        : error.message
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ userId: data.user.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败，请稍后再试" },
      { status: 500 },
    )
  }
}
