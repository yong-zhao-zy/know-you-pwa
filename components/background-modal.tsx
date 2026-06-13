"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, X } from "lucide-react"
import { AppButton } from "@/components/app-button"
import { VoiceTextArea } from "@/components/voice-text-area"
import type { ChatBackground, EmotionState } from "@/lib/types"

const EMOTIONS: { value: EmotionState; emoji: string; label: string }[] = [
  { value: "calm", emoji: "😌", label: "平静" },
  { value: "anxious", emoji: "😰", label: "有些焦虑" },
  { value: "wronged", emoji: "🥺", label: "比较委屈" },
  { value: "angry", emoji: "😤", label: "有些愤怒" },
  { value: "other", emoji: "💬", label: "其他" },
]

export function BackgroundModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (bg: ChatBackground) => void
  onClose: () => void
}) {
  const [topic, setTopic] = useState("")
  const [emotion, setEmotion] = useState<EmotionState | null>(null)
  const [hope, setHope] = useState("")

  const selectedEmotion = emotion ?? "other"

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background p-6 safe-bottom sm:rounded-3xl no-scrollbar"
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">开始之前，先告诉猫猫背景吧</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="退出对话间"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-5 text-xs leading-relaxed text-text-secondary">
          你的回答只有猫猫能看到，对方不可见
        </p>

        {/* field 1 */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-foreground">这次想聊的事情是什么？</label>
          <VoiceTextArea
            rows={3}
            placeholder="可以打字，也可以点麦克风说…"
            value={topic}
            onChange={setTopic}
          />
        </div>

        {/* field 2 */}
        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-foreground">你现在的情绪状态</label>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
              <button
                key={e.value}
                onClick={() => setEmotion(e.value)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-all active:translate-y-px ${
                  emotion === e.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-text-secondary hover:border-primary/40"
                }`}
              >
                <span>{e.emoji}</span>
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {/* field 3 */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground">你希望对方能理解什么？</label>
          <VoiceTextArea
            rows={3}
            placeholder="最想让对方知道的是…（可打字或语音）"
            value={hope}
            onChange={setHope}
          />
        </div>

        <AppButton
          full
          onClick={() => onSubmit({ topic, emotion: selectedEmotion, hope })}
        >
          好了，开始对话
        </AppButton>

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-center text-xs text-text-secondary transition-colors hover:text-foreground"
        >
          暂时不聊了，先退出
        </button>
      </motion.div>
    </div>
  )
}
