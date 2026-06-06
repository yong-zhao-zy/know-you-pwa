"use client"

import { useEffect, useState } from "react"
import { ToastProvider } from "@/components/toast"
import { AuthPage } from "@/components/auth-page"
import { FriendHomePage } from "@/components/friend-home-page"
import { ChatRoomPage } from "@/components/chat-room-page"
import { seedIfNeeded, getCurrentUser, setCurrentUser } from "@/lib/storage"
import type { User, Friend } from "@/lib/types"

type Screen = "auth" | "home" | "chat"

export default function Page() {
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>("auth")
  const [user, setUser] = useState<User | null>(null)
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null)

  useEffect(() => {
    seedIfNeeded()
    const current = getCurrentUser()
    if (current) {
      setUser(current)
      setScreen("home")
    }
    setReady(true)
  }, [])

  if (!ready) {
    return <div className="h-[100dvh] bg-background" />
  }

  return (
    <ToastProvider>
      <main className="mx-auto h-[100dvh] w-full max-w-md overflow-hidden bg-background sm:border-x sm:border-border sm:shadow-sm">
        {screen === "auth" && (
          <AuthPage
            onAuthed={(u) => {
              setUser(u)
              setScreen("home")
            }}
          />
        )}

        {screen === "home" && user && (
          <FriendHomePage
            currentUser={user}
            onLogout={() => {
              setCurrentUser(null)
              setUser(null)
              setScreen("auth")
            }}
            onEnterChat={(f) => {
              setActiveFriend(f)
              setScreen("chat")
            }}
          />
        )}

        {screen === "chat" && user && activeFriend && (
          <ChatRoomPage currentUser={user} friend={activeFriend} onBack={() => setScreen("home")} />
        )}
      </main>
    </ToastProvider>
  )
}
