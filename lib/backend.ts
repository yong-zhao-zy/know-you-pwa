import { requireSupabaseBrowserClient } from "@/lib/supabase/client"
import { generateGuessOptions, generateInterpretation, generateReceiverHint, genId, pickColor } from "@/lib/storage"
import type {
  ChatBackground,
  ChatBackgroundEntry,
  EmotionState,
  Friend,
  FriendRequest,
  GuessOption,
  Message,
  PasswordResetInboxItem,
  PublicUser,
  SentFriendRequest,
  Sender,
  ChatThread,
  User,
  MessageKind,
} from "@/lib/types"
import type { User as SupabaseAuthUser } from "@supabase/supabase-js"

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

export type MessageRow = {
  id: string
  room_id: string
  sender_id: string | null
  sender_type?: "user" | "ai" | null
  message_kind?: MessageKind | null
  content: string
  created_at: string
}

type ChatRoomRow = {
  id: string
  user_a: string
  user_b: string
  room_key: string
  title?: string | null
  created_at: string
  updated_at?: string | null
}

export type InterpretationRow = {
  id: string
  message_id: string
  interpretation: string
  receiver_hint: string
  guess_options: GuessOption[]
  confirmed: boolean
  understood: boolean
  expanded: boolean
}

const PENDING_INTERPRETATION = "猫猫正在整理这句话背后的感受。"
const PENDING_RECEIVER_HINT = "猫猫正在整理更容易继续对话的方向。"

type ChatBackgroundRow = {
  room_id: string
  user_id: string
  topic: string
  emotion: EmotionState
  hope: string
  created_at: string
  updated_at: string
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

export function mapMessageWithInterpretation(
  row: MessageRow,
  currentUserId: string,
  interpretation?: InterpretationRow,
): Message {
  const senderType = row.sender_type ?? "user"
  const sender = senderType === "ai" ? "AI" : row.sender_id === currentUserId ? "A" : "B"
  return {
    id: row.id,
    sender,
    senderType,
    senderId: row.sender_id ?? undefined,
    roomId: row.room_id,
    text: row.content,
    createdAt: new Date(row.created_at).getTime(),
    messageKind: row.message_kind ?? "normal",
    interpretation: interpretation?.interpretation ?? PENDING_INTERPRETATION,
    receiverHint: interpretation?.receiver_hint ?? PENDING_RECEIVER_HINT,
    guessOptions: interpretation?.guess_options ?? [],
    confirmed: interpretation?.confirmed ?? false,
    understood: interpretation?.understood ?? false,
    expanded: interpretation?.expanded ?? false,
    interpretationId: interpretation?.id,
    interpreting: !interpretation,
  }
}

export function applyInterpretationToMessage(message: Message, interpretation: InterpretationRow): Message {
  if (message.id !== interpretation.message_id) return message
  return {
    ...message,
    interpretation: interpretation.interpretation,
    receiverHint: interpretation.receiver_hint,
    guessOptions: interpretation.guess_options,
    confirmed: interpretation.confirmed,
    understood: interpretation.understood,
    expanded: interpretation.expanded,
    interpretationId: interpretation.id,
    interpreting: false,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return "未知错误"
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

  return getOrCreateProfileForAuthUser(authData.user)
}

async function getOrCreateProfileForAuthUser(authUser: SupabaseAuthUser): Promise<User> {
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle()
  if (error) throw new Error(`读取用户资料失败：${getErrorMessage(error)}`)
  if (data) return mapProfile(data as ProfileRow)

  const profile: ProfileRow = {
    id: authUser.id,
    email: authUser.email ?? "",
    nickname: authUser.user_metadata?.nickname ?? authUser.email?.split("@")[0] ?? "新用户",
    avatar_color: authUser.user_metadata?.avatar_color ?? pickColor(),
  }
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select("*")
    .single()
  if (insertError) {
    const message = getErrorMessage(insertError)
    if (message.toLowerCase().includes("duplicate key")) {
      throw new Error("登录成功，但用户资料创建失败：这个邮箱在资料表里已有残留记录，请先清理 Supabase profiles 表里的旧记录")
    }
    throw new Error(`创建用户资料失败：${message}`)
  }
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

  const supabase = requireSupabaseBrowserClient()

  const code = params.get("code")
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    window.history.replaceState({}, document.title, window.location.pathname)
    if (error) {
      return { user: null, error: translateAuthError(error.message) }
    }

    return { user: await getCurrentBackendUser(), error: null }
  }

  const accessToken = params.get("access_token")
  const refreshToken = params.get("refresh_token")
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    window.history.replaceState({}, document.title, window.location.pathname)
    if (error) {
      return { user: null, error: translateAuthError(error.message) }
    }

    return { user: await getCurrentBackendUser(), error: null }
  }

  return { user: null, error: null }
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
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(translateAuthError(error.message))
  if (!data.user) throw new Error("登录失败，请稍后再试")
  return getOrCreateProfileForAuthUser(data.user)
}

