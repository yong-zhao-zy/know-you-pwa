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

export type Sender = "A" | "B"

export interface GuessOption {
  id: string
  text: string
  checked: boolean
}

export interface Message {
  id: string
  sender: Sender
  senderId?: string
  text: string
  createdAt: number
  // AI interpretation
  interpretation: string
  guessOptions: GuessOption[]
  confirmed: boolean
  receiverHint: string
  understood: boolean
  expanded: boolean
  interpretationId?: string
}
