"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Check, Eye } from "lucide-react"
import { AppButton } from "@/components/app-button"
import type { Message, Sender } from "@/lib/types"

export function AiInterpretationCard({
  message,
  viewer,
  align,
  senderShortName,
  receiverShortName,
  onToggleGuess,
  onConfirm,
  onUnderstood,
  onExpand,
}: {
  message: Message
  viewer: Sender
  align: "left" | "right"
  senderShortName: string
  receiverShortName: string
  onToggleGuess: (optionId: string) => void
  onConfirm: () => void
  onUnderstood: () => void
  onExpand: () => void
}) {
  const [explain, setExplain] = useState(false)
  const isSender = viewer === message.sender
  const isReceiver = !isSender

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`mt-2 max-w-[88%] rounded-2xl bg-ai-card p-3.5 ${align === "right" ? "ml-auto" : "mr-auto"}`}
      style={{ borderLeft: "4px solid var(--ai-line)" }}
    >
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm leading-none">
          🧚
        </span>
        <p className="min-w-0 text-[13px] leading-relaxed text-foreground/85">{message.interpretation}</p>
      </div>

      {message.interpreting ? (
        <div className="rounded-xl bg-white/60 px-3 py-2.5 text-xs text-text-secondary">
          解读完成后会自动出现在这里。
        </div>
      ) : (
        <>

      {/* ② guesses */}
      <div className="mb-3 rounded-xl bg-white/60 p-2.5">
        <p className="mb-2 text-[13px] font-medium text-foreground">
          {senderShortName}内心可能想说的是…{isSender && "（发送方可确认）"}
        </p>

        {isReceiver && !message.confirmed ? (
          <p className="py-1 text-xs italic text-text-secondary">等待{senderShortName}确认中…</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {message.guessOptions.map((opt) => {
              const showAsResult = message.confirmed || isReceiver
              const interactive = isSender && !message.confirmed
              const active = opt.checked
              // receiver before confirm hidden above; here either confirmed or sender editing
              if (showAsResult && !active && message.confirmed) {
                // only show selected ones prominently, but keep unselected dimmed
              }
              return (
                <button
                  key={opt.id}
                  disabled={!interactive}
                  onClick={() => interactive && onToggleGuess(opt.id)}
                  className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] leading-snug transition-colors ${
                    active
                      ? "bg-primary/15 text-foreground"
                      : interactive
                        ? "bg-white/70 text-foreground/70 hover:bg-white"
                        : "text-foreground/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      active ? "border-primary bg-primary text-white" : "border-border bg-white"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                  </span>
                  {opt.text}
                </button>
              )
            })}
          </div>
        )}

        {isSender && (
          <AppButton
            variant={message.confirmed ? "soft" : "primary"}
            full
            className="mt-2.5 h-9 text-xs"
            disabled={message.confirmed}
            onClick={onConfirm}
          >
            {message.confirmed ? "已确认 ✓" : "确认我的想法"}
          </AppButton>
        )}
      </div>

      {/* ③ receiver-only hint */}
      {isReceiver && (
        <div className="mb-3 rounded-xl bg-white/60 p-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-[#7e6bb0]" />
            <p className="text-[13px] font-medium text-foreground">猫猫悄悄补充</p>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground/80">{message.receiverHint}</p>
        </div>
      )}

      {/* ④ actions */}
      <div className="flex flex-wrap gap-2">
        <AppButton
          variant={message.understood ? "soft" : "outline"}
          className="h-8 px-3 text-xs"
          disabled={message.understood}
          onClick={onUnderstood}
        >
          {message.understood ? "已读取" : "我理解了 💙"}
        </AppButton>
        <AppButton
          variant="ghost"
          className="h-8 px-3 text-xs text-[#7e6bb0]"
          onClick={() => {
            setExplain(true)
            onExpand()
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          需要小天使进一步解释
        </AppButton>
      </div>

      {explain && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3 }}
          className="mt-2.5 rounded-lg bg-white/60 px-3 py-2.5 text-[13px] leading-relaxed text-foreground/80"
        >
          小天使再补充一句：你可以试着用「我听见你在担心……」开头，会比直接解释更容易被接住。
          也可以直接叫出{receiverShortName}的名字，把注意力放回你们正在共同面对的事。
        </motion.p>
      )}
        </>
      )}
    </motion.div>
  )
}
