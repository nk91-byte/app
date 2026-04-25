'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';

export default function RecordingTitleModal({ isOpen, mode, onClose, onConfirm }) {
    const [title, setTitle] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const handleSubmit = () => {
        if (!title.trim()) return;
        onConfirm(title.trim());
    };

    if (!isOpen) return null;

    const modeLabel = mode === 'tab' ? 'Mic + Meeting Audio' : 'Mic Only';
    const shortcut = mode === 'tab' ? '⌥M' : '⌥R';

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[480px] bg-background rounded-xl shadow-2xl border border-border/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
            >
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                    <Mic size={14} className="text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Meeting Note</span>
                    <div className="flex-1" />
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{shortcut}</span>
                    <button onClick={onClose} className="p-0.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground">
                        <X size={14} />
                    </button>
                </div>

                {/* Input */}
                <div className="px-4 pt-3 pb-2">
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && title.trim()) { e.preventDefault(); handleSubmit(); }
                        }}
                        placeholder="Meeting title…"
                        className="w-full text-lg font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                        autoComplete="off"
                    />
                    <p className="text-[11px] text-muted-foreground/50 mt-1">{modeLabel}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t bg-muted/20">
                    <button
                        onClick={onClose}
                        className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!title.trim()}
                        className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                        <Mic size={11} />
                        Create Note
                    </button>
                </div>
            </div>
        </div>
    );
}
