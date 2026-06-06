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
  const person = isA ? userA : userB

  return (
    <div className={`flex items-end gap-2 ${isA ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar nickname={person.nickname} color={person.color} size={30} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="max-w-[72%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground"
        style={{
          background: isA ? "var(--bubble-a)" : "var(--bubble-b)",
          borderTopRightRadius: isA ? 6 : undefined,
          borderTopLeftRadius: !isA ? 6 : undefined,
        }}
      >
        {message.text}
      </motion.div>
    </div>
  )
}

export function getSenderName(sender: Sender, a: string, b: string) {
  return sender === "A" ? a : b
}
