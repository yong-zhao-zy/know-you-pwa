import type { User, Friend, FriendRequest, Message, GuessOption } from "./types"

const KEYS = {
  users: "knowyou_users",
  current: "knowyou_current_user",
  friends: "knowyou_friends",
  chats: "knowyou_chats",
} as const

const AVATAR_COLORS = ["#FADADD", "#E8E0F0", "#D7E8DC", "#FBE7C6", "#D6E4F0"]

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function genId() {
  return Math.random().toString(36).slice(2, 10)
}

export function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

/* ---------------- seed ---------------- */

export function seedIfNeeded() {
  const users = read<User[]>(KEYS.users, [])
  if (users.length === 0) {
    const seedUsers: User[] = [
      {
        id: "u_demo",
        email: "demo@knowyou.com",
        nickname: "小鹿",
        password: "demo123456",
        avatarColor: "#FADADD",
      },
      {
        id: "u_partner",
        email: "partner@knowyou.com",
        nickname: "阿柒",
        password: "partner123",
        avatarColor: "#E8E0F0",
      },
      {
        id: "u_chen",
        email: "chen@knowyou.com",
        nickname: "小陈",
        password: "chen123",
        avatarColor: "#D7E8DC",
      },
    ]
    write(KEYS.users, seedUsers)
  }
}

/* ---------------- users ---------------- */

export function getUsers(): User[] {
  return read<User[]>(KEYS.users, [])
}

export function findUserByEmail(email: string): User | undefined {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase())
}

export function upsertUser(user: User) {
  const users = getUsers()
  const idx = users.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase())
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user }
  } else {
    users.push(user)
  }
  write(KEYS.users, users)
}

/* ---------------- session ---------------- */

export function getCurrentUser(): User | null {
  return read<User | null>(KEYS.current, null)
}

export function setCurrentUser(user: User | null) {
  if (user) write(KEYS.current, user)
  else if (typeof window !== "undefined") window.localStorage.removeItem(KEYS.current)
}

/* ---------------- friends ---------------- */

export function getFriends(): Friend[] {
  const friends = read<Friend[] | null>(KEYS.friends, null)
  if (friends === null) {
    const seed: Friend[] = [
      { id: "u_partner", email: "partner@knowyou.com", nickname: "阿柒", avatarColor: "#E8E0F0" },
      { id: "u_chen", email: "chen@knowyou.com", nickname: "小陈", avatarColor: "#D7E8DC" },
    ]
    write(KEYS.friends, seed)
    return seed
  }
  return friends
}

export function saveFriends(friends: Friend[]) {
  write(KEYS.friends, friends)
}

export function addFriend(friend: Friend) {
  const friends = getFriends()
  if (!friends.find((f) => f.id === friend.id)) {
    friends.push(friend)
    saveFriends(friends)
  }
}

/* ---------------- chats ---------------- */

export function getMessages(friendId: string): Message[] {
  const all = read<Record<string, Message[]>>(KEYS.chats, {})
  return all[friendId] ?? []
}

export function saveMessages(friendId: string, messages: Message[]) {
  const all = read<Record<string, Message[]>>(KEYS.chats, {})
  all[friendId] = messages
  write(KEYS.chats, all)
}

/* ---------------- AI generation ---------------- */

export function generateInterpretation(text: string): string {
  if (text.includes("每次都")) {
    return "TA 说这句话，可能并非真的在评价频率，更多是在表达一种累积的委屈感。"
  }
  if (text.includes("不回我") || text.includes("怎么不回")) {
    return "这句话表面是在问消息，背后可能是在确认自己是否被重视。"
  }
  if (text.includes("没有故意") || text.includes("只是在忙")) {
    return "TA 可能想表达自己并没有忽视你，只是还没找到更柔和的解释方式。"
  }
  return "这句话里可能同时包含事实说明和情绪表达，翻译小天使建议先回应情绪，再讨论事情本身。"
}

export function generateReceiverHint(text: string): string {
  if (text.includes("每次都") || text.includes("不回我") || text.includes("怎么不回")) {
    return "在 TA 的表达习惯里，这样说通常意味着 TA 在用激烈的方式寻求连接，而不是真的在攻击你。"
  }
  return "你可以先回应 TA 的感受，再表达你的具体情况，这会让对话更容易继续。"
}

export function generateGuessOptions(): GuessOption[] {
  const pool = [
    "我感到被忽视了，希望你关注我",
    "我现在压力很大，不是在针对你",
    "我不知道怎么开口，所以用了激烈的措辞",
    "我其实很在乎这段关系，才会这么在意",
  ]
  return pool.map((text, i) => ({ id: `g_${genId()}_${i}`, text, checked: false }))
}
