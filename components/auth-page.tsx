"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, User as UserIcon, Sparkles } from "lucide-react"
import { AppButton } from "@/components/app-button"
import { TextField } from "@/components/text-field"
import { useToast } from "@/components/toast"
import { sendPasswordResetEmail, signInBackend, signUpBackend } from "@/lib/backend"
import type { User } from "@/lib/types"

type Mode = "login" | "register" | "reset"

export function AuthPage({ onAuthed, initialError = "" }: { onAuthed: (user: User) => void; initialError?: string }) {
  const toast = useToast()
  const [mode, setMode] = useState<Mode>("login")

  // form state
  const [email, setEmail] = useState("demo@knowyou.com")
  const [nickname, setNickname] = useState("")
  const [password, setPassword] = useState("demo123456")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    setError(initialError)
  }, [initialError])

  function resetFields(nextEmail = "", nextPassword = "") {
    setEmail(nextEmail)
    setPassword(nextPassword)
    setNickname("")
    setConfirm("")
    setError("")
  }

  async function handleLogin() {
    setError("")
    setVerifying(true)
    try {
      const user = await signInBackend(email.trim(), password)
      onAuthed(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后再试")
    } finally {
      setVerifying(false)
    }
  }

  async function handleRegister() {
    setError("")
    const cleanEmail = email.trim()
    if (!cleanEmail || (mode !== "reset" && !password) || (mode === "register" && !nickname.trim())) {
      setError("请完整填写所有信息")
      return
    }
    if (mode !== "reset" && password !== confirm) {
      setError("两次输入的密码不一致")
      return
    }

    setVerifying(true)
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(cleanEmail)
        toast("重置邮件已发送，请前往邮箱继续")
      } else {
        await signUpBackend(cleanEmail, password, nickname.trim())
        toast("验证邮件已发送，请前往邮箱确认注册")
      }
      setMode("login")
      setEmail(cleanEmail)
      setPassword(mode === "reset" ? "" : password)
      setNickname("")
      setConfirm("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后再试")
    } finally {
      setVerifying(false)
    }
  }

  const isRegisterLike = mode === "register"

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col justify-center px-7">
        {/* brand */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-9"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Know You</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary text-pretty">
            {mode === "reset"
              ? "重置密码 / 重新注册"
              : "让翻译小天使，帮你们更懂彼此。"}
          </p>
        </motion.div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3"
        >
          <Field icon={<Mail className="h-4 w-4" />}>
            <TextField
              type="email"
              inputMode="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-0 bg-transparent pl-0 focus:ring-0"
            />
          </Field>

          {isRegisterLike && (
            <Field icon={<UserIcon className="h-4 w-4" />}>
              <TextField
                placeholder="昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="border-0 bg-transparent pl-0 focus:ring-0"
              />
            </Field>
          )}

          {mode !== "reset" && (
            <Field icon={<Lock className="h-4 w-4" />}>
              <TextField
                type="password"
                placeholder={isRegisterLike ? "设置密码" : "密码"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border-0 bg-transparent pl-0 focus:ring-0"
              />
            </Field>
          )}

          {mode === "register" && (
            <Field icon={<Lock className="h-4 w-4" />}>
              <TextField
                type="password"
                placeholder="再次确认密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="border-0 bg-transparent pl-0 focus:ring-0"
              />
            </Field>
          )}

          {error && <p className="px-1 text-xs text-[#d98a8a]">{error}</p>}

          <AppButton
            full
            className="mt-2"
            disabled={verifying}
            onClick={mode === "login" ? handleLogin : handleRegister}
          >
            {verifying
              ? "处理中…"
              : mode === "login"
                ? "登录"
                : mode === "reset"
                  ? "发送重置邮件"
                  : "注册"}
          </AppButton>

          {mode === "login" && (
            <button
              onClick={() => {
                setMode("reset")
                resetFields()
              }}
              className="mt-1 self-center text-xs text-text-secondary transition-colors hover:text-foreground"
            >
              忘记密码？
            </button>
          )}
        </motion.div>
      </div>

      {/* footer switch */}
      <div className="px-7 pb-8 safe-bottom">
        {mode === "login" ? (
          <p className="text-center text-xs text-text-secondary">
            还没有账号？{" "}
            <button
              onClick={() => {
                setMode("register")
                resetFields()
              }}
              className="font-medium text-primary hover:underline"
            >
              去注册
            </button>
          </p>
        ) : mode === "reset" ? (
          <p className="text-center text-xs text-text-secondary">
            想起来了？{" "}
            <button
              onClick={() => {
                setMode("login")
                resetFields("demo@knowyou.com", "demo123456")
              }}
              className="font-medium text-primary hover:underline"
            >
              去登录
            </button>
          </p>
        ) : (
          <p className="text-center text-xs text-text-secondary">
            已有账号？{" "}
            <button
              onClick={() => {
                setMode("login")
                resetFields("demo@knowyou.com", "demo123456")
              }}
              className="font-medium text-primary hover:underline"
            >
              去登录
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center gap-2.5 rounded-xl border border-border bg-card px-4 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <span className="text-text-secondary">{icon}</span>
      {children}
    </div>
  )
}
