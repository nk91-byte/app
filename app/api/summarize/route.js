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

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      system: `You are a meeting assistant. Analyze meeting transcripts and extract structured information.
Always respond with valid JSON only — no markdown, no explanation, just the JSON object.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this meeting transcript and return a JSON object with exactly this structure:
{
  "summary": "2-4 sentence summary of the key topics discussed and decisions made",
  "action_items": [
    { "id": "1", "text": "action item description", "speaker": "Speaker A" }
  ]
}

Rules:
- summary: concise, decision-focused, 2-4 sentences
- action_items: only concrete commitments or tasks mentioned, with the speaker who committed to it
- If no clear action items exist, return an empty array
- Use the speaker labels from the transcript (e.g. "Speaker A", "Speaker B")

Transcript:
${transcriptText}`,
        },
      ],
    });

    const raw = response.content[0].text.trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON if Claude wrapped it
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Could not parse Claude response as JSON');
    }

    return NextResponse.json({
      summary: parsed.summary || '',
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
