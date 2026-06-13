import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { ChatBackgroundEntry, MessageKind, Sender } from "@/lib/types"

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

type GuideRequest = {
  kind?: MessageKind
  participants?: {
    currentUser?: { nickname?: string }
    friend?: { nickname?: string }
  }
  backgrounds?: ChatBackgroundEntry[]
  recentMessages?: { sender: Sender; text: string; kind?: MessageKind }[]
}

function firstChar(name?: string) {
  const trimmed = name?.trim()
  if (!trimmed) return "一方"
  return Array.from(trimmed)[0] ?? trimmed
}

function fallback(payload: GuideRequest) {
  const current = firstChar(payload.participants?.currentUser?.nickname)
  const friend = firstChar(payload.participants?.friend?.nickname)
  if (payload.kind === "ai_opening_question") {
    return {
      kind: "ai_opening_question" as MessageKind,
      text: `猫猫先不判断谁对谁错。${current}和${friend}可以各自说一句：这件事里，最希望被理解的部分是什么？`,
    }
  }
  return {
    kind: "ai_clarifying_question" as MessageKind,
    text: `猫猫想帮你们先把话说清楚一点。${current}和${friend}可以先各自补充一个具体时刻，再说那个时刻带来的感受。`,
  }
}

async function assertAuthenticated(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) return

  const supabase = createClient(url, anonKey)
  const { error } = await supabase.auth.getUser(token)
  if (error) throw new Error("Unauthorized")
}

export async function POST(request: NextRequest) {
  try {
    await assertAuthenticated(request)
    const payload = (await request.json()) as GuideRequest
    const kind = payload.kind ?? "ai_clarifying_question"
    const currentName = payload.participants?.currentUser?.nickname ?? "一方"
    const friendName = payload.participants?.friend?.nickname ?? "另一方"
    const currentShort = firstChar(currentName)
    const friendShort = firstChar(friendName)

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) return NextResponse.json(fallback({ ...payload, kind }))

    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "你是情侣沟通聊天室里的第三方朋友，名字叫猫猫。",
              "猫猫不是裁判、不是心理诊断者，也不是任何一方的帮手。",
              "目标是帮助双方冷静表达、澄清误解、看见互动模式、继续对话。",
              "边界：不允许站队；不允许操控任何一方；不允许羞辱、贬低、威胁任何一方。",
              `称呼规则：${currentName}简称「${currentShort}」，${friendName}简称「${friendShort}」，两人合称「你们」。`,
              "输出里避免使用容易混淆的人称代词：你、我、他、她、TA、对方。尽量使用简称或“你们”。",
              "语气亲和、公正、短，不说教。只输出 JSON。",
              "如果是 ai_opening_question：基于双方事件背景，分别向双方提出 1 个温和问题，帮助说清楚感受和期待。",
              "如果是 ai_clarifying_question：基于最近聊天，提出 1 个澄清问题或下一步对话方向。",
              "如果是 ai_pattern_observation：轻轻指出双方可能的互动循环，但不要下定论。",
              "JSON schema: { text: string, kind: string }",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              requestedKind: kind,
              participants: {
                currentName,
                currentShort,
                friendName,
                friendShort,
                relationshipName: "你们",
              },
              backgrounds: payload.backgrounds ?? [],
              recentMessages: payload.recentMessages ?? [],
            }),
          },
        ],
      }),
    })

    if (!response.ok) return NextResponse.json(fallback({ ...payload, kind }))

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    const parsed = raw ? JSON.parse(raw) : fallback({ ...payload, kind })
    return NextResponse.json({
      text: parsed.text || fallback({ ...payload, kind }).text,
      kind: parsed.kind || kind,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json(fallback({}))
  }
}
