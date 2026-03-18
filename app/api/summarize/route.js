import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60; // seconds — needed for Vercel Hobby plan

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 });
    }

    const { transcript } = await request.json();
    if (!transcript?.utterances?.length) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    // Format transcript as readable text for Claude
    const transcriptText = transcript.utterances
      .map(u => `${u.speaker}: ${u.text}`)
      .join('\n');

    const params = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `You are a meeting assistant. Analyze meeting transcripts and extract structured information.
CRITICAL: Respond with ONLY a raw JSON object. No markdown code fences, no backticks, no explanation — start your response with { and end with }.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this meeting transcript and return a JSON object with exactly this structure:
{
  "sections": [
    { "title": "Section Title", "points": ["bullet point 1", "bullet point 2"] }
  ],
  "action_items": [
    { "id": "1", "text": "action item description", "speaker": "Speaker A" }
  ]
}

Rules:
- sections: 2-4 thematic sections covering the key topics, decisions, and context. Each section has a short descriptive title and 2-5 concise bullet points. Group related content together logically.
- action_items: only concrete commitments or tasks mentioned, with the speaker who committed to it
- If no clear action items exist, return an empty array
- Use the speaker labels from the transcript (e.g. "Speaker A", "Speaker B")
- Output raw JSON only — no markdown fences, no backticks, no preamble

Transcript:
${transcriptText}`,
        },
      ],
    };

    // Retry up to 3 times on 529 overloaded errors (with 10s delay between attempts)
    let response;
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await client.messages.create(params);
        break; // success — exit retry loop
      } catch (err) {
        lastError = err;
        const isOverloaded = err?.status === 529 || err?.message?.includes('overloaded');
        if (isOverloaded && attempt < 3) {
          await new Promise(r => setTimeout(r, 10000 * attempt)); // 10s, 20s
          continue;
        }
        throw err; // non-529 error or last attempt — give up
      }
    }

    // Strip markdown fences if model wrapped output anyway (e.g. ```json ... ```)
    let raw = response.content[0].text.trim();
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) raw = fenceMatch[1].trim();

    // Sanitize: fix literal control characters inside JSON strings
    // Only replaces chars inside quoted strings to avoid breaking whitespace between tokens
    const sanitize = (s) => {
      let out = '';
      let inString = false;
      let escaped = false;
      for (const ch of s) {
        if (escaped) { out += ch; escaped = false; continue; }
        if (ch === '\\' && inString) { out += ch; escaped = true; continue; }
        if (ch === '"') { inString = !inString; out += ch; continue; }
        if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
          out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : '\\t';
        } else {
          out += ch;
        }
      }
      return out;
    };

    // Trim to last '}' in case response was truncated mid-array
    const trimToLastBrace = (s) => {
      const last = s.lastIndexOf('}');
      return last >= 0 ? s.slice(0, last + 1) : s;
    };

    let parsed;
    const candidates = [raw, sanitize(raw), trimToLastBrace(raw), sanitize(trimToLastBrace(raw))];
    for (const candidate of candidates) {
      try { parsed = JSON.parse(candidate); break; } catch { /* try next */ }
    }
    if (!parsed) throw new Error('Could not parse Claude response as JSON');

    return NextResponse.json({
      sections: (parsed.sections || []).map(s => ({ title: s.title, points: s.points || [] })),
      action_items: (parsed.action_items || []).map((item, i) => ({
        id: item.id || String(i + 1),
        text: item.text,
        speaker: item.speaker || null,
        claimed: false,
      })),
    });
  } catch (error) {
    console.error('POST /api/summarize error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
