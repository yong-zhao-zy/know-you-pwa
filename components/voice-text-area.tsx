"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square } from "lucide-react"
import { cn } from "@/lib/utils"

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: any) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

const FALLBACK_PHRASES = [
  "我其实挺在乎这件事的",
  "只是当时不知道怎么开口",
  "希望你能明白我的想法",
  "我想我们可以好好聊聊",
]

export function VoiceTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  rows?: number
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // 光标位置（语音插入点）。默认插到末尾。
  const cursorRef = useRef<number>(value.length)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valueRef = useRef(value)
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  // 在当前光标处插入文本，并把光标移动到插入内容之后
  function insertAtCursor(text: string) {
    if (!text) return
    const base = valueRef.current
    const pos = Math.min(cursorRef.current, base.length)
    const next = base.slice(0, pos) + text + base.slice(pos)
    cursorRef.current = pos + text.length
    valueRef.current = next
    onChange(next)
    // 还原光标到插入点之后
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(cursorRef.current, cursorRef.current)
      }
    })
  }

  function stopRecording() {
    setRecording(false)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current)
      fallbackTimer.current = null
    }
  }

  function startRecording() {
    // 记录当前光标位置作为插入点
    const el = textareaRef.current
    if (el) {
      cursorRef.current = el.selectionStart ?? value.length
    }

    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

    if (SR) {
      const recognition: SpeechRecognitionLike = new SR()
      recognition.lang = "zh-CN"
      recognition.continuous = false
      recognition.interimResults = false
      recognition.onresult = (e: any) => {
        const transcript = Array.from(e.results)
          .map((r: any) => r[0]?.transcript ?? "")
          .join("")
        insertAtCursor(transcript)
      }
      recognition.onerror = () => stopRecording()
      recognition.onend = () => stopRecording()
      recognitionRef.current = recognition
      try {
        recognition.start()
        setRecording(true)
      } catch {
        recognitionRef.current = null
        simulate()
      }
    } else {
      simulate()
    }
  }

  // 无原生语音 API 时的模拟识别
  function simulate() {
    setRecording(true)
    const phrase = FALLBACK_PHRASES[Math.floor(Math.random() * FALLBACK_PHRASES.length)]
    fallbackTimer.current = setTimeout(() => {
      insertAtCursor(phrase)
      stopRecording()
    }, 1800)
  }

  useEffect(() => {
    return () => stopRecording()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle() {
    if (recording) stopRecording()
    else startRecording()
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          cursorRef.current = e.target.selectionStart ?? e.target.value.length
          onChange(e.target.value)
        }}
        onSelect={(e) => {
          cursorRef.current = (e.target as HTMLTextAreaElement).selectionStart ?? 0
        }}
        className={cn(
          "w-full rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm leading-relaxed text-foreground",
          "placeholder:text-text-secondary outline-none transition-colors resize-none",
          "focus:border-primary focus:ring-2 focus:ring-primary/20",
        )}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={recording ? "停止语音输入" : "语音输入"}
        className={cn(
          "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          recording
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-text-secondary hover:bg-secondary hover:text-foreground",
        )}
      >
        {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
      </button>
      {recording && (
        <span className="absolute bottom-3.5 right-12 text-xs text-primary">聆听中…</span>
      )}
    </div>
  )
}
