'use client';

import { useState, useCallback, useRef } from 'react';

// Format milliseconds → MM:SS
function msToTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Debounce helper
function useDebouncedCallback(fn, delay) {
  const timer = useRef(null);
  return useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

export default function TranscriptViewer({ transcript, onChange }) {
  const [utterances, setUtterances] = useState(
    () => (transcript?.utterances || []).map((u, i) => ({ ...u, _key: i }))
  );

  const debouncedOnChange = useDebouncedCallback(
    (updated) => onChange?.({ utterances: updated }),
    800
  );

  const updateText = useCallback(
    (index, newText) => {
      setUtterances((prev) => {
        const next = prev.map((u, i) => (i === index ? { ...u, text: newText } : u));
        debouncedOnChange(next);
        return next;
      });
    },
    [debouncedOnChange]
  );

  const updateSpeaker = useCallback(
    (index, newSpeaker) => {
      setUtterances((prev) => {
        const next = prev.map((u, i) => (i === index ? { ...u, speaker: newSpeaker } : u));
        debouncedOnChange(next);
        return next;
      });
    },
    [debouncedOnChange]
  );

  if (!utterances || utterances.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic px-1">
        No transcript available.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {utterances.map((u, index) => (
        <div key={u._key} className="flex gap-3 group">
          {/* Left column: speaker label + timestamp */}
          <div className="flex flex-col items-end gap-0.5 pt-0.5 flex-shrink-0 w-20">
            <input
              value={u.speaker ?? ''}
              onChange={(e) => updateSpeaker(index, e.target.value)}
              className="w-full text-[11px] font-semibold text-right bg-transparent border-none outline-none focus:bg-muted rounded px-1 py-0 text-primary/80 cursor-text"
              title="Click to rename speaker"
              spellCheck={false}
            />
            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
              {msToTime(u.start)}
            </span>
          </div>

          {/* Right column: editable transcript text */}
          <textarea
            value={u.text ?? ''}
            onChange={(e) => updateText(index, e.target.value)}
            rows={Math.max(1, Math.ceil((u.text?.length || 0) / 72))}
            className="flex-1 resize-none bg-transparent border-none outline-none focus:bg-muted/40 rounded px-2 py-0.5 leading-relaxed text-foreground placeholder:text-muted-foreground/50 cursor-text"
            spellCheck={true}
          />
        </div>
      ))}
    </div>
  );
}
