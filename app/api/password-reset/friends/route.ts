import { NextResponse } from "next/server"
import { requireSupabaseAdminClient } from "@/lib/supabase/admin"

type ProfileRow = {
  id: string
  email: string
  nickname: string
  avatar_color: string
}

export async function POST(request: Request) {
  try {
    const { email } = (await request.json()) as { email?: string }
    const cleanEmail = email?.trim().toLowerCase()
    if (!cleanEmail) {
      return NextResponse.json({ error: "请先填写邮箱" }, { status: 400 })
    }

    const supabase = requireSupabaseAdminClient()
    const { data: account, error: accountError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle()
    if (accountError) throw accountError
    if (!account) {
      return NextResponse.json({ error: "没有找到这个邮箱对应的账号" }, { status: 404 })
    }

    const { data: friendships, error: friendshipError } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", (account as ProfileRow).id)
    if (friendshipError) throw friendshipError

    const friendIds = ((friendships ?? []) as { friend_id: string }[]).map((item) => item.friend_id)
    if (friendIds.length === 0) {
      return NextResponse.json({ friends: [] })
    }

    const { data: friends, error: friendsError } = await supabase.from("profiles").select("*").in("id", friendIds)
    if (friendsError) throw friendsError

    return NextResponse.json({
      friends: ((friends ?? []) as ProfileRow[]).map((friend) => ({
        id: friend.id,
        email: friend.email,
        nickname: friend.nickname,
        avatarColor: friend.avatar_color,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取好友列表失败" },
      { status: 500 },
    )
  }
}
