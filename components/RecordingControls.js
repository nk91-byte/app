'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Square, Pause, Play, Loader2, AlertCircle, RotateCcw, Upload } from 'lucide-react';
import { useRecorder } from '@/hooks/useRecorder';
import { toast } from 'sonner';

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

  // Step 2: Submit transcription job via our server (keeps job-submission logic server-side)
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

export default function RecordingControls({ onTranscriptReady }) {
  const { recorderState, start, pause, resume, stop, cancel } = useRecorder();
  const [status, setStatus] = useState('idle'); // idle | recording | paused | transcribing | error
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Drive elapsed timer off recorderState
  useEffect(() => {
    if (recorderState === 'recording') {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recorderState]);

  const handleStart = useCallback(
    async (withTab = false) => {
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
    },
    [start]
  );

  const handlePause = useCallback(() => {
    pause();
    setStatus('paused');
  }, [pause]);

  const handleResume = useCallback(() => {
    resume();
    setStatus('recording');
  }, [resume]);

  const handleStop = useCallback(async () => {
    setStatus('transcribing');
    try {
      const blob = await stop();
      if (!blob || blob.size === 0) throw new Error('Recording is empty');

      const transcript = await submitAndPoll(blob);
      setStatus('idle');
      setElapsed(0);
      onTranscriptReady(transcript);
      toast.success('Transcript ready');
    } catch (err) {
      setStatus('error');
      setError(err.message);
      toast.error('Transcription failed');
    }
  }, [stop, onTranscriptReady]);

  const handleCancel = useCallback(() => {
    cancel();
    setStatus('idle');
    setElapsed(0);
    setError(null);
  }, [cancel]);

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = ''; // reset so same file can be re-selected
      setShowMenu(false);
      setStatus('transcribing');
      setError(null);
      try {
        const transcript = await submitAndPoll(file);
        setStatus('idle');
        onTranscriptReady(transcript);
        toast.success('Transcript ready');
      } catch (err) {
        setStatus('error');
        setError(err.message);
        toast.error('Transcription failed');
      }
    },
    [onTranscriptReady]
  );

  // ── Error ──────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="flex items-center gap-1">
        <AlertCircle size={13} className="text-destructive flex-shrink-0" />
        <span className="text-[11px] text-destructive max-w-[110px] truncate" title={error}>
          {error}
        </span>
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
          <button
            onClick={handleResume}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Resume recording"
          >
            <Play size={13} />
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Pause recording"
          >
            <Pause size={13} />
          </button>
        )}

        <button
          onClick={handleStop}
          className="p-1 rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          title="Stop & transcribe"
        >
          <Square size={13} />
        </button>

        <button
          onClick={handleCancel}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-[11px] leading-none"
          title="Cancel recording"
        >
          ✕
        </button>
      </div>
    );
  }

  // ── Idle: mic button + mode menu ───────────────────────────────────────────
  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
      />

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
            <button
              onClick={() => handleStart(false)}
              className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Mic size={12} className="flex-shrink-0" />
              Mic only
            </button>
            <button
              onClick={() => handleStart(true)}
              className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Mic size={12} className="flex-shrink-0" />
              Mic + meeting audio
            </button>
            <div className="border-t my-1" />
            <button
              onClick={() => { setShowMenu(false); fileInputRef.current?.click(); }}
              className="w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Upload size={12} className="flex-shrink-0" />
              Upload audio / video file
            </button>
          </div>
        </>
      )}
    </div>
  );
}
