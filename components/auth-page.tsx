"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Mail, Lock, User as UserIcon, Sparkles } from "lucide-react"
import { AppButton } from "@/components/app-button"
import { TextField } from "@/components/text-field"
import { useToast } from "@/components/toast"
import {
  confirmFriendPasswordReset,
  getPasswordResetFriends,
  requestFriendPasswordReset,
  signInBackend,
  signUpBackend,
} from "@/lib/backend"
import type { Friend, User } from "@/lib/types"

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
  const [resetFriends, setResetFriends] = useState<Friend[]>([])
  const [selectedResetFriend, setSelectedResetFriend] = useState<Friend | null>(null)
  const [resetCode, setResetCode] = useState("")

  useEffect(() => {
    setError(initialError)
  }, [initialError])

  function resetFields(nextEmail = "", nextPassword = "") {
    setEmail(nextEmail)
    setPassword(nextPassword)
    setNickname("")
    setConfirm("")
    setError("")
    setResetFriends([])
    setSelectedResetFriend(null)
    setResetCode("")
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
    if (!cleanEmail || !password || (mode === "register" && !nickname.trim())) {
      setError("请完整填写所有信息")
      return
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致")
      return
    }

    setVerifying(true)
    try {
      const user = await signUpBackend(cleanEmail, password, nickname.trim())
      toast("注册成功，已自动登录")
      onAuthed(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后再试")
    } finally {
      setVerifying(false)
    }
  }

  async function handleFindResetFriends() {
    const cleanEmail = email.trim()
    if (!cleanEmail) {
      setError("请先填写邮箱")
      return
    }

    setError("")
    setVerifying(true)
    try {
      const friends = await getPasswordResetFriends(cleanEmail)
      setResetFriends(friends)
      setSelectedResetFriend(null)
      if (friends.length === 0) {
        setError("这个账号还没有好友，暂时无法通过好友验证码找回密码")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取好友列表失败")
    } finally {
      setVerifying(false)
    }
  }

  async function handleRequestResetCode(friend: Friend) {
    setError("")
    setVerifying(true)
    try {
      await requestFriendPasswordReset(email.trim(), friend.id)
      setSelectedResetFriend(friend)
      toast(`验证码已发送给 ${friend.nickname}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败")
    } finally {
      setVerifying(false)
    }
  }

  async function handleConfirmReset() {
    setError("")
    if (!email.trim() || !resetCode.trim() || !password || !confirm) {
      setError("请填写验证码和新密码")
      return
    }
    if (password !== confirm) {
      setError("两次输入的新密码不一致")
      return
    }

    setVerifying(true)
    try {
      await confirmFriendPasswordReset(email.trim(), resetCode, password)
      toast("密码已更新，请使用新密码登录")
      setMode("login")
      setPassword("")
      setConfirm("")
      setResetCode("")
      setResetFriends([])
      setSelectedResetFriend(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "密码修改失败")
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
              : "让猫猫陪你们把话说清楚。"}
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

          {mode === "reset" && (
            <>
              {resetFriends.length > 0 && (
                <div className="flex flex-col gap-2">
                  {resetFriends.map((friend) => (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => handleRequestResetCode(friend)}
                      disabled={verifying}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                        selectedResetFriend?.id === friend.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="block font-medium">{friend.nickname}</span>
                      <span className="block truncate text-xs text-text-secondary">{friend.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedResetFriend && (
                <>
                  <Field icon={<Lock className="h-4 w-4" />}>
                    <TextField
                      inputMode="numeric"
                      placeholder="输入好友收到的 6 位验证码"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="border-0 bg-transparent pl-0 focus:ring-0"
                    />
                  </Field>
                  <Field icon={<Lock className="h-4 w-4" />}>
                    <TextField
                      type="password"
                      placeholder="设置新密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-0 bg-transparent pl-0 focus:ring-0"
                    />
                  </Field>
                  <Field icon={<Lock className="h-4 w-4" />}>
                    <TextField
                      type="password"
                      placeholder="再次确认新密码"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="border-0 bg-transparent pl-0 focus:ring-0"
                    />
                  </Field>
                </>
              )}
            </>
          )}

          {error && <p className="px-1 text-xs text-[#d98a8a]">{error}</p>}

          <AppButton
            full
            className="mt-2"
            disabled={verifying}
            onClick={mode === "login" ? handleLogin : mode === "reset" ? selectedResetFriend ? handleConfirmReset : handleFindResetFriends : handleRegister}
          >
            {verifying
              ? "处理中…"
              : mode === "login"
                ? "登录"
                : mode === "reset"
                  ? selectedResetFriend
                    ? "确认修改密码"
                    : "选择好友验证"
                  : "注册"}
          </AppButton>

          {mode === "login" && (
            <div className="mt-1 flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  setMode("reset")
                  resetFields()
                }}
                className="text-xs text-text-secondary transition-colors hover:text-foreground"
              >
                忘记密码？
              </button>
            </div>
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
