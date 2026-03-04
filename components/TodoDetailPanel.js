import { Clock, Plus, Tag, Check, CheckSquare, X, PanelLeftClose, FileText, Type, ListTodo, Trash2, Save, Calendar as CalendarIcon, Maximize2, Minimize2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TextareaAutosize from 'react-textarea-autosize';
import React from 'react';
import DueDatePicker from './DueDatePicker';

// Using a simplified ErrorBoundary here directly since we are passing NoteEditor as a prop
// to avoid circular dependency issues, or we assume it's handled. We will wrap the Editor.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
        if (this.state.hasError) return <div className="p-4 text-xs text-red-500">Editor failed to load.</div>;
        return this.props.children;
    }
}

export default function TodoDetailPanel({
    editingTodoId,
    setEditingTodoId,
    todoTree,
    todos,
    formatDate,
    toggleTodoTag,
    todoTagPickerId,
    setTodoTagPickerId,
    projectTags,
    tagDropdownRef,
    updateTodo,
    editingTodoText,
    setEditingTodoText,
    setTodos,
    navigateToNote,
    todoToolbarOpen,
    setTodoToolbarOpen,
    showTodoActionItems,
    setShowTodoActionItems,
    extractActionItems,
    NoteEditor, // passed as prop to avoid huge dynamic import tree loops in this extracted file
    handleTodoContentUpdate,
    deleteTodo,
    createProjectTagInline,
    focusMode,
    setFocusMode,
}) {
    const [panelTagOpen, setPanelTagOpen] = React.useState(false);
    const [newProjectTagName, setNewProjectTagName] = React.useState('');
    const [newProjectTagColor, setNewProjectTagColor] = React.useState(null);
    const TAG_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#6B7280', '#14b8a6', '#f97316'];
    const t = todoTree.find(x => x.id === editingTodoId) || todos.find(x => x.id === editingTodoId);
    if (!t) return null;

    return (
        <div
            className={`${focusMode ? 'flex-1' : 'w-[35%] min-w-[350px]'} border-l bg-background flex flex-col h-full flex-shrink-0 min-h-0 transition-all duration-300`}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Panel Header: timestamp + tags + close */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <DueDatePicker
                        dueDate={t.due_date ? t.due_date.split('T')[0] : null}
                        recurrence={t.recurrence}
                        onChange={({ dueDate, recurrence }) => {
                            const updates = {};
                            if (dueDate !== undefined) {
                                updates.due_date = dueDate ? new Date(dueDate).toISOString() : null;
                            }
                            if (recurrence !== undefined) {
                                updates.recurrence = recurrence;
                            }
                            updateTodo(t.id, updates);
                        }}
                    />
                    {t.tags?.map(tag => (
                        <span
                            key={tag.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 flex-shrink-0"
                            style={{ backgroundColor: tag.color + '20', color: tag.color }}
                        >
                            {tag.name}
                            <button
                                onClick={() => toggleTodoTag(t.id, tag.id)}
                                className="hover:opacity-70"
                            >
                                <X size={9} />
                            </button>
                        </span>
                    ))}
                    <div className="relative" ref={tagDropdownRef}>
                        <button
                            onClick={() => { setPanelTagOpen(!panelTagOpen); }}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center gap-0.5 flex-shrink-0"
                        >
                            <Tag size={8} /> Tag
                        </button>
                        {panelTagOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setPanelTagOpen(false)} />
                                <div className="absolute right-0 top-6 z-50 w-48 bg-popover border rounded-lg shadow-lg py-1" onClick={e => e.stopPropagation()}>
                                    <div className="px-2 py-1.5 border-b">
                                        <input
                                            type="text"
                                            value={newProjectTagName}
                                            onChange={e => setNewProjectTagName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && newProjectTagName.trim()) { createProjectTagInline(t.id, newProjectTagName, newProjectTagColor); setNewProjectTagName(''); setNewProjectTagColor(null); } }}
                                            placeholder="New tag..."
                                            className="flex-1 text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring w-full"
                                            autoFocus
                                        />
                                        {newProjectTagName.trim() && (
                                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                                {TAG_COLORS.map(c => (
                                                    <button key={c} onClick={() => setNewProjectTagColor(c)} className={`w-4 h-4 rounded-full border-2 transition-transform ${newProjectTagColor === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="max-h-40 overflow-y-auto py-1">
                                        {projectTags.length === 0 && (
                                            <p className="text-xs text-muted-foreground px-3 py-2 italic">No project tags</p>
                                        )}
                                        {projectTags.map(tag => {
                                            const hasTag = (t.tags || []).some(x => x.id === tag.id);
                                            return (
                                                <button
                                                    key={tag.id}
                                                    onClick={() => toggleTodoTag(t.id, tag.id)}
                                                    className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-muted transition-colors"
                                                >
                                                    <div className={`w-3 h-3 rounded flex items-center justify-center border ${hasTag ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                                                        {hasTag && <Check size={8} />}
                                                    </div>
                                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                                    <span className="flex-1 truncate">{tag.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 flex-shrink-0 ml-2"
                    onClick={() => setFocusMode(!focusMode)}
                    title={focusMode ? "Exit focus mode" : "Focus mode"}
                >
                    {focusMode ? <Minimize2 size={14} className="text-muted-foreground" /> : <Maximize2 size={14} className="text-muted-foreground" />}
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 flex-shrink-0"
                    onClick={() => { setEditingTodoId(null); setFocusMode(false); }}
                >
                    <PanelLeftClose size={14} className="text-muted-foreground" />
                </Button>
            </div>

            {/* Title Row */}
            <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-2 flex-1">
                    <button
                        onClick={() => updateTodo(t.id, { is_done: !t.is_done })}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${t.is_done ? 'bg-muted border-muted-foreground/20 text-muted-foreground/50' : 'border-muted-foreground/40 hover:border-primary'}`}
                    >
                        {t.is_done && <CheckSquare size={12} />}
                    </button>
                    <TextareaAutosize
                        value={editingTodoText}
                        onChange={(e) => {
                            setEditingTodoText(e.target.value);
                            setTodos(prev => prev.map(todo => todo.id === t.id ? { ...todo, text: e.target.value } : todo));
                        }}
                        onBlur={() => {
                            if (editingTodoText !== t.text) updateTodo(t.id, { text: editingTodoText });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                updateTodo(t.id, { text: editingTodoText });
                                e.target.blur();
                            }
                        }}
                        className="text-sm font-semibold border-transparent px-0 focus-visible:ring-0 shadow-none -ml-1 text-foreground bg-transparent resize-none flex-1 min-w-0 leading-tight"
                        placeholder="Task title..."
                        maxRows={2}
                    />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {t.note_id && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigateToNote(t.note_id); }}
                            className="p-1 rounded-md transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Go to linked note"
                        >
                            <FileText size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setTodoToolbarOpen(!todoToolbarOpen)}
                        className={`p-1 rounded-md transition-colors flex-shrink-0 ${todoToolbarOpen
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                        title="Toggle Text Formatting"
                    >
                        <Type size={14} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowTodoActionItems(!showTodoActionItems)}
                        className={`p-1 rounded-md transition-colors flex-shrink-0 ${showTodoActionItems
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                        title="Toggle Sub-Action Items"
                    >
                        <ListTodo size={14} />
                    </button>
                </div>
            </div>

            {/* Sub Action Items Panel */}
            {(() => {
                if (!showTodoActionItems) return null;
                const actionItems = extractActionItems(t.content);
                if (actionItems.length === 0) {
                    return <div className="px-4 py-2 border-b bg-muted/10 flex-shrink-0"><p className="text-xs text-muted-foreground italic">No sub-action items found.</p></div>;
                }
                return (
                    <div className="px-4 py-2 border-b bg-muted/10 flex-shrink-0 max-h-40 overflow-y-auto">
                        <div className="space-y-1.5">
                            {actionItems.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-[13px] leading-tight group">
                                    <span className="mt-0.5 text-muted-foreground/70 pointer-events-none">
                                        {item.isChecked ? <CheckSquare size={13} className="text-muted-foreground/40" /> : <div className="w-[13px] h-[13px] border rounded-[3px] border-muted-foreground/50" />}
                                    </span>
                                    <span className={`flex-1 ${item.isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                        {item.text || 'Empty task'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Editor area */}
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 min-h-0">
                <ErrorBoundary>
                    <NoteEditor
                        key={`editor-${t.id}`}
                        id={t.id}
                        content={t.content}
                        onUpdate={(newContent) => {
                            setTodos(prev => prev.map(todo => todo.id === t.id ? { ...todo, content: newContent } : todo));
                            handleTodoContentUpdate(t.id, newContent);
                        }}
                        placeholder="Add details or sub-tasks..."
                        toolbarOpen={todoToolbarOpen}
                        onToolbarToggle={setTodoToolbarOpen}
                        projectTags={projectTags}
                    />
                </ErrorBoundary>
            </div>

            {/* Panel Footer */}
            <div className="px-4 py-2 border-t flex justify-between items-center flex-shrink-0 bg-muted/20">
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { deleteTodo(t.id); setEditingTodoId(null); setFocusMode(false); }}
                >
                    <Trash2 size={12} className="mr-1" /> Delete
                </Button>
                <Button
                    size="sm"
                    className="h-7 text-xs text-white hover:opacity-90"
                    style={{ backgroundColor: '#5BA89D' }}
                    onClick={() => { setEditingTodoId(null); setFocusMode(false); }}
                >
                    <Save size={12} className="mr-1" /> Done
                </Button>
            </div>
        </div>
    );
}
