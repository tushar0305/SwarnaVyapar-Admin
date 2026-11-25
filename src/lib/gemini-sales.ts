/**
 * Gemini sales-script generator for discovered jewellery leads.
 * Server-only — uses GEMINI_API_KEY (Google AI Studio / Generative Language API).
 */

import type { CompetitorSignal } from '@/lib/competitor-scan';

export type AiSalesScripts = {
  whatsappIntro: string;
  callScript: string;
  followUp: string;
  talkingPoints: string[];
  model: string;
};

export type AiSalesContext = {
  businessName: string;
  city: string;
  neighbourhood: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewsCount: number | null;
  score: number;
  scoreBand: string;
  scoreReasons: { points: number; text: string }[];
  digitalGap: boolean;
  suggestedPitch: string | null;
  isChain: boolean;
  competitorSignals: CompetitorSignal[];
};

function geminiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ''
  );
}

export function isGeminiConfigured(): boolean {
  return Boolean(geminiKey());
}

/** @deprecated Use isGeminiConfigured — kept for call-site renames. */
export function isOpenAiConfigured(): boolean {
  return isGeminiConfigured();
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export async function generateAiSalesScripts(
  ctx: AiSalesContext
): Promise<AiSalesScripts> {
  const apiKey = geminiKey();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to admin .env.local for AI sales scripts.'
    );
  }

  const model = process.env.GEMINI_SALES_MODEL?.trim() || 'gemini-3.8-flash';

  const competitorBlock =
    ctx.competitorSignals.length > 0
      ? ctx.competitorSignals
          .map((s) => `- ${s.vendor}: evidence “${s.evidence}”`)
          .join('\n')
      : '- None found on public website (do NOT invent competitors)';

  const reasons = ctx.scoreReasons
    .slice(0, 8)
    .map((r) => `${r.points > 0 ? '+' : ''}${r.points}: ${r.text}`)
    .join('\n');

  const system = `You are a SwarnaVyapar sales coach for jewellery shop outreach in India.
Write practical Hinglish (Hindi in Latin script + light English) for a founder calling/WhatsApping a jeweller.
Rules:
- Never claim the shop uses a software product unless listed under competitor evidence.
- Never invent emails, GSTIN, or owner names.
- Keep WhatsApp under 420 characters.
- Call script: 5-7 short spoken lines.
- Follow-up: one short WhatsApp nudge.
- Talking points: 3 bullets, specific to THIS shop's public signals.
- Push SwarnaVyapar for billing, stock, catalogue, WhatsApp sharing — match suggested pitch when sensible.
- Independent shops with digital gap = strongest ICP; chains = polite low priority.
Return ONLY valid JSON with keys: whatsappIntro, callScript, followUp, talkingPoints (array of strings).`;

  const user = `Prospect:
Name: ${ctx.businessName}
City: ${ctx.city}
Area: ${ctx.neighbourhood || 'n/a'}
Address: ${ctx.address || 'n/a'}
Phone: ${ctx.phone || 'missing'}
Website: ${ctx.website || 'none'}
Rating/reviews: ${ctx.rating ?? 'n/a'} / ${ctx.reviewsCount ?? 0}
Score: ${ctx.score} (${ctx.scoreBand})
Digital gap: ${ctx.digitalGap ? 'yes' : 'no'}
Chain heuristic: ${ctx.isChain ? 'yes' : 'no'}
Suggested pitch: ${ctx.suggestedPitch || 'n/a'}
Score reasons:
${reasons || 'n/a'}
Competitor evidence:
${competitorBlock}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${system}\n\n${user}` }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Gemini request failed (${res.status})${body ? `: ${body.slice(0, 240)}` : ''}`
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const raw =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
    '{}';

  let parsed: {
    whatsappIntro?: string;
    callScript?: string;
    followUp?: string;
    talkingPoints?: string[];
  };
  try {
    parsed = JSON.parse(extractJsonObject(raw)) as typeof parsed;
  } catch {
    throw new Error('AI returned invalid JSON for sales scripts');
  }

  const whatsappIntro = (parsed.whatsappIntro || '').trim();
  const callScript = (parsed.callScript || '').trim();
  const followUp = (parsed.followUp || '').trim();
  const talkingPoints = Array.isArray(parsed.talkingPoints)
    ? parsed.talkingPoints.map((t) => String(t).trim()).filter(Boolean).slice(0, 5)
    : [];

  if (!whatsappIntro || !callScript || !followUp) {
    throw new Error('AI response missing required script fields');
  }

  return {
    whatsappIntro: whatsappIntro.slice(0, 800),
    callScript: callScript.slice(0, 2000),
    followUp: followUp.slice(0, 600),
    talkingPoints,
    model,
  };
}
