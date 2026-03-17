import { NextResponse } from 'next/server';

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
const BASE = 'https://api.assemblyai.com/v2';

// POST: upload audio to AssemblyAI and submit a transcription job
// Returns: { transcript_id }
export async function POST(request) {
  try {
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

// GET: poll the status of a transcription job
// Query param: id (the transcript_id from POST)
// Returns: { status: 'queued'|'processing'|'completed'|'error', transcript?, error? }
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const transcriptId = searchParams.get('id');

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
