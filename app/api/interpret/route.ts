import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateGuessOptions, generateInterpretation, generateReceiverHint } from "@/lib/storage"

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

function fallback(text: string) {
  return {
    interpretation: generateInterpretation(text),
    receiverHint: generateReceiverHint(text),
    guessOptions: generateGuessOptions(),
  }
}

async function assertAuthenticated(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anonKey) return

  const supabase = createClient(url, anonKey)
  const { error } = await supabase.auth.getUser(token)
  if (error) {
    throw new Error("Unauthorized")
  }
}

export async function POST(request: NextRequest) {
  try {
    await assertAuthenticated(request)
    const { text, context } = (await request.json()) as { text?: string; context?: unknown }
    if (!text?.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallback(text))
    }

    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是情侣沟通辅助产品里的 AI 翻译小天使。你不是裁判，不评价对错，不粉饰矛盾。请把输入的一句话解读为更容易被对方理解的情绪和需求。必须只输出 JSON。",
          },
          {
            role: "user",
            content: JSON.stringify({
              message: text,
              context,
              outputSchema: {
                interpretation: "string",
                receiverHint: "string",
                guessOptions: [{ id: "string", text: "string", checked: false }],
              },
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json(fallback(text))
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    const parsed = raw ? JSON.parse(raw) : fallback(text)
    return NextResponse.json({
      interpretation: parsed.interpretation || fallback(text).interpretation,
      receiverHint: parsed.receiverHint || fallback(text).receiverHint,
      guessOptions: Array.isArray(parsed.guessOptions) ? parsed.guessOptions : fallback(text).guessOptions,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "AI interpretation failed" }, { status: 500 })
  }
}
