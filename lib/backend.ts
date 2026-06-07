import { requireSupabaseBrowserClient } from "@/lib/supabase/client"
import { generateGuessOptions, generateInterpretation, generateReceiverHint, genId, pickColor } from "@/lib/storage"
import type { Friend, FriendRequest, GuessOption, Message, PublicUser, Sender, User } from "@/lib/types"

type ProfileRow = {
  id: string
  email: string
  nickname: string
  avatar_color: string
}

type FriendRequestRow = {
  id: string
  from_user: string
  to_user: string
  status: "pending" | "accepted" | "rejected"
}

type MessageRow = {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
}

type InterpretationRow = {
  id: string
  message_id: string
  interpretation: string
  receiver_hint: string
  guess_options: GuessOption[]
  confirmed: boolean
  understood: boolean
  expanded: boolean
}

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    avatarColor: row.avatar_color,
  }
}

function mapPublicProfile(row: ProfileRow): PublicUser {
  return mapProfile(row)
}

async function getProfiles(ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return new Map<string, ProfileRow>()
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase.from("profiles").select("*").in("id", unique)
  if (error) throw error
  return new Map((data as ProfileRow[]).map((profile) => [profile.id, profile]))
}

export async function getCurrentBackendUser(): Promise<User | null> {
  const supabase = requireSupabaseBrowserClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return null

  const { data, error } = await supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle()
  if (error) throw error
  if (data) return mapProfile(data as ProfileRow)

  const profile: ProfileRow = {
    id: authData.user.id,
    email: authData.user.email ?? "",
    nickname: authData.user.user_metadata?.nickname ?? authData.user.email?.split("@")[0] ?? "新用户",
    avatar_color: authData.user.user_metadata?.avatar_color ?? pickColor(),
  }
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(profile)
    .select("*")
    .single()
  if (insertError) throw insertError
  return mapProfile(inserted as ProfileRow)
}

function readAuthParamsFromLocation() {
  if (typeof window === "undefined") return new URLSearchParams()
  const params = new URLSearchParams(window.location.search)
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    hashParams.forEach((value, key) => params.set(key, value))
  }
  return params
}

export async function completeAuthRedirect(): Promise<{ user: User | null; error: string | null }> {
  if (typeof window === "undefined") return { user: null, error: null }

  const params = readAuthParamsFromLocation()
  const description = params.get("error_description")
  const errorCode = params.get("error_code")
  if (description || errorCode) {
    window.history.replaceState({}, document.title, window.location.pathname)
    return {
      user: null,
      error:
        errorCode === "otp_expired"
          ? "邮箱验证链接已过期，请重新注册或重新发送验证邮件"
          : description?.replaceAll("+", " ") || "邮箱验证失败，请重新尝试",
    }
  }

  const code = params.get("code")
  if (!code) return { user: null, error: null }

  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  window.history.replaceState({}, document.title, window.location.pathname)
  if (error) {
    return { user: null, error: translateAuthError(error.message) }
  }

  return { user: await getCurrentBackendUser(), error: null }
}

export function translateAuthError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("invalid login credentials")) return "邮箱或密码不正确"
  if (lower.includes("email not confirmed")) return "邮箱还未验证，请先点击邮箱里的确认链接"
  if (lower.includes("signup disabled")) return "注册暂未开启，请检查 Supabase 邮箱登录设置"
  if (lower.includes("email rate limit")) return "验证邮件发送太频繁，请稍后再试，或先换一个邮箱测试"
  if (lower.includes("rate limit")) return "操作太频繁，请稍后再试"
  if (lower.includes("supabase 环境变量")) return message
  return message || "操作失败，请稍后再试"
}

export async function signInBackend(email: string, password: string): Promise<User> {
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))
  const user = await getCurrentBackendUser()
  if (!user) throw new Error("登录失败，请稍后重试")
  return user
}

export async function signUpBackend(email: string, password: string, nickname: string) {
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
      data: {
        nickname,
        avatar_color: pickColor(),
      },
    },
  })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window === "undefined" ? undefined : window.location.origin,
  })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function signOutBackend() {
  const supabase = requireSupabaseBrowserClient()
  await supabase.auth.signOut()
}

export async function searchProfileByEmail(email: string, currentUserId: string): Promise<PublicUser | null> {
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", email.trim())
    .neq("id", currentUserId)
    .maybeSingle()
  if (error) throw error
  return data ? mapPublicProfile(data as ProfileRow) : null
}

export async function sendFriendRequestBackend(toUserId: string) {
  const supabase = requireSupabaseBrowserClient()
  const current = await getCurrentBackendUser()
  if (!current) throw new Error("请先登录")
  const { error } = await supabase.from("friend_requests").insert({
    from_user: current.id,
    to_user: toUserId,
    status: "pending",
  })
  if (error) throw error
}

