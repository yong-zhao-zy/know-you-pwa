"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  MessageCircle,
  UserPlus,
  Sparkles,
  KeyRound,
  MessageSquare,
  UserRound,
  Plus,
  Pencil,
} from "lucide-react"
import { Avatar } from "@/components/avatar"
import { AppButton } from "@/components/app-button"
import { PwaInstallCard } from "@/components/pwa-install-card"
import { TextField } from "@/components/text-field"
import { useToast } from "@/components/toast"
import {
  getFriendRequestsBackend,
  getFriendsBackend,
  getChatThreadsBackend,
  getPasswordResetInbox,
  getSentFriendRequestsBackend,
  createChatRoomBackend,
  renameChatRoomBackend,
  respondFriendRequestBackend,
  searchProfileByEmail,
  sendFriendRequestBackend,
} from "@/lib/backend"
import type {
  User,
  Friend,
  FriendRequest,
  PasswordResetInboxItem,
  PublicUser,
  ChatThread,
  SentFriendRequest,
} from "@/lib/types"

export function FriendHomePage({
  currentUser,
  onLogout,
  onEnterChat,
}: {
  currentUser: User
  onLogout: () => void
  onEnterChat: (friend: Friend, roomId?: string) => void
}) {
  const toast = useToast()
  const [tab, setTab] = useState<"chats" | "mine">("chats")
  const [menuOpen, setMenuOpen] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [searchEmail, setSearchEmail] = useState("")
  const [searchResult, setSearchResult] = useState<PublicUser | null>(null)
  const [requestSent, setRequestSent] = useState(false)
  const [loading, setLoading] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<SentFriendRequest[]>([])
  const [resetInbox, setResetInbox] = useState<PasswordResetInboxItem[]>([])
  const [expandedChatFriends, setExpandedChatFriends] = useState<Record<string, boolean>>({})

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id])

  async function refresh() {
    setLoading(true)
    try {
      const [nextFriends, nextRequests, nextSentRequests, nextThreads] = await Promise.all([
        getFriendsBackend(currentUser.id),
        getFriendRequestsBackend(currentUser.id),
        getSentFriendRequestsBackend(currentUser.id),
        getChatThreadsBackend(currentUser.id),
      ])
      const nextResetInbox = await getPasswordResetInbox()
      setFriends(nextFriends)
      setRequests(nextRequests)
      setSentRequests(nextSentRequests)
      setThreads(nextThreads)
      setResetInbox(nextResetInbox)
    } catch (err) {
      toast(err instanceof Error ? err.message : "加载好友失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  async function handleSearch() {
    setRequestSent(false)
    if (!searchEmail.trim()) return
    try {
      const found = await searchProfileByEmail(searchEmail, currentUser.id)
      setSearchResult(found)
      if (!found) toast("没有找到这个邮箱对应的用户")
    } catch (err) {
      toast(err instanceof Error ? err.message : "搜索失败")
    }
  }

  async function handleAcceptRequest(id: string) {
    await respondFriendRequestBackend(id, "accepted")
    toast("已添加为好友")
    refresh()
  }

  async function handleRejectRequest(id: string) {
    await respondFriendRequestBackend(id, "rejected")
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r)))
  }

  async function handleCreateChat(friend: Friend) {
    try {
      const roomId = await createChatRoomBackend(currentUser.id, friend.id)
      onEnterChat(friend, roomId)
    } catch (err) {
      toast(err instanceof Error ? err.message : "创建聊天失败")
    }
  }

  async function handleRenameThread(thread: ChatThread) {
    const nextTitle = window.prompt("聊天名称", thread.title)
    if (!nextTitle || nextTitle.trim() === thread.title) return
    try {
      await renameChatRoomBackend(thread.id, nextTitle)
      setThreads((items) => items.map((item) => (item.id === thread.id ? { ...item, title: nextTitle.trim() } : item)))
    } catch (err) {
      toast(err instanceof Error ? err.message : "重命名失败")
    }
  }

  const chatFriendsById = new Map<string, Friend>()
  for (const friend of friends) chatFriendsById.set(friend.id, friend)
  for (const thread of threads) {
    if (!chatFriendsById.has(thread.friend.id)) chatFriendsById.set(thread.friend.id, thread.friend)
  }
  const threadsByFriend = [...chatFriendsById.values()].map((friend) => ({
    friend,
    threads: threads.filter((thread) => thread.friend.id === friend.id),
  }))

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* top bar */}
      <header className="safe-top relative z-20 flex items-center justify-between border-b border-border bg-background/95 px-5 py-3.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">Know You</span>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
          >
            <Avatar nickname={currentUser.nickname} color={currentUser.avatarColor} size={30} />
            <span className="text-sm text-foreground">{currentUser.nickname}</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 top-12 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
              >
                <button className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted">
                  <Settings className="h-4 w-4 text-text-secondary" />
                  个人设置
                </button>
                <div className="h-px bg-border" />
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <LogOut className="h-4 w-4 text-text-secondary" />
                  退出登录
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <nav className="grid grid-cols-2 border-b border-border bg-background px-5 py-2">
        <button
          onClick={() => setTab("chats")}
          className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm transition-colors ${
            tab === "chats" ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-muted"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          聊天
        </button>
        <button
          onClick={() => setTab("mine")}
          className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-sm transition-colors ${
            tab === "mine" ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-muted"
          }`}
        >
          <UserRound className="h-4 w-4" />
          我的
        </button>
      </nav>

      {/* content */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5">
        {tab === "chats" && (
          <>
            <Section title="事件聊天" icon={<MessageCircle className="h-4 w-4" />}>
              {friends.length === 0 && threads.length === 0 && <Empty text="添加好友后即可新建事件聊天" />}
              <div className="flex flex-col gap-2">
                {threadsByFriend.map(({ friend, threads: friendThreads }) => {
                  const isExpanded = Boolean(expandedChatFriends[friend.id])
                  return (
                    <div key={friend.id} className="overflow-hidden rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-3 p-3">
                        <button
                          onClick={() => setExpandedChatFriends((items) => ({ ...items, [friend.id]: !isExpanded }))}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          aria-expanded={isExpanded}
                        >
                          <Avatar nickname={friend.nickname} color={friend.avatarColor} size={42} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{friend.nickname}</p>
                            <p className="truncate text-xs text-text-secondary">
                              {friendThreads.length > 0 ? `${friendThreads.length} 个聊天事件` : "暂无聊天事件"}
                            </p>
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => handleCreateChat(friend)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25 active:translate-y-px"
                          aria-label={`新建与${friend.nickname}的聊天事件`}
                          title="新建聊天事件"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="overflow-hidden border-t border-border"
                          >
                            {friendThreads.length === 0 ? (
                              <p className="px-3 py-4 text-center text-xs text-text-secondary">
                                还没有事件，点右侧加号新建
                              </p>
                            ) : (
                              <div className="flex flex-col">
                                {friendThreads.map((thread) => (
                                  <div
                                    key={thread.id}
                                    onClick={() => onEnterChat(thread.friend, thread.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault()
                                        onEnterChat(thread.friend, thread.id)
                                      }
                                    }}
                                    className="flex w-full items-center gap-3 border-b border-border/70 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/40"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <p className="truncate text-sm font-medium text-foreground">{thread.title}</p>
                                        {!thread.hasOwnBackground && (
                                          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                                            邀请事件
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-0.5 truncate text-xs text-text-secondary">
                                        {!thread.hasOwnBackground ? "待补充事件背景" : formatThreadDate(thread.updatedAt)}
                                      </p>
                                    </div>
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        handleRenameThread(thread)
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault()
                                          event.stopPropagation()
                                          handleRenameThread(thread)
                                        }
                                      }}
                                      className="rounded-full p-1.5 text-text-secondary hover:bg-muted hover:text-foreground"
                                      aria-label="重命名聊天"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </Section>
          </>
        )}

        {tab === "mine" && (
          <>
        <PwaInstallCard />

        {/* add friend */}
        <Section title="添加好友" icon={<UserPlus className="h-4 w-4" />}>
          <div className="flex gap-2">
            <TextField
              placeholder="输入对方邮箱"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <AppButton onClick={handleSearch} className="shrink-0 px-4">
              <Search className="h-4 w-4" />
              搜索
            </AppButton>
          </div>

          <AnimatePresence>
            {searchResult && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Avatar nickname={searchResult.nickname} color={searchResult.avatarColor} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{searchResult.nickname}</p>
                  <p className="truncate text-xs text-text-secondary">{searchResult.email}</p>
                </div>
                <AppButton
                  variant={requestSent ? "soft" : "primary"}
                  className="h-9 shrink-0 px-3 text-xs"
                  disabled={requestSent}
                  onClick={async () => {
                    await sendFriendRequestBackend(searchResult.id)
                    setRequestSent(true)
                    toast("好友申请已发送")
                  }}
                >
                  {requestSent ? "已发送" : "发送好友申请"}
                </AppButton>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        {/* password reset codes */}
        <CollapsibleSection title="好友密码验证码" icon={<KeyRound className="h-4 w-4" />} count={resetInbox.length}>
          {resetInbox.length === 0 && <Empty text="暂无需要你转告的验证码" />}
          <div className="flex flex-col gap-2">
            {resetInbox.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.account?.nickname ?? "好友"} 正在找回密码
                    </p>
                    <p className="truncate text-xs text-text-secondary">{item.account?.email}</p>
                  </div>
                  <span className="rounded-lg bg-primary/15 px-3 py-1.5 text-base font-semibold tracking-widest text-primary">
                    {item.code}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  请只把验证码转告给你确认是本人的好友，验证码 10 分钟内有效。
                </p>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* friend requests */}
        <CollapsibleSection
          title="好友申请"
          icon={<MessageCircle className="h-4 w-4" />}
          count={requests.length + sentRequests.length}
        >
          {requests.length === 0 && sentRequests.length === 0 && <Empty text="暂无好友申请" />}
          <div className="flex flex-col gap-2">
            {sentRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Avatar nickname={req.toUser.nickname} color={req.toUser.avatarColor} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{req.toUser.nickname}</p>
                  <p className="truncate text-xs text-text-secondary">{req.toUser.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-text-secondary">
                  待对方同意
                </span>
              </div>
            ))}
            {requests.map((req) => (
              <div key={req.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Avatar nickname={req.fromUser.nickname} color={req.fromUser.avatarColor} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{req.fromUser.nickname}</p>
                  <p className="truncate text-xs text-text-secondary">{req.fromUser.email}</p>
                </div>
                {req.status === "pending" ? (
                  <div className="flex shrink-0 gap-2">
                    <AppButton variant="primary" className="h-9 px-3 text-xs" onClick={() => handleAcceptRequest(req.id)}>
                      接受
                    </AppButton>
                    <AppButton variant="outline" className="h-9 px-3 text-xs" onClick={() => handleRejectRequest(req.id)}>
                      拒绝
                    </AppButton>
                  </div>
                ) : (
                  <span
                    className={`shrink-0 text-xs ${req.status === "accepted" ? "text-primary" : "text-text-secondary"}`}
                  >
                    {req.status === "accepted" ? "已接受" : "已拒绝"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* friend list */}
        <CollapsibleSection title="我的好友" icon={<MessageCircle className="h-4 w-4" />} count={friends.length}>
          {friends.length === 0 && <Empty text="还没有好友，先去添加吧" />}
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Avatar nickname={f.nickname} color={f.avatarColor} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{f.nickname}</p>
                  <p className="truncate text-xs text-text-secondary">{f.email}</p>
                </div>
                <AppButton variant="soft" className="h-9 shrink-0 px-3 text-xs" onClick={() => handleCreateChat(f)}>
                  新事件
                </AppButton>
              </div>
            ))}
          </div>
        </CollapsibleSection>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-text-secondary">
        {icon}
        <h2 className="text-[13px] font-medium">{title}</h2>
      </div>
      {children}
    </motion.section>
  )
}

function CollapsibleSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3 overflow-hidden rounded-xl border border-border bg-card"
    >
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <span className="text-text-secondary">{icon}</span>
        <span className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{title}</span>
        {typeof count === "number" && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-text-secondary">{count}</span>
        )}
        <ChevronRight
          className={`h-4 w-4 text-text-secondary transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

function formatThreadDate(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-text-secondary">{text}</p>
}
