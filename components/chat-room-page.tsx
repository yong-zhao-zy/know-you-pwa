"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { ChevronLeft, Send, Mic, BarChart3 } from "lucide-react"
import { Avatar } from "@/components/avatar"
import { MessageBubble } from "@/components/message-bubble"
import { AiInterpretationCard } from "@/components/ai-interpretation-card"
import { BackgroundModal } from "@/components/background-modal"
import { InsightDrawer } from "@/components/insight-drawer"
import {
  generateInterpretation,
  generateReceiverHint,
  generateGuessOptions,
  genId,
} from "@/lib/storage"
import {
  createMessageBackend,
  getMessagesBackend,
  getOrCreateRoom,
  updateInterpretationBackend,
} from "@/lib/backend"
import type { User, Friend, Message, Sender, ChatBackground } from "@/lib/types"

export function ChatRoomPage({
  currentUser,
  friend,
  onBack,
}: {
  currentUser: User
  friend: Friend
  onBack: () => void
}) {
  const [showBgModal, setShowBgModal] = useState(true)
  const [background, setBackground] = useState<ChatBackground | null>(null)
  const [viewer, setViewer] = useState<Sender>("A")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [input, setInput] = useState("")
  const [recording, setRecording] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [roomId, setRoomId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const userA = { nickname: currentUser.nickname, color: currentUser.avatarColor }
  const userB = { nickname: friend.nickname, color: friend.avatarColor }

  useEffect(() => {
    let cancelled = false
    getOrCreateRoom(currentUser.id, friend.id)
      .then(async (nextRoomId) => {
        if (cancelled) return
        setRoomId(nextRoomId)
        const nextMessages = await getMessagesBackend(nextRoomId, currentUser.id)
        if (!cancelled) setMessages(nextMessages)
      })
      .catch(() => setMessages([]))
    return () => {
      cancelled = true
    }
  }, [currentUser.id, friend.id])

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    })
  }, [messages])

  const countA = useMemo(() => messages.filter((m) => m.sender === "A").length + 2, [messages])
  const countB = useMemo(() => messages.filter((m) => m.sender === "B").length + 1, [messages])

  function updateMessage(id: string, fn: (m: Message) => Message) {
    setMessages((ms) => {
      const next = ms.map((m) => (m.id === id ? fn(m) : m))
      const changed = next.find((m) => m.id === id)
      if (changed) updateInterpretationBackend(changed).catch(() => {})
      return next
    })
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || !roomId || sending) return
    setInput("")
    setSending(true)
    try {
      const msg = await createMessageBackend(roomId, text, background)
      setMessages((ms) => [...ms, msg])
    } catch {
      const fallback: Message = {
        id: genId(),
        sender: "A",
        text,
        createdAt: Date.now(),
        interpretation: generateInterpretation(text),
        guessOptions: generateGuessOptions(),
        confirmed: false,
        receiverHint: generateReceiverHint(text),
        understood: false,
        expanded: false,
      }
      setMessages((ms) => [...ms, fallback])
    } finally {
      setSending(false)
    }
  }

  function handleVoice() {
    if (recording) return
    setRecording(true)
    setTimeout(() => {
      setInput("我其实有点难过，但不知道怎么说")
      setRecording(false)
    }, 3000)
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* top bar */}
      <header className="safe-top z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-3 py-3">
          <button onClick={onBack} className="rounded-full p-1.5 text-foreground transition-colors hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-[15px] font-semibold text-foreground">你与 {friend.nickname} 的对话间</h1>
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-full p-1.5 text-foreground transition-colors hover:bg-muted"
            aria-label="互动洞察"
          >
            <BarChart3 className="h-5 w-5" />
          </button>
        </div>

        {/* participants bar */}
        <div className="flex items-center justify-center gap-4 pb-3">
          <div className="flex items-center gap-1.5">
            <Avatar nickname={userA.nickname} color={userA.color} size={26} />
            <span className="text-xs text-foreground">{userA.nickname}</span>
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">你</span>
          </div>
          <span className="text-base">🧚</span>
          <div className="flex items-center gap-1.5">
            <Avatar nickname={userB.nickname} color={userB.color} size={26} />
            <span className="text-xs text-foreground">{userB.nickname}</span>
          </div>
        </div>

        {/* viewer switch */}
        <div className="flex items-center justify-center gap-1 border-t border-border bg-muted/30 py-2">
          <span className="mr-1 text-[11px] text-text-secondary">当前视角</span>
          {(["A", "B"] as Sender[]).map((s) => (
            <button
              key={s}
              onClick={() => setViewer(s)}
              className={`rounded-full px-3 py-1 text-xs transition-all ${
                viewer === s ? "bg-primary text-primary-foreground" : "text-text-secondary hover:bg-muted"
              }`}
            >
              {s === "A" ? userA.nickname : userB.nickname}
            </button>
          ))}
        </div>
      </header>

      {/* system tip */}
      {background && (
        <div className="px-4 pt-3">
          <p className="mx-auto w-fit rounded-full bg-accent px-3 py-1.5 text-center text-[11px] text-[#7e6bb0]">
            翻译小天使已了解背景，随时为你们服务 🧚
          </p>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-5">
          {messages.map((m) => {
            const align = m.sender === "A" ? "right" : "left"
            return (
              <div key={m.id} className="flex flex-col">
                <MessageBubble message={m} userA={userA} userB={userB} />
                <AiInterpretationCard
                  message={m}
                  viewer={viewer}
                  align={align}
                  onToggleGuess={(optionId) =>
                    updateMessage(m.id, (mm) => ({
                      ...mm,
                      guessOptions: mm.guessOptions.map((o) =>
                        o.id === optionId ? { ...o, checked: !o.checked } : o,
                      ),
                    }))
                  }
                  onConfirm={() => updateMessage(m.id, (mm) => ({ ...mm, confirmed: true }))}
                  onUnderstood={() => updateMessage(m.id, (mm) => ({ ...mm, understood: true }))}
                  onExpand={() => updateMessage(m.id, (mm) => ({ ...mm, expanded: true }))}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* input bar */}
      <div className="border-t border-border bg-background px-3 py-2.5 safe-bottom">
        <div className="flex items-center gap-2">
          <button
            onClick={handleVoice}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              recording ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-[#ededeb]"
            }`}
            aria-label="语音输入"
          >
            <Mic className="h-5 w-5" />
          </button>
          <input
            value={recording ? "" : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={recording ? "语音识别中…" : "说点什么…"}
            disabled={recording}
            className="h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || recording || sending || !roomId}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[#b98fcf] active:translate-y-px disabled:opacity-40"
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* background modal */}
      <AnimatePresence>
        {showBgModal && (
          <BackgroundModal
            onSubmit={(bg) => {
              setBackground(bg)
              setShowBgModal(false)
            }}
            onClose={onBack}
          />
        )}
      </AnimatePresence>

      {/* insight drawer */}
      <InsightDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userAName={userA.nickname}
        userBName={userB.nickname}
        countA={countA}
        countB={countB}
      />
    </div>
  )
}
