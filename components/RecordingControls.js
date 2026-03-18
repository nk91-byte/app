'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Pause, Play, Loader2, AlertCircle, RotateCcw, Upload, History } from 'lucide-react';
import { useRecorder } from '@/hooks/useRecorder';
import { toast } from 'sonner';
import { saveAudio, getAudio, deleteAudio } from '@/lib/audioStore';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function submitAndPoll(blob) {
  // Step 1: Upload audio directly from browser to AssemblyAI (bypasses Vercel's 4.5MB limit)
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      authorization: process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY,
      'content-type': 'application/octet-stream',
    },
    body: blob,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload failed (${uploadRes.status}): ${text}`);
  }
  const { upload_url } = await uploadRes.json();

  // Step 2: Submit transcription job via our server
  const submitRes = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ upload_url }),
  });
  if (!submitRes.ok) {
    const err = await submitRes.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit transcription job');
  }
  const { transcript_id } = await submitRes.json();

  // Poll every 3 seconds until completed or error
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`/api/transcribe?id=${transcript_id}`);
    const pollData = await pollRes.json();

    if (pollData.status === 'completed') {
      return pollData.transcript;
    }
    if (pollData.status === 'error') {
      throw new Error(pollData.error || 'Transcription failed');
    }
    // queued | processing — keep looping
  }
}

export default function RecordingControls({ noteId, onTranscriptReady }) {
  const { recorderState, start, pause, resume, stop, cancel } = useRecorder();
  const [status, setStatus] = useState('idle'); // idle | recording | paused | transcribing | error
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [hasSavedAudio, setHasSavedAudio] = useState(false);
  const [showPastTranscripts, setShowPastTranscripts] = useState(false);
  const [pastTranscripts, setPastTranscripts] = useState(null); // null = not loaded
  const [loadingPast, setLoadingPast] = useState(false);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check if there's a saved audio blob for this note (from a previous failed transcription)
  useEffect(() => {
    if (!noteId) return;
    getAudio(noteId).then(blob => setHasSavedAudio(!!blob)).catch(() => {});
  }, [noteId]);

  // Drive elapsed timer off recorderState
  useEffect(() => {
    if (recorderState === 'recording') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recorderState]);

  const runTranscription = useCallback(async (blob) => {
    try {
      const transcript = await submitAndPoll(blob);
      // Success — delete saved audio if any
      if (noteId) await deleteAudio(noteId).catch(() => {});
      setHasSavedAudio(false);
      setStatus('idle');
      setElapsed(0);
      onTranscriptReady(transcript);
      toast.success('Transcript ready');
    } catch (err) {
      // Save blob so user can retry without re-recording
      if (noteId && blob) {
        await saveAudio(noteId, blob).catch(() => {});
        setHasSavedAudio(true);
      }
      setStatus('error');
      setError(err.message);
      toast.error('Transcription failed — audio saved for retry');
    }
  }, [noteId, onTranscriptReady]);

  const handleStart = useCallback(async (withTab = false) => {
    setShowMenu(false);
    try {
      await start(withTab);
      setStatus('recording');
      setElapsed(0);
      setError(null);
    } catch (err) {
      setError(err.message || 'Could not access microphone');
      setStatus('error');
    }
  }, [start]);

  const handlePause = useCallback(() => { pause(); setStatus('paused'); }, [pause]);
  const handleResume = useCallback(() => { resume(); setStatus('recording'); }, [resume]);

  const handleStop = useCallback(async () => {
    setStatus('transcribing');
    const blob = await stop();
    if (!blob || blob.size === 0) {
      setStatus('error');
      setError('Recording is empty');
      return;
    }
    await runTranscription(blob);
  }, [stop, runTranscription]);

  const handleRetryFromSaved = useCallback(async () => {
    if (!noteId) return;
    const blob = await getAudio(noteId).catch(() => null);
    if (!blob) { setHasSavedAudio(false); return; }
    setStatus('transcribing');
    setError(null);
    await runTranscription(blob);
  }, [noteId, runTranscription]);

  const handleCancel = useCallback(() => {
    cancel();
    setStatus('idle');
    setElapsed(0);
    setError(null);
  }, [cancel]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setShowMenu(false);
    setStatus('transcribing');
    setError(null);
    await runTranscription(file);
  }, [runTranscription]);

  const handleOpenPastTranscripts = useCallback(async () => {
    setShowMenu(false);
    setShowPastTranscripts(true);
    if (pastTranscripts !== null) return; // already loaded
    setLoadingPast(true);
    try {
      const res = await fetch('/api/notes?has_transcript=true&limit=25');
      const data = await res.json();
      // Exclude current note; keep only notes with utterances
      const notes = (data.data || []).filter(n =>
        n.id !== noteId && n.transcript?.utterances?.length > 0
      );
      setPastTranscripts(notes);
    } catch {
      setPastTranscripts([]);
      toast.error('Could not load past transcripts');
    } finally {
      setLoadingPast(false);
    }
  }, [pastTranscripts, noteId]);

  const handleSelectPastTranscript = useCallback((note) => {
    setShowPastTranscripts(false);
    onTranscriptReady(note.transcript);
    toast.success('Transcript loaded');
  }, [onTranscriptReady]);

  // ── Error ──────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1">
        <AlertCircle size={13} className="text-destructive flex-shrink-0" />
        <span className="text-[11px] text-destructive max-w-[110px] truncate" title={error}>
          {error}
        </span>
        {hasSavedAudio && (
          <button
            onClick={handleRetryFromSaved}
            className="p-1 rounded-md text-[11px] px-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
            title="Retry transcription with saved audio"
          >
            Retry
          </button>
        )}
        <button
          onClick={() => { setStatus('idle'); setError(null); }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Dismiss"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    );
  }

  // ── Transcribing ───────────────────────────────────────────────────────────
  if (status === 'transcribing') {
    return (
      <div className="flex items-center gap-1.5">
        <Loader2 size={13} className="animate-spin text-primary" />
        <span className="text-[11px] text-muted-foreground">Transcribing…</span>
      </div>
    );
  }

  // ── Recording / Paused ─────────────────────────────────────────────────────
  if (status === 'recording' || status === 'paused') {
    return (
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground select-none">
          {status === 'recording'
            ? <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            : <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          {formatTime(elapsed)}
        </span>

        {status === 'paused' ? (
          <button onClick={handleResume} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Resume recording">
            <Play size={13} />
          </button>
        ) : (
          <button onClick={handlePause} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Pause recording">
            <Pause size={13} />
          </button>
        )}

        <button onClick={handleStop} className="p-1 rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Stop & transcribe">
          <Square size={13} />
        </button>

        <button onClick={handleCancel} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[11px] leading-none" title="Cancel recording">
          ✕
        </button>
      </div>
    );
  }

  // ── Idle: mic button + saved audio indicator + mode menu ───────────────────
  return (
    <div className="relative flex items-center gap-1">
      <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileUpload} />

      {hasSavedAudio && (
        <button
          onClick={handleRetryFromSaved}
          className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors font-medium"
          title="Retry transcription with saved audio from previous failed attempt"
        >
          Retry audio
        </button>
      )}

      <button
        onClick={() => setShowMenu((v) => !v)}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Record meeting"
      >
        <Mic size={14} />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-7 z-50 bg-popover border rounded-lg shadow-lg py-1 w-48 text-xs">
            <button onClick={() => handleStart(false)} className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-2">
              <Mic size={12} className="flex-shrink-0" />
              Mic only
            </button>
            <button onClick={() => handleStart(true)} className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-2">
              <Mic size={12} className="flex-shrink-0" />
              Mic + meeting audio
            </button>
            <div className="border-t my-1" />
            <button onClick={() => { setShowMenu(false); fileInputRef.current?.click(); }} className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-2">
              <Upload size={12} className="flex-shrink-0" />
              Upload audio / video file
            </button>
            <button onClick={handleOpenPastTranscripts} className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-2">
              <History size={12} className="flex-shrink-0" />
              Use past transcript
            </button>
          </div>
        </>
      )}

      {showPastTranscripts && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPastTranscripts(false)} />
          <div className="absolute right-0 top-7 z-50 bg-popover border rounded-lg shadow-lg py-1 w-72 text-xs max-h-64 overflow-y-auto">
            <div className="px-3 py-1.5 font-medium text-muted-foreground border-b">Past transcripts</div>
            {loadingPast && (
              <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> Loading…
              </div>
            )}
            {!loadingPast && pastTranscripts?.length === 0 && (
              <div className="px-3 py-2 text-muted-foreground">No past transcripts found</div>
            )}
            {!loadingPast && pastTranscripts?.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelectPastTranscript(note)}
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-0"
              >
                <div className="font-medium truncate">{note.title || 'Untitled'}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(note.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
