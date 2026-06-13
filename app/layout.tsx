import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ServiceWorkerRegister } from "@/components/service-worker-register"

export const metadata: Metadata = {
  title: "Know You · 猫猫",
  description: "一款专为情侣设计的沟通辅助工具，让猫猫陪你们把话说清楚。",
  applicationName: "Know You",
  manifest: "/manifest.json",
  metadataBase: new URL("https://know.yongteam.com"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Know You",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Know You",
  },
}

export const viewport: Viewport = {
  themeColor: "#FAFAF8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="bg-background">
      <body className="antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
