"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Lock } from "lucide-react"
import { AppButton } from "@/components/app-button"

export function InsightDrawer({
  open,
  onClose,
  userAName,
  userBName,
  countA,
  countB,
}: {
  open: boolean
  onClose: () => void
  userAName: string
  userBName: string
  countA: number
  countB: number
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col bg-background safe-top"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">💡 互动模式洞察</h2>
              <button onClick={onClose} className="rounded-full p-1.5 text-text-secondary transition-colors hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-5">
              <StyleBlock name={`${userAName}的沟通风格`} count={countA} />
              <StyleBlock name={`${userBName}的沟通风格`} count={countB} />

              {/* locked block */}
              <div className="mt-2 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-center">
                <Lock className="mx-auto mb-2 h-5 w-5 text-text-secondary" />
                <p className="text-sm font-medium text-text-secondary">你们的互动模式</p>
                <p className="mt-1 text-xs text-text-secondary">积累更多对话后解锁</p>
              </div>
            </div>

            <div className="border-t border-border px-5 py-4 safe-bottom">
              <AppButton variant="outline" full onClick={onClose}>
                关闭
              </AppButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function StyleBlock({ name, count }: { name: string; count: number }) {
  const total = 10
  const pct = Math.min(100, (count / total) * 100)
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">{name}</p>
      <p className="mt-1 mb-3 text-xs text-text-secondary">AI 持续学习中，对话越多越准确 ✨</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-primary"
        />
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        已积累 {count} 条对话 / 解锁需 {total} 条
      </p>
    </div>
  )
}
