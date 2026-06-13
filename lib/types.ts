export interface User {
  id: string
  email: string
  nickname: string
  password?: string
  avatarColor: string
}

export interface FriendRequest {
  id: string
  fromUser: PublicUser
  status: "pending" | "accepted" | "rejected"
}

export interface PublicUser {
  id: string
  email: string
  nickname: string
  avatarColor: string
}

export interface Friend extends PublicUser {}

export interface PasswordResetInboxItem {
  id: string
  code: string
  expiresAt: string
  createdAt: string
  account: PublicUser | null
}

export interface SentFriendRequest {
  id: string
  status: "pending" | "accepted" | "rejected"
  toUser: PublicUser
}

export type EmotionState = "calm" | "anxious" | "wronged" | "angry" | "other"

export interface ChatBackground {
  topic: string
  emotion: EmotionState
  hope: string
}

export interface ChatBackgroundEntry {
  userId: string
  background: ChatBackground
  createdAt: number
  updatedAt: number
}

export interface ChatThread {
  id: string
  title: string
  friend: Friend
  updatedAt: number
  lastMessage?: string
}

export type Sender = "A" | "B" | "AI"
export type MessageKind = "normal" | "ai_opening_question" | "ai_clarifying_question" | "ai_pattern_observation" | "ai_next_step"

export interface GuessOption {
  id: string
  text: string
  checked: boolean
}

export interface Message {
  id: string
  sender: Sender
  senderType?: "user" | "ai"
  senderId?: string
  text: string
  createdAt: number
  roomId?: string
  messageKind?: MessageKind
  // AI interpretation
  interpretation: string
  guessOptions: GuessOption[]
  confirmed: boolean
  receiverHint: string
  understood: boolean
  expanded: boolean
  interpretationId?: string
  interpreting?: boolean
}
