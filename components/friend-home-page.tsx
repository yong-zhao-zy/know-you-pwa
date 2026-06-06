"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, ChevronDown, LogOut, Settings, MessageCircle, UserPlus, Sparkles } from "lucide-react"
import { Avatar } from "@/components/avatar"
import { AppButton } from "@/components/app-button"
import { TextField } from "@/components/text-field"
import { useToast } from "@/components/toast"
import { getFriends, addFriend, findUserByEmail, genId, pickColor } from "@/lib/storage"
import type { User, Friend, FriendRequest, PublicUser } from "@/lib/types"

export function FriendHomePage({
  currentUser,
  onLogout,
  onEnterChat,
}: {
  currentUser: User
  onLogout: () => void
  onEnterChat: (friend: Friend) => void
}) {
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [friends, setFriends] = useState<Friend[]>([])
  const [searchEmail, setSearchEmail] = useState("")
  const [searchResult, setSearchResult] = useState<PublicUser | null>(null)
  const [requestSent, setRequestSent] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [requests, setRequests] = useState<FriendRequest[]>([
    {
      id: "req_1",
      status: "pending",
      fromUser: { id: "u_mu", email: "mumu@knowyou.com", nickname: "木木", avatarColor: "#FBE7C6" },
    },
  ])

  useEffect(() => {
    setFriends(getFriends())
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function handleSearch() {
    setRequestSent(false)
    const found = findUserByEmail(searchEmail)
    if (found && found.email !== currentUser.email) {
      setSearchResult({
        id: found.id,
        email: found.email,
        nickname: found.nickname,
        avatarColor: found.avatarColor,
      })
    } else {
      // simulate a found stranger
      setSearchResult({
        id: genId(),
        email: searchEmail || "someone@knowyou.com",
        nickname: searchEmail ? searchEmail.split("@")[0] : "陌生人",
        avatarColor: pickColor(),
      })
    }
  }

  function handleAcceptRequest(id: string) {
    setRequests((rs) =>
      rs.map((r) => {
        if (r.id === id) {
          addFriend(r.fromUser)
          setFriends(getFriends())
          return { ...r, status: "accepted" as const }
        }
        return r
      }),
    )
    toast("已添加为好友")
  }

  function handleRejectRequest(id: string) {
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r)))
  }

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

      {/* content */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5">
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
                  onClick={() => {
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

        {/* friend requests */}
        <Section title="好友申请" icon={<MessageCircle className="h-4 w-4" />}>
          {requests.length === 0 && <Empty text="暂无好友申请" />}
          <div className="flex flex-col gap-2">
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
        </Section>

        {/* friend list */}
        <Section title="我的好友" icon={<MessageCircle className="h-4 w-4" />}>
          {friends.length === 0 && <Empty text="还没有好友，先去添加吧" />}
          <div className="flex flex-col gap-2">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Avatar nickname={f.nickname} color={f.avatarColor} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{f.nickname}</p>
                  <p className="truncate text-xs text-text-secondary">{f.email}</p>
                </div>
                <AppButton variant="soft" className="h-9 shrink-0 px-3 text-xs" onClick={() => onEnterChat(f)}>
                  进入聊天室
                </AppButton>
              </div>
            ))}
          </div>
        </Section>
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

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-text-secondary">{text}</p>
}
