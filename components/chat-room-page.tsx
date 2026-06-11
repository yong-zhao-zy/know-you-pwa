"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { ChevronLeft, Send, Mic, BarChart3, FileText, X } from "lucide-react"
import { Avatar } from "@/components/avatar"
import { MessageBubble } from "@/components/message-bubble"
import { AiInterpretationCard } from "@/components/ai-interpretation-card"
import { BackgroundModal } from "@/components/background-modal"
import { InsightDrawer } from "@/components/insight-drawer"
import { useToast } from "@/components/toast"
import {
  generateInterpretation,
  generateReceiverHint,
  generateGuessOptions,
  genId,
} from "@/lib/storage"
import {
  applyInterpretationToMessage,
  createMessageBackend,
  getChatBackgroundsBackend,
  getMessagesBackend,
  getOrCreateRoom,
  mapMessageWithInterpretation,
  renameChatRoomBackend,
  saveChatBackgroundBackend,
  updateInterpretationBackend,
} from "@/lib/backend"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { MessageRow, InterpretationRow } from "@/lib/backend"
import type { User, Friend, Message, Sender, ChatBackground, ChatBackgroundEntry, EmotionState } from "@/lib/types"

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: any) => void) | null
  onerror: ((event: any) => void) | null
  onend: (() => void) | null
}

const EMOTION_LABELS: Record<EmotionState, string> = {
  calm: "平静",
  anxious: "有些焦虑",
  wronged: "比较委屈",
  angry: "有些愤怒",
  other: "其他",
}

