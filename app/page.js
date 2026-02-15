'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BookOpen, CheckSquare, Plus, Search, X, Tag, ChevronDown, ChevronRight,
  Trash2, Archive, ArchiveRestore, Edit3, Save, FileText, Clock, MoreHorizontal,
  Loader2, Palette, StickyNote, PanelLeftClose, PanelLeft
} from 'lucide-react';

const NoteEditor = dynamic(() => import('@/components/NoteEditor'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={16} />Loading editor...</div>,
});

const TAG_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getContentPreview(content) {
  if (!content || !content.content) return '';
  let text = '';
  function walk(node) {
    if (node.type === 'text') text += node.text;
    if (node.content) node.content.forEach(walk);
  }
  walk(content);
  return text.slice(0, 120);
}

export default function App() {
  const [view, setView] = useState('notebook');
  const [notes, setNotes] = useState([]);
  const [todos, setTodos] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [todoFilter, setTodoFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[4].value);
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [expandedTodos, setExpandedTodos] = useState(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const saveTimeoutRef = useRef(null);

  // ===== API HELPERS =====
  const api = useCallback(async (path, options = {}) => {
    const res = await fetch(`/api/${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error ${res.status}`);
    }
    return res.json();
  }, []);

  // ===== INIT =====
  useEffect(() => {
    async function init() {
      try {
        await api('db/setup', { method: 'POST' });
        setDbReady(true);
        await Promise.all([loadNotes(), loadTodos(), loadTags()]);
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ===== DATA LOADERS =====
  const loadNotes = useCallback(async (search, tag) => {
    try {
      const params = new URLSearchParams();
      if (search || searchQuery) params.set('search', search || searchQuery);
      if (tag || selectedTagId) params.set('tag', tag || selectedTagId);
      const data = await api(`notes?${params}`);
      setNotes(data);
    } catch (e) { console.error('Load notes error:', e); }
  }, [api, searchQuery, selectedTagId]);

  const loadTodos = useCallback(async (search, status, tag, archived) => {
    try {
      const params = new URLSearchParams();
      if (search || searchQuery) params.set('search', search || searchQuery);
      params.set('status', status || todoFilter);
      if (tag || selectedTagId) params.set('tag', tag || selectedTagId);
      params.set('show_archived', String(archived !== undefined ? archived : showArchived));
      const data = await api(`todos?${params}`);
      setTodos(data);
    } catch (e) { console.error('Load todos error:', e); }
  }, [api, searchQuery, todoFilter, selectedTagId, showArchived]);

  const loadTags = useCallback(async () => {
    try {
      const data = await api('tags');
      setTags(data);
    } catch (e) { console.error('Load tags error:', e); }
  }, [api]);

  useEffect(() => {
    if (dbReady) {
      if (view === 'notebook') loadNotes();
      else loadTodos();
    }
  }, [view, searchQuery, selectedTagId, todoFilter, showArchived, dbReady]);

  // ===== NOTE OPERATIONS =====
  const createNote = async () => {
    try {
      const note = await api('notes', {
        method: 'POST',
        body: JSON.stringify({ title: '', content: { type: 'doc', content: [{ type: 'paragraph' }] } }),
      });
      setNotes(prev => [{ ...note, tags: [] }, ...prev]);
      setSelectedNoteId(note.id);
      setEditingNote({ ...note, tags: [] });
    } catch (e) { console.error('Create note error:', e); }
  };

  const saveNote = async (noteId, title, content, tagIds) => {
    try {
      const updated = await api(`notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, tags: tagIds }),
      });
      setNotes(prev => prev.map(n => n.id === noteId ? updated : n));
      setEditingNote(prev => prev?.id === noteId ? updated : prev);
      loadTodos();
      return updated;
    } catch (e) { console.error('Save note error:', e); }
  };

  const deleteNote = async (noteId) => {
    try {
      await api(`notes/${noteId}`, { method: 'DELETE' });
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setEditingNote(null);
      }
    } catch (e) { console.error('Delete note error:', e); }
  };

  const handleNoteContentUpdate = (noteId, title, content, tagIds) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveNote(noteId, title, content, tagIds);
    }, 1500);
  };

  // ===== TODO OPERATIONS =====
  const createTodo = async (text, noteId) => {
    try {
      const todo = await api('todos', {
        method: 'POST',
        body: JSON.stringify({ text, note_id: noteId || null }),
      });
      setTodos(prev => [{ ...todo, tags: [] }, ...prev]);
      setNewTodoText('');
      if (noteId) loadNotes();
    } catch (e) { console.error('Create todo error:', e); }
  };

  const updateTodo = async (todoId, updates) => {
    try {
      const todo = await api(`todos/${todoId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setTodos(prev => prev.map(t => t.id === todoId ? { ...t, ...todo } : t));
      if (todo.note_id) loadNotes();
    } catch (e) { console.error('Update todo error:', e); }
  };

  const toggleTodo = async (todoId) => {
    try {
      const todo = await api(`todos/${todoId}/toggle`, { method: 'PATCH', body: '{}' });
      setTodos(prev => prev.map(t => {
        if (t.id === todoId) return { ...t, ...todo };
        if (t.parent_todo_id === todoId && todo.is_done) return { ...t, is_done: true, done_at: new Date().toISOString() };
        return t;
      }));
      loadNotes();
    } catch (e) { console.error('Toggle todo error:', e); }
  };

  const archiveTodo = async (todoId) => {
    try {
      const todo = await api(`todos/${todoId}/archive`, { method: 'PATCH', body: '{}' });
      setTodos(prev => prev.map(t => t.id === todoId ? { ...t, ...todo } : t));
    } catch (e) { console.error('Archive todo error:', e); }
  };

  const deleteTodo = async (todoId) => {
    try {
      await api(`todos/${todoId}`, { method: 'DELETE' });
      setTodos(prev => prev.filter(t => t.id !== todoId));
    } catch (e) { console.error('Delete todo error:', e); }
  };

  // ===== TAG OPERATIONS =====
  const createTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await api('tags', {
        method: 'POST',
        body: JSON.stringify({ name: newTagName.trim(), type: 'project', color: newTagColor }),
      });
      setTags(prev => [...prev, tag]);
      setNewTagName('');
      setShowTagForm(false);
    } catch (e) { console.error('Create tag error:', e); }
  };

  const deleteTag = async (tagId) => {
    try {
      await api(`tags/${tagId}`, { method: 'DELETE' });
      setTags(prev => prev.filter(t => t.id !== tagId));
      if (selectedTagId === tagId) setSelectedTagId('');
    } catch (e) { console.error('Delete tag error:', e); }
  };

  const toggleNoteTag = async (noteId, tagId, currentTags) => {
    const hasTag = currentTags.some(t => t.id === tagId);
    if (hasTag) {
      await api(`note-tags/${noteId}/${tagId}`, { method: 'DELETE' });
    } else {
      await api('note-tags', { method: 'POST', body: JSON.stringify({ note_id: noteId, tag_id: tagId }) });
    }
    loadNotes();
    if (editingNote?.id === noteId) {
      const updated = await api(`notes/${noteId}`);
      setEditingNote(updated);
    }
  };

  // ===== NAVIGATE TO NOTE FROM TODO =====
  const navigateToNote = async (noteId) => {
    try {
      setView('notebook');
      setSearchQuery('');
      setSelectedTagId('');
      const noteData = await api(`notes/${noteId}`);
      setSelectedNoteId(noteId);
      setEditingNote(noteData);
      await loadNotes();
    } catch (e) { console.error('Navigate to note error:', e); }
  };

  // ===== BUILD TODO TREE =====
  function buildTodoTree(flatTodos) {
    const map = new Map();
    const roots = [];
    flatTodos.forEach(t => map.set(t.id, { ...t, children: [] }));
    flatTodos.forEach(t => {
      const node = map.get(t.id);
      if (t.parent_todo_id && map.has(t.parent_todo_id)) {
        map.get(t.parent_todo_id).children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  // ===== RENDER =====
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={32} />
          <p className="text-muted-foreground">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  const todoTree = buildTodoTree(todos);

  // ===== TODO ITEM COMPONENT =====
  function TodoItemRow({ todo, depth = 0 }) {
    const isEditing = editingTodoId === todo.id;
    const hasChildren = todo.children && todo.children.length > 0;
    const isExpanded = expandedTodos.has(todo.id);
    const isArchived = !!todo.archived_at;

    return (
      <div>
        <div
          className={`flex items-center gap-2 py-2 px-3 group hover:bg-muted/50 rounded-md transition-colors ${
            isArchived ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => setExpandedTodos(prev => {
                const next = new Set(prev);
                isExpanded ? next.delete(todo.id) : next.add(todo.id);
                return next;
              })}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <button
            onClick={() => toggleTodo(todo.id)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              todo.is_done
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-muted-foreground/40 hover:border-primary'
            }`}
          >
            {todo.is_done && (
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>

          {isEditing ? (
            <Input
              value={editingTodoText}
              onChange={e => setEditingTodoText(e.target.value)}
              onBlur={() => { updateTodo(todo.id, { text: editingTodoText }); setEditingTodoId(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { updateTodo(todo.id, { text: editingTodoText }); setEditingTodoId(null); }
                if (e.key === 'Escape') setEditingTodoId(null);
              }}
              className="h-7 text-sm flex-1"
              autoFocus
            />
          ) : (
            <span
              className={`flex-1 text-sm cursor-pointer ${todo.is_done ? 'line-through text-muted-foreground' : ''}`}
              onDoubleClick={() => { setEditingTodoId(todo.id); setEditingTodoText(todo.text); }}
            >
              {todo.text || <span className="text-muted-foreground italic">Empty todo</span>}
            </span>
          )}

          {todo.note_id && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateToNote(todo.note_id); }}
              className="p-0.5 hover:bg-primary/10 rounded transition-colors flex-shrink-0"
              title="Go to linked note"
            >
              <FileText size={12} className="text-primary/70 hover:text-primary" />
            </button>
          )}

          {todo.tags?.map(tag => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => { setEditingTodoId(todo.id); setEditingTodoText(todo.text); }}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title="Edit"
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={() => archiveTodo(todo.id)}
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              title={isArchived ? 'Unarchive' : 'Archive'}
            >
              {isArchived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
            </button>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {todo.children.map(child => (
              <TodoItemRow key={child.id} todo={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="min-h-screen flex bg-background">
      {/* ===== SIDEBAR ===== */}
      <div className={`${sidebarCollapsed ? 'w-[60px]' : 'w-60'} border-r bg-sidebar flex flex-col transition-all duration-300 ease-in-out flex-shrink-0`}>
        {/* Sidebar Header */}
        <div className={`p-3 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <StickyNote size={20} className="text-primary flex-shrink-0" />
              <h1 className="font-semibold text-sm truncate">NoteFlow</h1>
            </div>
          ) : (
            <StickyNote size={20} className="text-primary" />
          )}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <div className="flex justify-center pb-1">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              title="Expand sidebar"
            >
              <PanelLeft size={16} />
            </button>
          </div>
        )}

        <Separator />

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {sidebarCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setView('notebook'); setSearchQuery(''); setSelectedTagId(''); }}
                    className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${
                      view === 'notebook' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    }`}
                  >
                    <BookOpen size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  Notebook
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setView('todos'); setSearchQuery(''); setSelectedTagId(''); }}
                    className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${
                      view === 'todos' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    }`}
                  >
                    <CheckSquare size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  To-Do List
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <button
                onClick={() => { setView('notebook'); setSearchQuery(''); setSelectedTagId(''); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  view === 'notebook' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <BookOpen size={18} />
                <span>Notebook</span>
              </button>
              <button
                onClick={() => { setView('todos'); setSearchQuery(''); setSelectedTagId(''); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  view === 'todos' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <CheckSquare size={18} />
                <span>To-Do List</span>
              </button>
            </>
          )}
        </nav>

        {/* Projects / Tags */}
        {sidebarCollapsed ? (
          <div className="p-2 border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { setSidebarCollapsed(false); }}
                  className="w-full flex items-center justify-center p-2 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                >
                  <Tag size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                Projects
              </TooltipContent>
            </Tooltip>
            {tags.map(tag => (
              <Tooltip key={tag.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { setSelectedTagId(selectedTagId === tag.id ? '' : tag.id); }}
                    className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${
                      selectedTagId === tag.id ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#888' }} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {tag.name}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ) : (
          <div className="p-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
              <button
                onClick={() => setShowTagForm(!showTagForm)}
                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
              >
                <Plus size={14} />
              </button>
            </div>
            {showTagForm && (
              <div className="mb-2 space-y-2">
                <Input
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  placeholder="Project name"
                  className="h-7 text-xs"
                  onKeyDown={e => e.key === 'Enter' && createTag()}
                />
                <div className="flex gap-1 flex-wrap">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setNewTagColor(c.value)}
                      className={`w-5 h-5 rounded-full border-2 ${newTagColor === c.value ? 'border-foreground' : 'border-transparent'}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" className="h-6 text-xs flex-1" onClick={createTag}>Add</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowTagForm(false)}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="space-y-0.5">
              <button
                onClick={() => setSelectedTagId('')}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  !selectedTagId ? 'bg-sidebar-accent font-medium' : 'hover:bg-sidebar-accent/50'
                }`}
              >
                All
              </button>
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center group">
                  <button
                    onClick={() => setSelectedTagId(selectedTagId === tag.id ? '' : tag.id)}
                    className={`flex-1 text-left px-2 py-1 rounded text-xs flex items-center gap-2 transition-colors ${
                      selectedTagId === tag.id ? 'bg-sidebar-accent font-medium' : 'hover:bg-sidebar-accent/50'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#888' }} />
                    {tag.name}
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* ===== TOP BAR ===== */}
        <div className="border-b px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={view === 'notebook' ? 'Search notes...' : 'Search todos...'}
              className="pl-9 h-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {view === 'todos' && (
            <div className="flex items-center gap-2">
              {['all', 'open', 'done'].map(f => (
                <button
                  key={f}
                  onClick={() => setTodoFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    todoFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  showArchived ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <Archive size={12} className="inline mr-1" />
                Archived
              </button>
            </div>
          )}

          <Button
            size="sm"
            onClick={() => view === 'notebook' ? createNote() : document.getElementById('new-todo-input')?.focus()}
            className="h-8"
          >
            <Plus size={14} className="mr-1" />
            {view === 'notebook' ? 'New Note' : 'New Todo'}
          </Button>
        </div>

        {/* ===== CONTENT AREA ===== */}
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-4xl mx-auto">
            {view === 'notebook' ? (
              /* ===== NOTEBOOK VIEW ===== */
              <div className="space-y-3">
                {notes.length === 0 && !loading && (
                  <div className="text-center py-16 text-muted-foreground">
                    <BookOpen className="mx-auto mb-3" size={40} strokeWidth={1} />
                    <p className="text-lg font-medium">No notes yet</p>
                    <p className="text-sm mt-1">Create your first note to get started</p>
                    <Button onClick={createNote} className="mt-4" size="sm">
                      <Plus size={14} className="mr-1" /> New Note
                    </Button>
                  </div>
                )}
                {notes.map(note => {
                  const isSelected = selectedNoteId === note.id;
                  return (
                    <div
                      key={note.id}
                      className={`border rounded-lg transition-all ${
                        isSelected ? 'ring-2 ring-primary/20 border-primary/30' : 'hover:border-primary/20'
                      }`}
                    >
                      <div
                        className="px-4 py-3 cursor-pointer flex items-start justify-between"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedNoteId(null);
                            setEditingNote(null);
                          } else {
                            setSelectedNoteId(note.id);
                            setEditingNote(note);
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">
                            {note.title || <span className="text-muted-foreground italic">Untitled</span>}
                          </h3>
                          {!isSelected && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {getContentPreview(note.content) || 'Empty note'}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-muted-foreground">
                              <Clock size={10} className="inline mr-1" />
                              {formatDate(note.updated_at)}
                            </span>
                            {note.tags?.map(tag => (
                              <span
                                key={tag.id}
                                className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: tag.color + '20', color: tag.color }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <ChevronDown
                            size={16}
                            className={`text-muted-foreground transition-transform ${isSelected ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </div>

                      {isSelected && editingNote && (
                        <div className="px-4 pb-4 border-t">
                          <div className="mt-3 mb-3">
                            <Input
                              value={editingNote.title || ''}
                              onChange={e => {
                                const newTitle = e.target.value;
                                setEditingNote(prev => ({ ...prev, title: newTitle }));
                                handleNoteContentUpdate(note.id, newTitle, editingNote.content, editingNote.tags?.map(t => t.id));
                              }}
                              placeholder="Note title"
                              className="border-none text-lg font-semibold px-0 h-auto focus-visible:ring-0 shadow-none"
                            />
                          </div>
                          <NoteEditor
                            content={editingNote.content}
                            onUpdate={(newContent) => {
                              setEditingNote(prev => ({ ...prev, content: newContent }));
                              handleNoteContentUpdate(note.id, editingNote.title, newContent, editingNote.tags?.map(t => t.id));
                            }}
                            placeholder="Start writing... Use the toolbar to add tasks, lists, and more."
                          />
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-1 flex-wrap">
                              <Tag size={12} className="text-muted-foreground mr-1" />
                              {tags.map(tag => {
                                const hasTag = editingNote.tags?.some(t => t.id === tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    onClick={() => toggleNoteTag(note.id, tag.id, editingNote.tags || [])}
                                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                      hasTag
                                        ? 'border-transparent font-medium'
                                        : 'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50'
                                    }`}
                                    style={hasTag ? { backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' } : {}}
                                  >
                                    {tag.name}
                                  </button>
                                );
                              })}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteNote(note.id)}
                            >
                              <Trash2 size={12} className="mr-1" /> Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ===== TODO VIEW ===== */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    id="new-todo-input"
                    value={newTodoText}
                    onChange={e => setNewTodoText(e.target.value)}
                    placeholder="Add a new todo..."
                    className="h-9 text-sm"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newTodoText.trim()) {
                        createTodo(newTodoText.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={() => newTodoText.trim() && createTodo(newTodoText.trim())}
                    disabled={!newTodoText.trim()}
                  >
                    <Plus size={14} className="mr-1" /> Add
                  </Button>
                </div>

                {todoTree.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground">
                    <CheckSquare className="mx-auto mb-3" size={40} strokeWidth={1} />
                    <p className="text-lg font-medium">No todos found</p>
                    <p className="text-sm mt-1">Create a new todo or adjust your filters</p>
                  </div>
                )}

                <div className="space-y-0.5">
                  {todoTree.map(todo => (
                    <TodoItemRow key={todo.id} todo={todo} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
    </TooltipProvider>
  );
}