export async function getFriendRequestsBackend(currentUserId: string): Promise<FriendRequest[]> {
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("to_user", currentUserId)
    .order("created_at", { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as FriendRequestRow[]
  const profiles = await getProfiles(rows.map((request) => request.from_user))
  return rows.map((request) => ({
    id: request.id,
    status: request.status,
    fromUser: mapPublicProfile(profiles.get(request.from_user)!),
  }))
}

export async function respondFriendRequestBackend(id: string, status: "accepted" | "rejected") {
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase.from("friend_requests").update({ status }).eq("id", id)
  if (error) throw error
}

export async function getFriendsBackend(currentUserId: string): Promise<Friend[]> {
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase.from("friendships").select("friend_id").eq("user_id", currentUserId)
  if (error) throw error
  const friendIds = ((data ?? []) as { friend_id: string }[]).map((friendship) => friendship.friend_id)
  const profiles = await getProfiles(friendIds)
  return friendIds.map((id) => mapPublicProfile(profiles.get(id)!))
}

export async function getOrCreateRoom(currentUserId: string, friendId: string): Promise<string> {
  const supabase = requireSupabaseBrowserClient()
  const left = `${currentUserId}:${friendId}`
  const right = `${friendId}:${currentUserId}`
  const { data: existing, error: findError } = await supabase
    .from("chat_rooms")
    .select("*")
    .or(`room_key.eq.${left},room_key.eq.${right}`)
    .maybeSingle()
  if (findError) throw findError
  if (existing) return existing.id as string

  const { data, error } = await supabase
    .from("chat_rooms")
    .insert({
      user_a: currentUserId,
      user_b: friendId,
      room_key: [currentUserId, friendId].sort().join(":"),
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id as string
}

export async function getMessagesBackend(roomId: string, currentUserId: string): Promise<Message[]> {
  const supabase = requireSupabaseBrowserClient()
  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
  if (messageError) throw messageError

  const rows = (messageRows ?? []) as MessageRow[]
  if (rows.length === 0) return []

  const { data: interpretationRows, error: interpretationError } = await supabase
    .from("ai_interpretations")
    .select("*")
    .in("message_id", rows.map((message) => message.id))
  if (interpretationError) throw interpretationError

  const interpretations = new Map(
    ((interpretationRows ?? []) as InterpretationRow[]).map((interpretation) => [
      interpretation.message_id,
      interpretation,
    ]),
  )

  return rows.map((row) => {
    const interpretation = interpretations.get(row.id)
    return {
      id: row.id,
      sender: row.sender_id === currentUserId ? "A" : "B",
      senderId: row.sender_id,
      text: row.content,
      createdAt: new Date(row.created_at).getTime(),
      interpretation: interpretation?.interpretation ?? generateInterpretation(row.content),
      receiverHint: interpretation?.receiver_hint ?? generateReceiverHint(row.content),
      guessOptions: interpretation?.guess_options ?? generateGuessOptions(),
      confirmed: interpretation?.confirmed ?? false,
      understood: interpretation?.understood ?? false,
      expanded: interpretation?.expanded ?? false,
      interpretationId: interpretation?.id,
    }
  })
}

export async function createMessageBackend(roomId: string, text: string, context?: unknown): Promise<Message> {
  const supabase = requireSupabaseBrowserClient()
  const current = await getCurrentBackendUser()
  if (!current) throw new Error("请先登录")

  const { data: messageRow, error: messageError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: current.id,
      content: text,
    })
    .select("*")
    .single()
  if (messageError) throw messageError

  const session = await supabase.auth.getSession()
  const response = await fetch("/api/interpret", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session.data.session?.access_token
        ? { Authorization: `Bearer ${session.data.session.access_token}` }
        : {}),
    },
    body: JSON.stringify({ text, context }),
  })
  const ai = response.ok
    ? await response.json()
    : {
        interpretation: generateInterpretation(text),
        receiverHint: generateReceiverHint(text),
        guessOptions: generateGuessOptions(),
      }

  const { data: interpretationRow, error: interpretationError } = await supabase
    .from("ai_interpretations")
    .insert({
      message_id: (messageRow as MessageRow).id,
      interpretation: ai.interpretation,
      receiver_hint: ai.receiverHint,
      guess_options: ai.guessOptions,
      confirmed: false,
      understood: false,
      expanded: false,
    })
    .select("*")
    .single()
  if (interpretationError) throw interpretationError

  return {
    id: (messageRow as MessageRow).id,
    sender: "A",
    senderId: current.id,
    text,
    createdAt: new Date((messageRow as MessageRow).created_at).getTime(),
    interpretation: ai.interpretation,
    receiverHint: ai.receiverHint,
    guessOptions: ai.guessOptions,
    confirmed: false,
    understood: false,
    expanded: false,
    interpretationId: (interpretationRow as InterpretationRow).id,
  }
}

export async function updateInterpretationBackend(message: Message) {
  if (!message.interpretationId) return
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase
    .from("ai_interpretations")
    .update({
      guess_options: message.guessOptions,
      confirmed: message.confirmed,
      understood: message.understood,
      expanded: message.expanded,
    })
    .eq("id", message.interpretationId)
  if (error) throw error
}

export function createLocalMessage(text: string): Message {
  return {
    id: genId(),
    sender: "A" as Sender,
    text,
    createdAt: Date.now(),
    interpretation: generateInterpretation(text),
    guessOptions: generateGuessOptions(),
    confirmed: false,
    receiverHint: generateReceiverHint(text),
    understood: false,
    expanded: false,
  }
}