export function ChatRoomPage({
  currentUser,
  friend,
  onBack,
  initialRoomId,
}: {
  currentUser: User
  friend: Friend
  onBack: () => void
  initialRoomId?: string | null
}) {
  const toast = useToast()
  const [showBgModal, setShowBgModal] = useState(true)
  const [background, setBackground] = useState<ChatBackground | null>(null)
  const [backgroundEntries, setBackgroundEntries] = useState<ChatBackgroundEntry[]>([])
  const [viewer, setViewer] = useState<Sender>("A")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const [input, setInput] = useState("")
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [roomId, setRoomId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingInterpretationsRef = useRef(new Map<string, InterpretationRow>())
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const voiceBaseInputRef = useRef("")
  const recordingTimerRef = useRef<number | null>(null)
  const recordingLimitTimerRef = useRef<number | null>(null)

  const userA = { nickname: currentUser.nickname, color: currentUser.avatarColor }
  const userB = { nickname: friend.nickname, color: friend.avatarColor }

  const mergeMessages = useCallback((nextMessages: Message[]) => {
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]))
      for (const message of nextMessages) {
        const pendingInterpretation = pendingInterpretationsRef.current.get(message.id)
        const messageWithInterpretation = pendingInterpretation
          ? applyInterpretationToMessage(message, pendingInterpretation)
          : message
        byId.set(message.id, {
          ...byId.get(message.id),
          ...messageWithInterpretation,
        })
        if (pendingInterpretation) pendingInterpretationsRef.current.delete(message.id)
      }
      return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt)
    })
  }, [])

  const refreshMessages = useCallback(() => {
    if (!roomId) return Promise.resolve()
    return getMessagesBackend(roomId, currentUser.id)
      .then(mergeMessages)
      .catch(() => {})
  }, [roomId, currentUser.id, mergeMessages])

  useEffect(() => {
    let cancelled = false
    const roomPromise = initialRoomId ? Promise.resolve(initialRoomId) : getOrCreateRoom(currentUser.id, friend.id)
    roomPromise
      .then(async (nextRoomId) => {
        if (cancelled) return
        setRoomId(nextRoomId)
        const [nextMessages, nextBackgrounds] = await Promise.all([
          getMessagesBackend(nextRoomId, currentUser.id),
          getChatBackgroundsBackend(nextRoomId),
        ])
        if (!cancelled) {
          setMessages(nextMessages)
          setBackgroundEntries(nextBackgrounds)
          const ownBackground = nextBackgrounds.find((entry) => entry.userId === currentUser.id)
          if (ownBackground) {
            setBackground(ownBackground.background)
            setShowBgModal(false)
          }
        }
      })
      .catch(() => setMessages([]))
    return () => {
      cancelled = true
    }
  }, [currentUser.id, friend.id, initialRoomId])

  useEffect(() => {
    if (!roomId) return
    const timer = window.setInterval(() => {
      getChatBackgroundsBackend(roomId)
        .then(setBackgroundEntries)
        .catch(() => {})
    }, 5000)
    return () => window.clearInterval(timer)
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    refreshMessages()

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshMessages()
      }
    }, 2000)

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshMessages()
    }
    window.addEventListener("focus", refreshMessages)
    window.addEventListener("online", refreshMessages)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refreshMessages)
      window.removeEventListener("online", refreshMessages)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [roomId, refreshMessages])

  useEffect(() => {
    if (!roomId) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const channel = supabase
      .channel(`chat-room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: { new: MessageRow }) => {
          const message = mapMessageWithInterpretation(payload.new, currentUser.id)
          mergeMessages([message])
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_interpretations",
        },
        (payload: { new: InterpretationRow }) => {
          const interpretation = payload.new
          setMessages((current) => {
            let matched = false
            const next = current.map((message) => {
              if (message.id !== interpretation.message_id) return message
              matched = true
              return applyInterpretationToMessage(message, interpretation)
            })
            if (!matched) pendingInterpretationsRef.current.set(interpretation.message_id, interpretation)
            return next
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, currentUser.id, mergeMessages])

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    })
  }, [messages])

  useEffect(() => {
    return () => {
      stopVoiceRecognition()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      mergeMessages([msg])
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

  function getSpeechRecognition() {
    if (typeof window === "undefined") return null
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
  }

  function appendVoiceText(base: string, transcript: string) {
    const cleanTranscript = transcript.trim()
    if (!cleanTranscript) return base
    if (!base.trim()) return cleanTranscript
    const needsSpace = /[a-zA-Z0-9]$/.test(base.trim()) && /^[a-zA-Z0-9]/.test(cleanTranscript)
    return `${base.trimEnd()}${needsSpace ? " " : ""}${cleanTranscript}`
  }

  function clearVoiceTimers() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (recordingLimitTimerRef.current) {
      window.clearTimeout(recordingLimitTimerRef.current)
      recordingLimitTimerRef.current = null
    }
  }

  function stopVoiceRecognition() {
    clearVoiceTimers()
    setRecording(false)
    setRecordingSeconds(0)
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      try {
        recognition.stop()
      } catch {}
    }
  }

  function startVoiceRecognition() {
    if (recording || sending) return
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      toast("当前浏览器不支持实时语音识别，请换 Safari/Chrome 或先手动输入")
      return
    }

    const recognition: SpeechRecognitionLike = new SpeechRecognition()
    recognition.lang = "zh-CN"
    recognition.continuous = true
    recognition.interimResults = true
    voiceBaseInputRef.current = input

    recognition.onresult = (event: any) => {
      let transcript = ""
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript ?? ""
      }
      setInput(appendVoiceText(voiceBaseInputRef.current, transcript))
    }
    recognition.onerror = (event: any) => {
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        toast("麦克风权限未开启，允许浏览器使用麦克风后再试")
      } else if (event?.error === "no-speech") {
        toast("没有识别到声音，可以再按住说一次")
      } else {
        toast("语音识别暂时不可用，请稍后再试")
      }
      stopVoiceRecognition()
    }
    recognition.onend = () => {
      clearVoiceTimers()
      recognitionRef.current = null
      setRecording(false)
      setRecordingSeconds(0)
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((seconds) => Math.min(seconds + 1, 60))
      }, 1000)
      recordingLimitTimerRef.current = window.setTimeout(() => {
        stopVoiceRecognition()
      }, 60000)
    } catch {
      recognitionRef.current = null
      toast("语音识别启动失败，请稍后再试")
    }
  }

  async function handleBackgroundSubmit(bg: ChatBackground) {
    setBackground(bg)
    setShowBgModal(false)
    if (!roomId) return
    try {
      const saved = await saveChatBackgroundBackend(roomId, bg)
      if (bg.topic.trim()) {
        renameChatRoomBackend(roomId, bg.topic.trim()).catch(() => {})
      }
      setBackgroundEntries((entries) => {
        const withoutOwn = entries.filter((entry) => entry.userId !== currentUser.id)
        return [...withoutOwn, saved]
      })
    } catch {
      setBackgroundEntries((entries) => {
        const ownEntry: ChatBackgroundEntry = {
          userId: currentUser.id,
          background: bg,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        const withoutOwn = entries.filter((entry) => entry.userId !== currentUser.id)
        return [...withoutOwn, ownEntry]
      })
    }
  }

  function getBackgroundFor(userId: string) {
    return backgroundEntries.find((entry) => entry.userId === userId)?.background ?? null
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setBackgroundOpen(true)}
              className="rounded-full p-1.5 text-foreground transition-colors hover:bg-muted"
              aria-label="本次事件背景"
            >
              <FileText className="h-5 w-5" />
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-full p-1.5 text-foreground transition-colors hover:bg-muted"
              aria-label="互动洞察"
            >
              <BarChart3 className="h-5 w-5" />
            </button>
          </div>
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
            type="button"
            onPointerDown={(event) => {
              event.preventDefault()
              startVoiceRecognition()
            }}
            onPointerUp={(event) => {
              event.preventDefault()
              stopVoiceRecognition()
            }}
            onPointerCancel={stopVoiceRecognition}
            onPointerLeave={() => {
              if (recording) stopVoiceRecognition()
            }}
            onContextMenu={(event) => event.preventDefault()}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
              recording ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-[#ededeb]"
            }`}
            aria-label={recording ? "松开结束语音输入" : "按住语音输入"}
            title="按住说话"
          >
            <Mic className="h-5 w-5" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={recording ? `语音识别中… ${recordingSeconds}s / 60s` : "说点什么…"}
            className="h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none placeholder:text-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || !roomId}
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
              handleBackgroundSubmit(bg)
            }}
            onClose={onBack}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {backgroundOpen && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 px-3 pb-3 pt-12">
            <div className="w-full max-w-md rounded-3xl bg-background p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">本次事件背景</p>
                  <p className="mt-0.5 text-[11px] text-text-secondary">翻译小天使已了解 🧚</p>
                </div>
                <button
                  onClick={() => setBackgroundOpen(false)}
                  className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="关闭事件背景"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-2">
                <BackgroundSummary
                  label={`${currentUser.nickname}（你）`}
                  background={getBackgroundFor(currentUser.id)}
                />
                <BackgroundSummary label={friend.nickname} background={getBackgroundFor(friend.id)} />
              </div>
            </div>
          </div>
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

function BackgroundSummary({ label, background }: { label: string; background: ChatBackground | null }) {
  if (!background) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/60 px-3 py-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="mt-1 text-[11px] text-text-secondary">等待对方填写背景</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-background/75 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-foreground">{label}</p>
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
          {EMOTION_LABELS[background.emotion]}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-text-secondary">
        <span className="text-foreground/80">事情：</span>
        {background.topic.trim() || "未填写"}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">
        <span className="text-foreground/80">希望理解：</span>
        {background.hope.trim() || "未填写"}
      </p>
    </div>
  )
}
