import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateGuessOptions, generateInterpretation, generateReceiverHint } from "@/lib/storage"

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

type InterpretContext = {
  participants?: {
    senderName?: string
    senderShortName?: string
    receiverName?: string
    receiverShortName?: string
    relationshipName?: string
  }
}

function normalizeByParticipants(text: string, context?: InterpretContext) {
  const participants = context?.participants
  const senderShortName = participants?.senderShortName || "发送方"
  const receiverShortName = participants?.receiverShortName || "接收方"
  const relationshipName = participants?.relationshipName || "你们"
  return text
    .replaceAll("TA", senderShortName)
    .replaceAll("对方", receiverShortName)
    .replaceAll("你们", relationshipName)
    .replaceAll("你", receiverShortName)
    .replaceAll("我", senderShortName)
}

function fallback(text: string, context?: InterpretContext) {
  return {
    interpretation: normalizeByParticipants(generateInterpretation(text), context),
    receiverHint: normalizeByParticipants(generateReceiverHint(text), context),
    guessOptions: generateGuessOptions().map((option) => ({
      ...option,
      text: normalizeByParticipants(option.text, context),
    })),
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
    const { text, context } = (await request.json()) as { text?: string; context?: InterpretContext }
    if (!text?.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json(fallback(text, context))
    }

    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat"
    const participants = context?.participants
    const senderShortName = participants?.senderShortName || "发送方"
    const receiverShortName = participants?.receiverShortName || "接收方"
    const relationshipName = participants?.relationshipName || "你们"
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
            content: [
              "你是情侣沟通辅助产品里的 AI 朋友，名字叫猫猫。你不是裁判，不评价对错，不粉饰矛盾。",
              "请把输入的一句话解读为更容易被对方理解的情绪和需求。必须只输出 JSON。",
              `人称规则：发送方简称为「${senderShortName}」，接收方简称为「${receiverShortName}」，两个人合称为「${relationshipName}」。`,
              "不要使用容易混淆的人称代词：你、我、他、她、TA、对方。除非原句直接引用，否则输出字段里都用上面的简称或合称。",
              "interpretation 用一句自然的话说明这句话背后的情绪和需求。",
              "receiverHint 面向接收方，但也不要写“你”，要用接收方简称。",
              "guessOptions 是发送方可能想表达的内心话，仍然避免你/我/他/TA，使用发送方简称或关系合称。",
            ].join("\n"),
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
      return NextResponse.json(fallback(text, context))
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    const parsed = raw ? JSON.parse(raw) : fallback(text, context)
    return NextResponse.json({
      interpretation: parsed.interpretation || fallback(text, context).interpretation,
      receiverHint: parsed.receiverHint || fallback(text, context).receiverHint,
      guessOptions: Array.isArray(parsed.guessOptions) ? parsed.guessOptions : fallback(text, context).guessOptions,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "AI interpretation failed" }, { status: 500 })
  }
}
