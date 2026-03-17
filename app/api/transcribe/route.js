import { NextResponse } from 'next/server';

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
const BASE = 'https://api.assemblyai.com/v2';

// POST: upload audio to AssemblyAI and submit a transcription job
// Returns: { transcript_id }
export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!ASSEMBLYAI_KEY) {
      return NextResponse.json({ error: 'ASSEMBLYAI_API_KEY is not configured' }, { status: 500 });
    }

    // Step 1: upload the raw audio bytes to AssemblyAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const uploadRes = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_KEY,
        'content-type': 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`AssemblyAI upload failed (${uploadRes.status}): ${text}`);
    }

    const { upload_url } = await uploadRes.json();

    // Step 2: submit the transcription job with speaker diarization
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
