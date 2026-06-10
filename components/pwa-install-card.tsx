"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Share, X } from "lucide-react"
import { AppButton } from "@/components/app-button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone() {
  if (typeof window === "undefined") return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone)
}

export function PwaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)

  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
  }, [])

  useEffect(() => {
    setInstalled(isStandalone())
    setDismissed(window.localStorage.getItem("knowyou_pwa_install_dismissed") === "1")

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed || dismissed || (!installPrompt && !isIOS)) return null

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") setInstalled(true)
    setInstallPrompt(null)
  }

  function handleDismiss() {
    window.localStorage.setItem("knowyou_pwa_install_dismissed", "1")
    setDismissed(true)
  }

  return (
    <div className="mb-5 rounded-2xl border border-primary/25 bg-primary/10 p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {isIOS ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">安装 Know You</p>
            <button
              onClick={handleDismiss}
              className="rounded-full p-1 text-text-secondary transition-colors hover:bg-background/70 hover:text-foreground"
              aria-label="关闭安装提示"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            {isIOS
              ? "在 Safari 中点分享按钮，再选择添加到主屏幕。"
              : "添加到手机桌面后，可以像 App 一样打开。"}
          </p>
          {installPrompt && (
            <AppButton className="mt-3 h-9 px-4 text-xs" onClick={handleInstall}>
              <Download className="h-3.5 w-3.5" />
              添加到桌面
            </AppButton>
          )}
        </div>
      </div>
    </div>
  )
}
