"use client"

import { motion } from "framer-motion"
import { Avatar } from "@/components/avatar"
import type { Message, Sender } from "@/lib/types"

export function MessageBubble({
  message,
  userA,
  userB,
}: {
  message: Message
  userA: { nickname: string; color: string }
  userB: { nickname: string; color: string }
}) {
  const isA = message.sender === "A"
  const isAi = message.sender === "AI"
  const person = isAi ? { nickname: "猫猫", color: "#F5F0FF" } : isA ? userA : userB

  return (
    <div className={`flex items-end gap-2 ${isA ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar nickname={person.nickname} color={person.color} size={30} />
      <div className={`flex max-w-[72%] flex-col gap-1 ${isA ? "items-end" : "items-start"}`}>
        {isAi && <span className="px-1 text-[11px] font-medium text-[#7e6bb0]">猫猫</span>}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground"
          style={{
            background: isAi ? "var(--ai-card)" : isA ? "var(--bubble-a)" : "var(--bubble-b)",
            borderLeft: isAi ? "4px solid var(--ai-line)" : undefined,
            borderTopRightRadius: isA ? 6 : undefined,
            borderTopLeftRadius: !isA ? 6 : undefined,
          }}
        >
          {message.text}
        </motion.div>
      </div>
    </div>
  )
}

export function getSenderName(sender: Sender, a: string, b: string) {
  return sender === "A" ? a : b
}
