'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Tag, Calendar, Zap, Check } from 'lucide-react';

const TAG_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#6B7280', '#14b8a6', '#f97316'];

export default function QuickAddModal({
    isOpen,
    onClose,
    createTodo,
    projectTags,
    NoteEditor,
    createProjectTag,
}) {
    const [title, setTitle] = useState('');
    const [selectedTags, setSelectedTags] = useState([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(null);
    const [dueDate, setDueDate] = useState('');
    const [content, setContent] = useState(null);
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);
    const titleRef = useRef(null);
    const tagPickerRef = useRef(null);
    const dueDatePickerRef = useRef(null);
    const modalRef = useRef(null);

    // Focus title on open
    useEffect(() => {
        if (isOpen) {
            setTitle('');
            setSelectedTags([]);
            setDueDate('');
            setContent(null);
            setTimeout(() => titleRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Close tag picker when clicking outside
    useEffect(() => {
        if (!showTagPicker) return;
        const handler = (e) => {
            if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) {
                setShowTagPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showTagPicker]);

    const toggleTag = (tagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
    };

    const handleSubmit = async () => {
        if (!title.trim()) return;
        const options = {};
        if (dueDate) options.due_date = new Date(dueDate).toISOString();
        if (content) options.content = content;
        await createTodo(title.trim(), null, selectedTags, options);
        onClose();
    };

    const handleContentUpdate = useCallback((json) => {
        setContent(json);
    }, []);

    if (!isOpen) return null;

    const dueDays = dueDate ? (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
        return Math.round((due - today) / (1000 * 60 * 60 * 24));
    })() : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Modal */}
            <div
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[560px] bg-background rounded-xl shadow-2xl border border-border/50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
            >
                {/* Header bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                    <Zap size={14} className="text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Add Action</span>
                    <div className="flex-1" />
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">⌥K</span>
                    <button onClick={onClose} className="p-0.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground">
                        <X size={14} />
                    </button>
                </div>

                {/* Title input */}
                <div className="px-4 pt-3 pb-2">
                    <input
                        ref={titleRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && title.trim()) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder="What needs to be done?"
                        className="w-full text-lg font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                        autoComplete="off"
                    />
                </div>

                {/* Metadata row: tags + due date */}
                <div className="flex items-center gap-2 px-4 pb-2 flex-wrap">
                    {/* Selected tags */}
                    {selectedTags.map(tagId => {
                        const tag = projectTags.find(t => t.id === tagId);
                        if (!tag) return null;
                        return (
                            <span
                                key={tag.id}
                                className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:opacity-70"
                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                onClick={() => toggleTag(tag.id)}
                            >
                                {tag.name}
                                <X size={10} />
                            </span>
                        );
                    })}

                    {/* Add tag button */}
                    <div className="relative" ref={tagPickerRef}>
                        <button
                            onClick={() => setShowTagPicker(!showTagPicker)}
                            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed transition-colors ${showTagPicker ? 'border-primary text-primary bg-primary/5' : 'border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary'
                                }`}
                        >
                            <Tag size={10} />
                            Project
                        </button>
                        {showTagPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px] z-10">
                                <div className="px-2 py-1.5 border-b">
                                    <input
                                        type="text"
                                        value={newTagName}
                                        onChange={e => setNewTagName(e.target.value)}
                                        onKeyDown={async e => {
                                            if (e.key === 'Enter' && newTagName.trim() && createProjectTag) {
                                                const tag = await createProjectTag(newTagName, newTagColor);
                                                if (tag) { setSelectedTags(prev => [...prev, tag.id]); }
                                                setNewTagName('');
                                                setNewTagColor(null);
                                            }
                                        }}
                                        placeholder="New tag..."
                                        className="flex-1 text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring w-full"
                                        autoFocus
                                    />
                                    {newTagName.trim() && (
                                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                            {TAG_COLORS.map(c => (
                                                <button key={c} onClick={() => setNewTagColor(c)} className={`w-4 h-4 rounded-full border-2 transition-transform ${newTagColor === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {projectTags.map(tag => {
                                    const isSelected = selectedTags.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTag(tag.id)}
                                            className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-muted transition-colors"
                                        >
                                            <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                                                {isSelected && <Check size={8} />}
                                            </div>
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                            <span className="truncate">{tag.name}</span>
                                        </button>
                                    );
                                })}
                                {projectTags.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground italic">No projects</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Due date */}
                    <div className="relative" ref={dueDatePickerRef}>
                        <button
                            onClick={() => setShowDueDatePicker(!showDueDatePicker)}
                            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed transition-colors ${dueDate ? 'border-primary/30 text-foreground bg-primary/5' : 'border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary'
                                }`}
                        >
                            <Calendar size={10} />
                            {dueDate ? (
                                <span className="flex items-center gap-1">
                                    {new Date(dueDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    {dueDays !== null && (
                                        <span className={`ml-0.5 px-1 rounded text-[9px] font-medium ${dueDays < 0 ? 'bg-red-100 text-red-600' : dueDays === 0 ? 'bg-orange-100 text-orange-600' : dueDays === 1 ? 'bg-yellow-100 text-yellow-600' : 'bg-muted text-muted-foreground'
                                            }`}>
                                            {dueDays > 0 ? `+${dueDays}` : dueDays}d
                                        </span>
                                    )}
                                </span>
                            ) : 'Due date'}
                            {dueDate && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDueDate(''); setShowDueDatePicker(false); }}
                                    className="ml-0.5 p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                >
                                    <X size={8} />
                                </button>
                            )}
                        </button>
                        {showDueDatePicker && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowDueDatePicker(false)} />
                                <div className="absolute top-full left-0 mt-1 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px] z-50" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => { setDueDate(new Date().toISOString().split('T')[0]); setShowDueDatePicker(false); }}
                                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                                    >Today</button>
                                    <button
                                        onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); setDueDate(d.toISOString().split('T')[0]); setShowDueDatePicker(false); }}
                                        className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                                    >Tomorrow</button>
                                    <div className="border-t my-1" />
                                    <div className="px-3 py-1.5">
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => { setDueDate(e.target.value); if (e.target.value) setShowDueDatePicker(false); }}
                                            className="w-full text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                                        />
                                    </div>
                                    {dueDate && (
                                        <>
                                            <div className="border-t my-1" />
                                            <button
                                                onClick={() => { setDueDate(''); setShowDueDatePicker(false); }}
                                                className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted transition-colors"
                                            >Clear due date</button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Rich text editor */}
                <div className="px-4 pb-2">
                    <div className="border rounded-lg overflow-hidden bg-muted/20">
                        <div className="max-h-[200px] overflow-y-auto p-3">
                            <NoteEditor
                                key={`quickadd-${isOpen ? 'open' : 'closed'}`}
                                id="quick-add-new"
                                content={null}
                                onUpdate={handleContentUpdate}
                                placeholder="Add details, sub-tasks, or notes..."
                                toolbarAlwaysVisible={false}
                                projectTags={projectTags}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer with submit */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20">
                    <span className="text-[10px] text-muted-foreground">
                        Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> to save
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={!title.trim()}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${title.trim()
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                            }`}
                    >
                        Add Action
                    </button>
                </div>
            </div>
        </div>
    );
}
