import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
const BASE = 'https://api.assemblyai.com/v2';

async function getUserFromRequest(supabase, request) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const { data: { user: u } } = await supabase.auth.getUser(auth.slice(7));
    if (u) return u;
  }
  return null;
}

// POST: upload audio to AssemblyAI and submit a transcription job
// Returns: { transcript_id }
export async function POST(request) {
  try {
    const supabase = createClient();
    const user = await getUserFromRequest(supabase, request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!ASSEMBLYAI_KEY) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY is not configured' }, { status: 500 });
    }

    // Accept JSON { upload_url } — client uploaded directly to AssemblyAI to bypass Vercel's 4.5MB limit
    const body = await request.json().catch(() => null);
    const upload_url = body?.upload_url;

    if (!upload_url) {
      return NextResponse.json({ error: 'Missing upload_url' }, { status: 400 });
    }

    // Submit the transcription job with speaker diarization
    const transcribeRes = await fetch(`${BASE}/transcript`, {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        speech_models: ['universal-2'],
      }),
    });

    if (!transcribeRes.ok) {
      const text = await transcribeRes.text();
      throw new Error(`AssemblyAI transcription submit failed (${transcribeRes.status}): ${text}`);
    }

    const { id } = await transcribeRes.json();
    return NextResponse.json({ transcript_id: id });
  } catch (error) {
    console.error('POST /api/transcribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: poll the status of a transcription job, OR list recent transcripts
// Query params:
//   id  — poll a specific transcript by ID
//   list=true — return up to 25 recent completed transcripts for the account
// Returns: { status, transcript? } or { transcripts: [{id, created, preview}] }
export async function GET(request) {
  try {
    const supabase = createClient();
    const user = await getUserFromRequest(supabase, request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const transcriptId = searchParams.get('id');

    // List mode: return recent completed transcripts (no id param needed)
    if (searchParams.get('list') === 'true') {
      const res = await fetch(`${BASE}/transcript?limit=25&status=completed`, {
        headers: { authorization: ASSEMBLYAI_KEY },
      });
      if (!res.ok) throw new Error(`AssemblyAI list failed (${res.status})`);
      const data = await res.json();
      const transcripts = (data.transcripts || []).map((t) => ({
        id: t.id,
        created: t.created, // ISO timestamp
        preview: t.text ? t.text.slice(0, 120) : '(no text)',
      }));
      return NextResponse.json({ transcripts });
    }

    if (!transcriptId) {
      return NextResponse.json({ error: 'Missing transcript id' }, { status: 400 });
    }

    const res = await fetch(`${BASE}/transcript/${transcriptId}`, {
      headers: { authorization: ASSEMBLYAI_KEY },
    });

    if (!res.ok) {
      throw new Error(`AssemblyAI poll failed (${res.status})`);
    }

    const data = await res.json();

    if (data.status === 'completed') {
      return NextResponse.json({
        status: 'completed',
        transcript: {
          // utterances contains speaker-labeled segments with timestamps
          utterances: (data.utterances || []).map((u) => ({
            speaker: u.speaker,
            start: u.start, // milliseconds
            end: u.end,
            text: u.text,
          })),
        },
      });
    }

    if (data.status === 'error') {
      return NextResponse.json({ status: 'error', error: data.error });
    }

    // queued | processing — tell the client to keep polling
    return NextResponse.json({ status: data.status });
  } catch (error) {
    console.error('GET /api/transcribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