export async function signUpBackend(email: string, password: string, nickname: string) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, nickname: nickname.trim() }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(translateAuthError(payload.error || "注册失败，请稍后再试"))
  return signInBackend(email, password)
}

export async function resendSignupEmail(email: string) {
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: {
      emailRedirectTo: typeof window === "undefined" ? undefined : window.location.origin,
    },
  })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: typeof window === "undefined" ? undefined : window.location.origin,
  })
  if (error) throw new Error(translateAuthError(error.message))
}

export async function getPasswordResetFriends(email: string): Promise<Friend[]> {
  const response = await fetch("/api/password-reset/friends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim() }),
  })
  const payload = (await response.json().catch(() => ({}))) as { friends?: Friend[]; error?: string }
  if (!response.ok) throw new Error(payload.error || "获取好友列表失败")
  return payload.friends ?? []
}

export async function requestFriendPasswordReset(email: string, friendId: string) {
  const response = await fetch("/api/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), friendId }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string; requestId?: string }
  if (!response.ok) throw new Error(payload.error || "验证码发送失败")
  return payload
}

export async function confirmFriendPasswordReset(email: string, code: string, newPassword: string) {
  const response = await fetch("/api/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
  })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error || "密码修改失败")
}

export async function getPasswordResetInbox(): Promise<PasswordResetInboxItem[]> {
  const supabase = requireSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return []

  const response = await fetch("/api/password-reset/inbox", {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = (await response.json().catch(() => ({}))) as {
    requests?: PasswordResetInboxItem[]
    error?: string
  }
  if (!response.ok) throw new Error(payload.error || "获取验证码失败")
  return payload.requests ?? []
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

export async function getSentFriendRequestsBackend(currentUserId: string): Promise<SentFriendRequest[]> {
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("from_user", currentUserId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as FriendRequestRow[]
  const profiles = await getProfiles(rows.map((request) => request.to_user))
  return rows.map((request) => ({
    id: request.id,
    status: request.status,
    toUser: mapPublicProfile(profiles.get(request.to_user)!),
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

export async function createChatRoomBackend(currentUserId: string, friendId: string): Promise<string> {
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase
    .from("chat_rooms")
    .insert({
      user_a: currentUserId,
      user_b: friendId,
      room_key: `${[currentUserId, friendId].sort().join(":")}:${Date.now()}`,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id as string
}

export async function renameChatRoomBackend(roomId: string, title: string) {
  const supabase = requireSupabaseBrowserClient()
  const { error } = await supabase
    .from("chat_rooms")
    .update({ title: title.trim() })
    .eq("id", roomId)
  if (error) throw error
}

export async function getChatThreadsBackend(currentUserId: string): Promise<ChatThread[]> {
  const supabase = requireSupabaseBrowserClient()
  const { data: roomData, error: roomError } = await supabase
    .from("chat_rooms")
    .select("*")
    .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
    .order("created_at", { ascending: false })
  if (roomError) throw roomError

  const rooms = (roomData ?? []) as ChatRoomRow[]
  if (rooms.length === 0) return []

  const friendIds = rooms.map((room) => (room.user_a === currentUserId ? room.user_b : room.user_a))
  const profiles = await getProfiles(friendIds)

  const roomIds = rooms.map((room) => room.id)
  const [{ data: backgroundData }, { data: messageData }] = await Promise.all([
    supabase.from("chat_backgrounds").select("*").in("room_id", roomIds).eq("user_id", currentUserId),
    supabase.from("messages").select("*").in("room_id", roomIds).order("created_at", { ascending: false }),
  ])

  const backgrounds = new Map(
    ((backgroundData ?? []) as ChatBackgroundRow[]).map((entry) => [entry.room_id, entry]),
  )
  const lastMessages = new Map<string, MessageRow>()
  for (const message of (messageData ?? []) as MessageRow[]) {
    if (!lastMessages.has(message.room_id)) lastMessages.set(message.room_id, message)
  }

  const threads: ChatThread[] = []
  for (const room of rooms) {
    const friendId = room.user_a === currentUserId ? room.user_b : room.user_a
    const friendProfile = profiles.get(friendId)
    if (!friendProfile) continue
    const background = backgrounds.get(room.id)
    const fallbackTitle = background?.topic?.trim() || "新的沟通事件"
    const lastMessage = lastMessages.get(room.id)
    threads.push({
      id: room.id,
      title: room.title?.trim() || fallbackTitle,
      friend: mapPublicProfile(friendProfile),
      updatedAt: new Date(lastMessage?.created_at ?? room.updated_at ?? room.created_at).getTime(),
      lastMessage: lastMessage?.content,
      hasOwnBackground: Boolean(background),
    })
  }

  return threads.sort((a, b) => b.updatedAt - a.updatedAt)
}

function mapChatBackground(row: ChatBackgroundRow): ChatBackgroundEntry {
  return {
    userId: row.user_id,
    background: {
      topic: row.topic,
      emotion: row.emotion,
      hope: row.hope,
    },
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

export async function getChatBackgroundsBackend(roomId: string): Promise<ChatBackgroundEntry[]> {
  const supabase = requireSupabaseBrowserClient()
  const { data, error } = await supabase.from("chat_backgrounds").select("*").eq("room_id", roomId)
  if (error) throw error
  return ((data ?? []) as ChatBackgroundRow[]).map(mapChatBackground)
}

export async function saveChatBackgroundBackend(roomId: string, background: ChatBackground): Promise<ChatBackgroundEntry> {
  const supabase = requireSupabaseBrowserClient()
  const current = await getCurrentBackendUser()
  if (!current) throw new Error("请先登录")

  const { data, error } = await supabase
    .from("chat_backgrounds")
    .upsert(
      {
        room_id: roomId,
        user_id: current.id,
        topic: background.topic.trim(),
        emotion: background.emotion,
        hope: background.hope.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id,user_id" },
    )
    .select("*")
    .single()
  if (error) throw error
  return mapChatBackground(data as ChatBackgroundRow)
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
    return mapMessageWithInterpretation(row, currentUserId, interpretation)
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

  return mapMessageWithInterpretation(messageRow as MessageRow, current.id)
}

export async function createAiMessageBackend(
  roomId: string,
  text: string,
  kind: MessageKind = "ai_clarifying_question",
): Promise<Message> {
  const supabase = requireSupabaseBrowserClient()
  const { data: messageRow, error: messageError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: null,
      sender_type: "ai",
      message_kind: kind,
      content: text,
    })
    .select("*")
    .single()
  if (messageError) throw messageError
  return mapMessageWithInterpretation(messageRow as MessageRow, "")
}

export async function generateAiGuideBackend({
  roomId,
  kind,
  currentUser,
  friend,
  backgrounds,
  recentMessages,
}: {
  roomId: string
  kind: MessageKind
  currentUser: User
  friend: Friend
  backgrounds: ChatBackgroundEntry[]
  recentMessages: Message[]
}): Promise<Message> {
  const supabase = requireSupabaseBrowserClient()
  const session = await supabase.auth.getSession()
  const response = await fetch("/api/guide", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session.data.session?.access_token
        ? { Authorization: `Bearer ${session.data.session.access_token}` }
        : {}),
    },
    body: JSON.stringify({
      kind,
      participants: {
        currentUser,
        friend,
      },
      backgrounds,
      recentMessages: recentMessages.slice(-10).map((message) => ({
        sender: message.sender,
        text: message.text,
        kind: message.messageKind ?? "normal",
      })),
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as { text?: string; kind?: MessageKind; error?: string }
  if (!response.ok || !payload.text?.trim()) {
    throw new Error(payload.error || "猫猫暂时没有想好怎么说")
  }
  return createAiMessageBackend(roomId, payload.text.trim(), payload.kind ?? kind)
}

export async function generateAndSaveInterpretationBackend(messageId: string, text: string, context?: unknown) {
  const supabase = requireSupabaseBrowserClient()
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
    .upsert(
      {
        message_id: messageId,
        interpretation: ai.interpretation,
        receiver_hint: ai.receiverHint,
        guess_options: ai.guessOptions,
        confirmed: false,
        understood: false,
        expanded: false,
      },
      { onConflict: "message_id" },
    )
    .select("*")
    .single()
  if (interpretationError) throw interpretationError
  return interpretationRow as InterpretationRow
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
