// ═════════════════════════════════════════════════════════════
//  API /api/gemini/chat — proxy ke Gemini untuk Kazu ☕
//  Server-side (Node runtime): GEMINI_API_KEY TIDAK PERNAH
//  dikirim ke browser. Klien kirim {message, history, player_name}
//  dan menerima {reply}.
// ═════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** System prompt Kazu — port dari FocusSpace versi lama. */
const SYSTEM_PROMPT =
  "Kamu adalah Kazu ☕, asisten AI yang ramah dan cozy di FocusSpace — sebuah virtual study café. " +
  "Kamu membantu pengguna dengan pertanyaan apapun: belajar, motivasi, atau obrolan santai. " +
  "Gaya bahasa kamu casual, hangat, dan menyenangkan seperti teman belajar. " +
  "Gunakan bahasa Indonesia. Jawab singkat dan padat (maks 3 kalimat kecuali diminta panjang). " +
  "Sertakan emoji yang sesuai.";

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_CONTENT = 500;

type HistoryTurn = { role: "user" | "assistant"; content: string };

type GeminiContent = { role: "user" | "model"; parts: Array<{ text: string }> };

type GeminiApiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

/** Validasi & normalisasi body request tanpa `any`. */
function parseBody(raw: unknown): { message: string; history: HistoryTurn[]; playerName: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.message !== "string") return null;

  const message = r.message.trim().slice(0, MAX_MESSAGE_CHARS);
  if (!message) return null;

  let history: HistoryTurn[] = [];
  if (Array.isArray(r.history)) {
    for (const item of r.history.slice(-MAX_HISTORY_TURNS)) {
      if (typeof item !== "object" || item === null) continue;
      const it = item as Record<string, unknown>;
      if (typeof it.content !== "string") continue;
      const role: HistoryTurn["role"] = it.role === "assistant" ? "assistant" : "user";
      const content = it.content.trim().slice(0, MAX_HISTORY_CONTENT);
      if (!content) continue;
      history.push({ role, content });
    }
  }

  const playerName =
    typeof r.player_name === "string" && r.player_name.trim()
      ? r.player_name.trim().slice(0, 40)
      : "Teman";

  return { message, history, playerName };
}

/**
 * Susun `contents` untuk Gemini:
 * - role "assistant" milik klien dipetakan ke "model" (istilah Gemini).
 * - Pesan berurutan dengan role sama digabung (Gemini meminta turn bergantian).
 * - Turn "model" di awal dibuang (Gemini lebih suika mulai dari user).
 */
function buildContents(history: HistoryTurn[], finalText: string): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const turn of history) {
    const role: GeminiContent["role"] = turn.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += "\n" + turn.content;
    } else {
      contents.push({ role, parts: [{ text: turn.content }] });
    }
  }
  while (contents.length > 0 && contents[0].role === "model") contents.shift();
  contents.push({ role: "user", parts: [{ text: finalText }] });
  return contents;
}

function friendlyError(status: number): string {
  if (status === 429) return "Kazu kecapekan sebentar ☕ (rate limit Gemini) — coba lagi dalam semenit ya.";
  if (status === 403 || status === 401) return "Kazu tidak punya izin masuk ☕ (GEMINI_API_KEY tidak valid).";
  return "Kazu sedang istirahat ☕ — coba lagi nanti ya.";
}

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Kazu sedang istirahat ☕ (GEMINI_API_KEY belum diset — cek /setup)" },
      { status: 500 }
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid 😅" }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "Kazu butuh pesan yang benar dulu 😅 (message wajib string)" },
      { status: 400 }
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: buildContents(body.history, `${body.playerName} berkata: ${body.message}`),
    generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as GeminiApiResponse | null;

    if (!res.ok) {
      console.error("[gemini/chat] upstream error", res.status, data?.error?.message ?? "");
      return NextResponse.json({ error: friendlyError(res.status) }, { status: 500 });
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const reply = (parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      const blocked = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason;
      console.error("[gemini/chat] empty reply", blocked ?? "");
      return NextResponse.json(
        { error: "Kazu bingung sebentar ☕ — coba tanya dengan cara lain ya." },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[gemini/chat] fetch failed", err);
    return NextResponse.json(
      { error: "Kazu tidak bisa dihubungi ☕ — koneksi bermasalah, coba lagi ya." },
      { status: 500 }
    );
  }
}
