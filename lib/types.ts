export interface User {
  id: string
  email: string
  nickname: string
  password: string
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

export type EmotionState = "calm" | "anxious" | "wronged" | "angry" | "other"

export interface ChatBackground {
  topic: string
  emotion: EmotionState
  hope: string
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
  text: string
  createdAt: number
  // AI interpretation
  interpretation: string
  guessOptions: GuessOption[]
  confirmed: boolean
  receiverHint: string
  understood: boolean
  expanded: boolean
}
