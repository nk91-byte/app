'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BookOpen, CheckSquare, Plus, Search, X, Tag, ChevronDown, ChevronRight, Check,
  Trash2, Archive, ArchiveRestore, Edit3, Save, FileText, Clock, MoreHorizontal,
  Loader2, Palette, StickyNote, PanelLeftClose, PanelLeft, Filter, LayoutGrid,
  Calendar as CalendarIcon, FolderOpen, CircleDot, GripVertical, List, Columns3, Type, ListTodo, EyeOff, Repeat, Maximize2, Minimize2
} from 'lucide-react';
import React from 'react'; // Added React import for ErrorBoundary
import Sidebar from '@/components/Sidebar';
import TopNavBar from '@/components/TopNavBar';
import NotesBrowser from '@/components/NotesBrowser';
import TodosBrowser from '@/components/TodosBrowser';
import TodoDetailPanel from '@/components/TodoDetailPanel';
import TagsManagement from '@/components/TagsManagement';
import QuickAddModal from '@/components/QuickAddModal';
import RecordingControls from '@/components/RecordingControls';
import TranscriptViewer from '@/components/TranscriptViewer';
import { cleanupOldAudio } from '@/lib/audioStore';
import { toast } from 'sonner';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      // ChunkLoadError happens when Next.js HMR loses the dynamically imported file.
      // Easiest recovery is to just force a page reload to grab the new JS bundle map.
      if (this.state.error && this.state.error.name === 'ChunkLoadError') {
        if (typeof window !== 'undefined') {
          const lastReload = sessionStorage.getItem('chunkLoadErrorReload');
          const now = Date.now();
          if (!lastReload || now - parseInt(lastReload) > 5000) {
            sessionStorage.setItem('chunkLoadErrorReload', now.toString());
            window.location.reload();
          }
        }
        return <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={16} />Recovering editor component...</div>;
      }
      return (
        <div className="p-4 text-sm whitespace-pre-wrap bg-red-50 text-red-600 border border-red-200 rounded-md m-4">
          <p className="font-semibold mb-2">Editor Component Error:</p>
          {this.state.error.toString()}
        </div>
      );
    }
    return this.props.children;
  }
}

const NoteEditor = dynamic(() => import('../components/NoteEditor'), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin inline mr-2" size={16} />Loading editor...</div>,
});

const RANDOM_TAG_COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#6B7280', '#14b8a6', '#f97316'];

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
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
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

function extractActionItems(content) {
  if (!content || !content.content) return [];
  const tasks = [];
  function walk(node) {
    if (node.type === 'taskItem') {
      const isChecked = node.attrs?.checked || false;
      let text = '';
      function walkText(n) {
        if (n.type === 'text') text += n.text;
        if (n.content) n.content.forEach(walkText);
      }
      if (node.content) node.content.forEach(walkText);
      tasks.push({ isChecked, text });
    }
    if (node.content) node.content.forEach(walk);
  }
  walk(content);
  return tasks;
}

// ===== PURE HELPER FUNCTIONS (outside component to avoid re-creation) =====
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

function getDynamicDateGroup(dateStr, now) {
  if (!dateStr) return { key: '9999-99', label: 'No Due Date' };
  const d = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffTime = dDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { key: '01', label: 'Past Due' };
  if (diffDays === 0) return { key: '02', label: 'Today' };
  if (diffDays === 1) return { key: '03', label: 'Tomorrow' };
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const daysToSunday = 7 - dayOfWeek;
  if (diffDays > 1 && diffDays <= daysToSunday) return { key: '04', label: 'This Week' };
  if (diffDays > daysToSunday && diffDays <= daysToSunday + 7) return { key: '05', label: 'Next Week' };
  const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = d.getFullYear() === now.getFullYear()
    ? d.toLocaleDateString('en-US', { month: 'long' })
    : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return { key: monthKey, label: monthLabel };
}

function getStatusLabel(todo) {
  if (todo.archived_at) return 'Archived';
  if (todo.is_done) return 'Done';
  return 'Open';
}

function groupTodosHelper(todoTree, groupBy, projectTags) {
  if (groupBy === 'none') return [{ key: '__all', label: null, todos: todoTree }];
  const groups = new Map();
  const now = new Date();
  for (const todo of todoTree) {
    let key, label, color;
    if (groupBy === 'project') {
      const projectTag = todo.tags?.find(t => t.type === 'project');
      key = projectTag ? projectTag.id : '__untagged';
      label = projectTag ? projectTag.name : 'Inbox';
      color = projectTag?.color || null;
    } else if (groupBy === 'status') {
      const s = getStatusLabel(todo);
      key = s.toLowerCase();
      label = s;
      color = s === 'Open' ? '#3b82f6' : s === 'Done' ? '#22c55e' : '#9ca3af';
    } else if (groupBy === 'date') {
      const g = getDynamicDateGroup(todo.due_date, now);
      key = g.key;
      label = g.label;
      color = null;
    }
    if (!groups.has(key)) {
      groups.set(key, { key, label, color, todos: [] });
    }
    groups.get(key).todos.push(todo);
  }
  const unsortedGroups = Array.from(groups.values());
  if (groupBy === 'project') {
    return unsortedGroups.sort((a, b) => {
      if (a.key === '__untagged') return -1;
      if (b.key === '__untagged') return 1;
      const posA = projectTags.findIndex(t => t.id === a.key);
      const posB = projectTags.findIndex(t => t.id === b.key);
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });
  } else if (groupBy === 'date') {
    unsortedGroups.forEach(g => g.todos.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    }));
    return unsortedGroups.sort((a, b) => a.key.localeCompare(b.key));
  }
  return unsortedGroups;
}

// ===== SortableGroupHeader (extracted outside to prevent re-creation) =====
function SortableGroupHeader({ group, isBoard, collapsed, onToggleCollapse, onHide, onAdd }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.key,
    data: { type: 'projectGroup', group }
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 10,
    position: 'relative',
    opacity: isDragging ? 0.4 : 1,
  };
  if (isBoard) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-2 mb-3 px-2 py-2 bg-muted/50 rounded-lg sticky top-0 z-10 cursor-grab active:cursor-grabbing hover:bg-muted/80 transition-colors">
        {group.color && (
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
        )}
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide truncate">{group.label || 'All'}</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#5BA89D20', color: '#5BA89D' }}>{group.todos.length}</span>
        <div className="flex-1" />
        {onAdd && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAdd(); }}
            className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-background/80 transition-colors"
            title="Add action"
          >
            <Plus size={13} />
          </button>
        )}
        {onHide && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onHide(group.key); }}
            className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
            title={`Hide ${group.label || 'group'}`}
          >
            <EyeOff size={12} />
          </button>
        )}
        <GripVertical size={14} className="text-muted-foreground opacity-50 hover:opacity-100 transition-opacity hidden" />
      </div>
    );
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-center gap-2 mb-0 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10 cursor-grab active:cursor-grabbing group-header-row select-none">
      <div
        onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
        className="cursor-pointer p-0.5 hover:bg-muted rounded text-muted-foreground"
      >
        <ChevronRight size={14} className={`transition-transform ${!collapsed ? 'rotate-90' : ''}`} />
      </div>
      {group.color && (
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
      )}
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide group-hover:text-primary transition-colors">{group.label}</h3>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#5BA89D20', color: '#5BA89D' }}>{group.todos.length}</span>
      {onAdd && (
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAdd(); }}
          className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
          title="Add action"
        >
          <Plus size={13} />
        </button>
      )}
      <div className={`flex-1 border-b ${group.color ? 'opacity-30' : 'border-border/50'}`} style={group.color ? { borderColor: group.color } : {}} />
      <GripVertical size={14} className="text-muted-foreground opacity-30 hover:opacity-100 transition-opacity" />
    </div>
  );
}

// ===== TodoItemRow (extracted outside to prevent re-creation) =====
function TodoItemRow({ todo, depth = 0, isDragOverlay = false, editingTodoId, setEditingTodoId, setEditingTodoText, expandedTodos, setExpandedTodos, toggleTodo, todoVisibleFields, todoGroupBy, todoTagPickerId, setTodoTagPickerId, navigateToNote, archiveTodo, deleteTodo, newInlineProjectTagName, setNewInlineProjectTagName, newInlineProjectTagColor, setNewInlineProjectTagColor, createProjectTagInline, toggleTodoTag, projectTags }) {
  const hasChildren = todo.children && todo.children.length > 0;
  const isExpanded = expandedTodos.has(todo.id);
  const isArchived = !!todo.archived_at;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id, disabled: isDragOverlay });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        className={`flex items-center gap-2 py-1 px-3 group hover:bg-muted/50 rounded-md transition-colors cursor-grab active:cursor-grabbing touch-none ${isArchived ? 'opacity-50' : ''} ${isDragging ? 'bg-muted/30' : ''} ${editingTodoId === todo.id ? 'bg-accent/50 ring-1 ring-inset ring-primary/20' : ''}`}
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
          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${todo.is_done ? 'bg-muted border-muted-foreground/20 text-muted-foreground/50' : 'border-muted-foreground/40 hover:border-primary'}`}
        >
          {todo.is_done && (
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </button>
        <span
          className={`flex-1 text-sm cursor-pointer line-clamp-2 break-words leading-tight ${todo.is_done ? 'line-through text-muted-foreground' : ''}`}
          onClick={() => { setEditingTodoId(todo.id); setEditingTodoText(todo.text); }}
        >
          {todo.text || <span className="text-muted-foreground italic">Empty todo</span>}
        </span>
        {todoVisibleFields.includes('tags') && (todoGroupBy === 'project' ? todo.tags?.filter(t => t.type !== 'project') : todo.tags)?.map(tag => (
          <span
            key={tag.id}
            className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 cursor-pointer hover:opacity-70"
            style={{ backgroundColor: tag.color + '20', color: tag.color }}
            onClick={() => setTodoTagPickerId(todoTagPickerId === todo.id ? null : todo.id)}
            title={tag.name}
          >
            {tag.name}
          </span>
        ))}
        {(todoVisibleFields.includes('daysTillDue') || todoVisibleFields.includes('dueDate')) && todo.due_date && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const due = new Date(todo.due_date);
          due.setHours(0, 0, 0, 0);
          const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
          const color = diff < 0 ? 'bg-red-100 text-red-600' : diff === 0 ? 'bg-orange-100 text-orange-600' : diff === 1 ? 'bg-yellow-100 text-yellow-600' : 'bg-muted/60 text-muted-foreground';
          return (
            <>
              {todoVisibleFields.includes('daysTillDue') && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 flex items-center gap-0.5 ${color}`}>
                  {todo.recurrence && <Repeat size={8} />}
                  {diff > 0 ? `+${diff}` : diff}d
                </span>
              )}
              {todoVisibleFields.includes('dueDate') && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {new Date(todo.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              )}
            </>
          );
        })()}
        {todoVisibleFields.includes('actionItems') && (() => {
          const content = typeof todo.content === 'string' ? (() => { try { return JSON.parse(todo.content); } catch { return null; } })() : todo.content;
          const actionItems = extractActionItems(content);
          if (actionItems.length === 0) return null;
          const total = actionItems.length;
          const done = actionItems.filter(t => t.isChecked).length;
          return (
            <div className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground flex-shrink-0">
              <CheckSquare size={9} />
              <span>{done}/{total}</span>
            </div>
          );
        })()}
        {todoVisibleFields.includes('linkedNote') && (todo.note_id ? (
          <button
            onClick={(e) => { e.stopPropagation(); navigateToNote(todo.note_id); }}
            className="p-0.5 hover:bg-primary/10 rounded transition-colors flex-shrink-0"
            title="Go to linked note"
          >
            <FileText size={12} className="text-primary/70 hover:text-primary" />
          </button>
        ) : (
          <span className="relative flex-shrink-0 p-0.5 opacity-20" title="No linked note">
            <FileText size={12} className="text-muted-foreground" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="block w-[14px] h-[1px] bg-muted-foreground rotate-[-45deg]" />
            </span>
          </span>
        ))}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setTodoTagPickerId(todoTagPickerId === todo.id ? null : todo.id)}
            className={`p-0.5 rounded transition-colors ${todoTagPickerId === todo.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted'}`}
            title="Assign project tag"
          >
            <Tag size={11} />
          </button>
          {todoTagPickerId === todo.id && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setTodoTagPickerId(null)} />
              <div className="absolute right-0 top-6 z-50 w-48 bg-popover border rounded-lg shadow-lg py-1" onClick={e => e.stopPropagation()}>
                <div className="px-2 py-1.5 border-b">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newInlineProjectTagName}
                      onChange={e => setNewInlineProjectTagName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') createProjectTagInline(todo.id); }}
                      placeholder="New tag..."
                      className="flex-1 text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                      autoFocus
                    />
                  </div>
                  {newInlineProjectTagName.trim() && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {RANDOM_TAG_COLORS.map(c => (
                        <button key={c} onClick={() => setNewInlineProjectTagColor(c)} className={`w-4 h-4 rounded-full border-2 transition-transform ${newInlineProjectTagColor === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {projectTags.map(tag => {
                    const hasTag = todo.tags?.some(t => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTodoTag(todo.id, tag.id)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <div className={`w-3 h-3 rounded flex items-center justify-center border ${hasTag ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                          {hasTag && <Check size={8} />}
                        </div>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="truncate">{tag.name}</span>
                      </button>
                    );
                  })}
                  {projectTags.length === 0 && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground italic">No project tags yet</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
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
            <TodoItemRow key={child.id} todo={child} depth={depth + 1} editingTodoId={editingTodoId} setEditingTodoId={setEditingTodoId} setEditingTodoText={setEditingTodoText} expandedTodos={expandedTodos} setExpandedTodos={setExpandedTodos} toggleTodo={toggleTodo} todoVisibleFields={todoVisibleFields} todoGroupBy={todoGroupBy} todoTagPickerId={todoTagPickerId} setTodoTagPickerId={setTodoTagPickerId} navigateToNote={navigateToNote} archiveTodo={archiveTodo} deleteTodo={deleteTodo} newInlineProjectTagName={newInlineProjectTagName} setNewInlineProjectTagName={setNewInlineProjectTagName} newInlineProjectTagColor={newInlineProjectTagColor} setNewInlineProjectTagColor={setNewInlineProjectTagColor} createProjectTagInline={createProjectTagInline} toggleTodoTag={toggleTodoTag} projectTags={projectTags} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [supabase, router]);

  const [view, setView] = useState('notebook');
  const [notes, setNotes] = useState([]);
  const [todos, setTodos] = useState([]);
  const [sourceTags, setSourceTags] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [noteTab, setNoteTab] = useState('notes'); // 'notes' | 'summary' | 'transcript'
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [todoFilters, setTodoFilters] = useState(['open']);
  const [todoProjectFilterIds, setTodoProjectFilterIds] = useState([]);
  const [todoDateFilter, setTodoDateFilter] = useState([]);
  const [todoDateRangeFrom, setTodoDateRangeFrom] = useState('');
  const [todoDateRangeTo, setTodoDateRangeTo] = useState('');
  const [todoCreatedFilter, setTodoCreatedFilter] = useState([]);
  const [todoCreatedRangeFrom, setTodoCreatedRangeFrom] = useState('');
  const [todoCreatedRangeTo, setTodoCreatedRangeTo] = useState('');
  const [todoGroupBy, setTodoGroupBy] = useState('none');
  const [noteMeetingFilters, setNoteMeetingFilters] = useState([]);
  const [noteStatusFilters, setNoteStatusFilters] = useState([]);
  const [noteDateFilter, setNoteDateFilter] = useState('all');
  const [noteGroupBy, setNoteGroupBy] = useState('none');
  const [viewLayout, setViewLayout] = useState('list');
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [editorToolbarOpen, setEditorToolbarOpen] = useState(false);
  const [showActionItems, setShowActionItems] = useState(false);
  const [inlineAddingGroupId, setInlineAddingGroupId] = useState(null);
  const [inlineTodoText, setInlineTodoText] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[4].value);
  const [newTagType, setNewTagType] = useState('source');

  // Pagination State
  const [noteOffset, setNoteOffset] = useState(0);
  const [noteTotal, setNoteTotal] = useState(0);
  const [todoOffset, setTodoOffset] = useState(0);
  const [todoTotal, setTodoTotal] = useState(0);
  const LIMIT = 50;
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [todoToolbarOpen, setTodoToolbarOpen] = useState(false);
  const [todoStatusFilterOpen, setTodoStatusFilterOpen] = useState(false);
  const [todoProjectFilterOpen, setTodoProjectFilterOpen] = useState(false);
  const [noteMeetingFilterOpen, setNoteMeetingFilterOpen] = useState(false);
  const [showTodoActionItems, setShowTodoActionItems] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [noteVisibleFields, setNoteVisibleFields] = useState(['date', 'actionItems', 'tags', 'preview']);
  const [todoVisibleFields, setTodoVisibleFields] = useState(['tags', 'actionItems', 'daysTillDue', 'dueDate', 'linkedNote']);
  const [todoTagPickerId, setTodoTagPickerId] = useState(null);
  const [aiActionTagPickerId, setAiActionTagPickerId] = useState(null);
  const [aiActionBubbleExpandedId, setAiActionBubbleExpandedId] = useState(null);
  const [newTodoTagIds, setNewTodoTagIds] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState([]);
  const [collapsedNoteGroups, setCollapsedNoteGroups] = useState([]);
  const [activeDragTodo, setActiveDragTodo] = useState(null);
  const [activeDragGroup, setActiveDragGroup] = useState(null);
  const [hiddenBoardGroups, setHiddenBoardGroups] = useState([]);
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('');
  const [tagMenuId, setTagMenuId] = useState(null);
  const [archivedTags, setArchivedTags] = useState([]);
  const [showArchivedTags, setShowArchivedTags] = useState(false);
  const [showArchivedMeetings, setShowArchivedMeetings] = useState(false);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [tagDropdownNoteId, setTagDropdownNoteId] = useState(null);
  const [editorTagDropdownNoteId, setEditorTagDropdownNoteId] = useState(null);
  const [newInlineTagName, setNewInlineTagName] = useState('');
  const [newInlineTagColor, setNewInlineTagColor] = useState(null);
  const [newInlineProjectTagName, setNewInlineProjectTagName] = useState('');
  const [newInlineProjectTagColor, setNewInlineProjectTagColor] = useState(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [boardColumnSize, setBoardColumnSize] = useState('medium');
  const [notebookSavedViews, setNotebookSavedViews] = useState([]);
  const [todoSavedViews, setTodoSavedViews] = useState([]);
  const [activeNotebookViewId, setActiveNotebookViewId] = useState(null);
  const [activeTodoViewId, setActiveTodoViewId] = useState(null);
  const saveTimeoutRef = useRef(null);
  const todoSaveTimeoutRef = useRef(null);
  const tagDropdownRef = useRef(null);

  const handleSetBoardColumnSize = async (val) => {
    setBoardColumnSize(val);
    try {
      await api('preferences/board_column_size', {
        method: 'PUT',
        body: JSON.stringify({ value: val })
      });
    } catch (e) {
      console.error('Save board column size error:', e);
    }
  };

  // Persist saved views to API
  const persistNotebookViews = async (views) => {
    setNotebookSavedViews(views);
    try {
      await api('preferences/notebook_saved_views', {
        method: 'PUT',
        body: JSON.stringify({ value: views })
      });
    } catch (e) {
      console.error('Save notebook views error:', e);
    }
  };

  const persistTodoViews = async (views) => {
    setTodoSavedViews(views);
    try {
      await api('preferences/todo_saved_views', {
        method: 'PUT',
        body: JSON.stringify({ value: views })
      });
    } catch (e) {
      console.error('Save todo views error:', e);
    }
  };

  // Notebook saved views
  const saveCurrentNotebookView = (name, selectedViewLayout) => {
    const view = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name,
      viewLayout: selectedViewLayout || viewLayout,
      noteGroupBy,
      noteDateFilter,
      noteMeetingFilters,
      noteStatusFilters,
      noteVisibleFields,
      noteGroupOrder: noteGroupOrder.length > 0 ? noteGroupOrder : [...sourceTags.map(t => t.id), '__untagged'],
      createdAt: new Date().toISOString(),
    };
    persistNotebookViews([...notebookSavedViews, view]);
    setActiveNotebookViewId(view.id);
  };

  const applyNotebookView = (viewId) => {
    const v = notebookSavedViews.find(s => s.id === viewId);
    if (!v) return;
    setActiveNotebookViewId(viewId);
    setViewLayout(v.viewLayout || 'list');
    setNoteGroupBy(v.noteGroupBy || 'none');
    setNoteDateFilter(v.noteDateFilter || 'all');
    setNoteMeetingFilters(v.noteMeetingFilters || []);
    setNoteStatusFilters(v.noteStatusFilters || []);
    setNoteVisibleFields(v.noteVisibleFields || ['date', 'actionItems', 'tags', 'preview']);
    const order = v.noteGroupOrder || v.sourceTagOrder;
    if (order && order.length > 0) {
      setNoteGroupOrder(order);
      const tagOrder = order.filter(id => id !== '__untagged');
      setSourceTags(prev => {
        const sorted = tagOrder.map(id => prev.find(t => t.id === id)).filter(Boolean);
        const remaining = prev.filter(t => !tagOrder.includes(t.id));
        return [...sorted, ...remaining];
      });
      api('tags/batch-reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds: tagOrder })
      }).catch(() => { });
    }
  };

  const deleteNotebookView = (viewId) => {
    persistNotebookViews(notebookSavedViews.filter(v => v.id !== viewId));
    if (activeNotebookViewId === viewId) setActiveNotebookViewId(null);
  };

  const renameNotebookView = (viewId, newName, newViewLayout) => {
    persistNotebookViews(notebookSavedViews.map(v => v.id === viewId ? { ...v, name: newName, ...(newViewLayout ? { viewLayout: newViewLayout } : {}) } : v));
  };

  const updateNotebookSavedView = (viewId) => {
    persistNotebookViews(notebookSavedViews.map(v => v.id === viewId ? {
      ...v,
      viewLayout,
      noteGroupBy,
      noteDateFilter,
      noteMeetingFilters,
      noteStatusFilters,
      noteVisibleFields,
      noteGroupOrder: noteGroupOrder.length > 0 ? noteGroupOrder : [...sourceTags.map(t => t.id), '__untagged'],
    } : v));
  };

  // TODO saved views
  const saveCurrentTodoView = (name, selectedViewLayout) => {
    const view = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name,
      viewLayout: selectedViewLayout || viewLayout,
      todoGroupBy,
      todoFilters,
      todoProjectFilterIds,
      todoDateFilter,
      todoCreatedFilter,
      todoCreatedRangeFrom,
      todoCreatedRangeTo,
      hiddenBoardGroups,
      projectOrder: projectTags.map(t => t.id),
      todoVisibleFields,
      createdAt: new Date().toISOString(),
    };
    persistTodoViews([...todoSavedViews, view]);
    setActiveTodoViewId(view.id);
  };

  const applyTodoView = (viewId) => {
    const v = todoSavedViews.find(s => s.id === viewId);
    if (!v) return;
    setActiveTodoViewId(viewId);
    setViewLayout(v.viewLayout || 'list');
    setTodoGroupBy(v.todoGroupBy || 'none');
    setTodoFilters(v.todoFilters || ['open']);
    setTodoProjectFilterIds(v.todoProjectFilterIds || []);
    setTodoDateFilter(Array.isArray(v.todoDateFilter) ? v.todoDateFilter : []);
    setTodoCreatedFilter(Array.isArray(v.todoCreatedFilter) ? v.todoCreatedFilter : v.todoCreatedFilter ? [v.todoCreatedFilter] : []);
    setTodoCreatedRangeFrom(v.todoCreatedRangeFrom || '');
    setTodoCreatedRangeTo(v.todoCreatedRangeTo || '');
    setHiddenBoardGroups(v.hiddenBoardGroups || []);
    setTodoVisibleFields(v.todoVisibleFields || ['tags', 'actionItems', 'daysTillDue', 'dueDate', 'linkedNote']);

    // Apply saved project order if available
    if (v.projectOrder && v.projectOrder.length > 0) {
      const orderedTags = [];
      const tagMap = new Map(projectTags.map(t => [t.id, t]));

      // Add tags in the saved order
      v.projectOrder.forEach(id => {
        const tag = tagMap.get(id);
        if (tag) {
          orderedTags.push(tag);
          tagMap.delete(id);
        }
      });

      // Add any new tags that weren't in the saved order
      tagMap.forEach(tag => orderedTags.push(tag));

      setProjectTags(orderedTags);
    }
  };

  const deleteTodoView = (viewId) => {
    persistTodoViews(todoSavedViews.filter(v => v.id !== viewId));
    if (activeTodoViewId === viewId) setActiveTodoViewId(null);
  };

  const renameTodoView = (viewId, newName, newViewLayout) => {
    persistTodoViews(todoSavedViews.map(v => v.id === viewId ? { ...v, name: newName, ...(newViewLayout ? { viewLayout: newViewLayout } : {}) } : v));
  };

  const updateTodoSavedView = (viewId) => {
    persistTodoViews(todoSavedViews.map(v => v.id === viewId ? {
      ...v,
      viewLayout,
      todoGroupBy,
      todoFilters,
      todoProjectFilterIds,
      todoDateFilter,
      todoCreatedFilter,
      todoCreatedRangeFrom,
      todoCreatedRangeTo,
      hiddenBoardGroups,
      projectOrder: projectTags.map(t => t.id),
      todoVisibleFields,
    } : v));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
        setDbReady(true);
        cleanupOldAudio().catch(() => {}); // remove stale audio blobs older than 7 days
        await Promise.all([loadNotes(), loadTodos(), loadSourceTags(), loadProjectTags(), loadPreferences()]);
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // ===== DATA LOADERS =====
  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await api('preferences');
      if (prefs.notebook_saved_views) setNotebookSavedViews(prefs.notebook_saved_views);
      if (prefs.todo_saved_views) setTodoSavedViews(prefs.todo_saved_views);
      if (prefs.board_column_size) setBoardColumnSize(prefs.board_column_size);
    } catch (e) {
      console.error('Load preferences error:', e);
    }
  }, [api]);

  const loadArchivedTags = useCallback(async () => {
    try {
      const data = await api('tags?include_archived=true');
      setArchivedTags(data);
    } catch (e) { console.error('Load archived tags error:', e); }
  }, [api]);

  const loadNotes = useCallback(async (search, tag, append = false, forceOffset = 0) => {
    try {
      const params = new URLSearchParams();
      if (search || searchQuery) params.set('search', search || searchQuery);
      // Use meeting filter if set, otherwise use selected sidebar tag
      const effectiveTag = noteMeetingFilters.length > 0 ? noteMeetingFilters.join(',') : tag ? tag : (selectedTagIds.length > 0 ? selectedTagIds.join(',') : '');
      if (effectiveTag) params.set('tag', effectiveTag);
      if (noteStatusFilters.length > 0) params.set('status', noteStatusFilters.join(','));
      params.set('limit', LIMIT);
      params.set('offset', append ? noteOffset : forceOffset);

      const response = await api(`notes?${params}`);

      if (append) {
        setNotes(prev => [...prev, ...response.data]);
      } else {
        setNotes(response.data);
      }
      setNoteTotal(response.total);
    } catch (e) { console.error('Load notes error:', e); }
  }, [api, searchQuery, selectedTagIds, noteMeetingFilters, noteStatusFilters, noteOffset]);



  const loadTodos = useCallback(async (append = false, forceOffset = 0) => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (todoFilters.length > 0) params.set('status', todoFilters.join(','));
      if (todoProjectFilterIds.length > 0) params.set('project_id', todoProjectFilterIds.join(','));
      // Custom date range filter (sent to API)
      if (todoDateRangeFrom) params.set('date_from', todoDateRangeFrom);
      if (todoDateRangeTo) params.set('date_to', todoDateRangeTo);

      params.set('limit', LIMIT);
      params.set('offset', append ? todoOffset : forceOffset);

      const response = await api(`todos?${params}`);

      if (append) {
        setTodos(prev => [...prev, ...response.data]);
      } else {
        setTodos(response.data);
      }
      setTodoTotal(response.total);
    } catch (e) { console.error('Load todos error:', e); }
  }, [api, searchQuery, todoFilters, todoProjectFilterIds, todoDateFilter, todoDateRangeFrom, todoDateRangeTo, todoOffset]);

  const loadSourceTags = useCallback(async () => {
    try {
      const data = await api('tags?type=source');
      setSourceTags(data);
    } catch (e) { console.error('Load source tags error:', e); }
  }, [api]);

  const loadProjectTags = useCallback(async () => {
    try {
      const data = await api('tags?type=project');
      setProjectTags(data);
    } catch (e) { console.error('Load project tags error:', e); }
  }, [api]);

  useEffect(() => {
    if (dbReady) {
      if (view === 'notebook') {
        setNoteOffset(0);
        loadNotes(null, null, false, 0);
      } else {
        setTodoOffset(0);
        loadTodos(false, 0);
      }
    }
  }, [view, searchQuery, selectedTagIds, todoFilters, todoProjectFilterIds, todoDateFilter, noteMeetingFilters, noteStatusFilters, dbReady]);

  const loadMoreNotes = useCallback(() => {
    const nextOffset = noteOffset + LIMIT;
    setNoteOffset(nextOffset);
    loadNotes(null, null, true, nextOffset);
  }, [noteOffset, loadNotes]);

  const loadMoreTodos = useCallback(() => {
    const nextOffset = todoOffset + LIMIT;
    setTodoOffset(nextOffset);
    loadTodos(true, nextOffset);
  }, [todoOffset, loadTodos]);

  // ESC key to close editor panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickAddOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (quickAddOpen) {
          setQuickAddOpen(false);
        } else if (tagDropdownNoteId) {
          setTagDropdownNoteId(null);
        } else if (selectedNoteId) {
          setSelectedNoteId(null);
          setEditingNote(null);
          setFocusMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteId, tagDropdownNoteId]);

  // ===== NOTE OPERATIONS =====
  const createNote = async () => {
    try {
      const note = await api('notes', {
        method: 'POST',
        body: JSON.stringify({ title: '', content: { type: 'doc', content: [{ type: 'paragraph' }] } }),
      });
      setNotes(prev => [{ ...note, tags: [] }, ...prev]);
      setSelectedNoteId(note.id);
      setNoteTab('notes');
      setEditingNote({ ...note, tags: [] });
    } catch (e) { console.error('Create note error:', e); }
  };

  const saveNote = async (noteId, title, content, tagIds, created_at = undefined) => {
    try {
      const updated = await api(`notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, content, tags: tagIds, created_at }),
      });
      setNotes(prev => prev.map(n => n.id === noteId ? {
        ...updated,
        content: n.content,
        title: n.title,
        summary: n.summary ?? updated.summary,
        ai_action_items: n.ai_action_items ?? updated.ai_action_items,
      } : n));
      // Preserve AI fields managed by their own API calls — saveNote only touches title/content/tags
      setEditingNote(prev => prev?.id === noteId ? {
        ...updated,
        content: prev.content,
        title: prev.title,
        summary: prev.summary,
        ai_action_items: prev.ai_action_items,
        transcript: prev.transcript,
        transcript_status: prev.transcript_status,
      } : prev);
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

  const handleNoteContentUpdate = (noteId, title, content, tagIds, created_at) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    // Optimistic update for created_at if provided
    if (created_at) {
      if (editingNote && editingNote.id === noteId) {
        setEditingNote(prev => ({ ...prev, created_at }));
      }
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, created_at } : n));
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveNote(noteId, title, content, tagIds, created_at);
    }, 1500);
  };

  // ===== TRANSCRIPT OPERATIONS =====
  const handleTranscriptReady = useCallback(async (transcript) => {
    if (!editingNote) return;
    const noteId = editingNote.id;
    // Optimistic local update
    setEditingNote(prev => ({ ...prev, transcript, transcript_status: 'done' }));
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, transcript, transcript_status: 'done' } : n));
    // Switch to transcript tab so the user can review the transcript
    setNoteTab('transcript');
    // Persist transcript to DB
    try {
      await api(`notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ transcript, transcript_status: 'done' }),
      });
    } catch (e) {
      console.error('Failed to save transcript:', e);
      toast.error('Could not save transcript');
    }
    toast.success('Transcript ready — go to Summary tab to generate an AI summary');
  }, [editingNote]);

  const retrySummary = useCallback(async () => {
    if (!editingNote?.transcript) return;
    const noteId = editingNote.id;
    const transcript = editingNote.transcript;
    setIsGeneratingSummary(true);
    toast('Generating AI summary…', { duration: 5000 });
    try {
      const result = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      if (!result.ok) throw new Error(await result.text());
      const { sections, action_items } = await result.json();
      // Persist to DB FIRST — use the server response to set local state so UI always matches DB
      let saved;
      try {
        saved = await api(`notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ summary: sections, ai_action_items: action_items }) });
      } catch (e) {
        console.error('Failed to persist summary:', e);
        toast.error('Failed to save summary. Please try again.');
        return;
      }
      // Use sections/action_items (actual arrays) for display — saved provides all other DB fields
      setEditingNote(prev => prev?.id === noteId ? { ...saved, summary: sections, ai_action_items: action_items, content: prev.content, title: prev.title } : prev);
      setNotes(prev => prev.map(n => n.id === noteId ? { ...saved, summary: sections, ai_action_items: action_items, content: n.content, title: n.title } : n));
      toast.success('AI summary ready');
    } catch (e) {
      console.error('Failed to generate summary:', e);
      toast.error(`AI summary failed: ${e.message}`);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [editingNote]);

  const claimAiActionItem = useCallback(async (itemId) => {
    if (!editingNote) return;
    const noteId = editingNote.id;
    const items = editingNote.ai_action_items || [];
    const item = items.find(i => i.id === itemId);
    if (!item || item.claimed) return;
    // Create real todo linked to this note.
    // skipContentUpdate: AI-claimed todos are tracked in ai_action_items, not in editor content.
    // Without this flag the server inserts a checkbox into the note, but editingNote.content
    // doesn't know about it, so the next saveNote would archive the todo immediately.
    const todo = await createTodo(item.text, noteId, editingNote.tags?.map(t => t.id) || [], { skipNoteReload: true, skipContentUpdate: true });
    // Even if todo response is missing (network hiccup), the todo was likely created in DB.
    // Mark claimed regardless and store the id if we have it.
    toast.success('Added to your To-Do list');
    const updated = items.map(i => i.id === itemId ? { ...i, claimed: true, todo_id: todo?.id || null } : i);
    setEditingNote(prev => ({ ...prev, ai_action_items: updated }));
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ai_action_items: updated } : n));
    try {
      await api(`notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ ai_action_items: updated }) });
    } catch (e) { console.error('Failed to update ai_action_items:', e); }
  }, [editingNote]);

  const unclaimAiActionItem = useCallback(async (itemId) => {
    if (!editingNote) return;
    const noteId = editingNote.id;
    const items = editingNote.ai_action_items || [];
    const item = items.find(i => i.id === itemId);
    if (!item || !item.claimed) return;
    // Delete the linked todo — use todo_id if available, else fall back to matching by text+note
    let todoIdToDelete = item.todo_id;
    if (!todoIdToDelete) {
      const match = todos.find(t => t.note_id === noteId && t.text === item.text);
      todoIdToDelete = match?.id || null;
    }
    if (todoIdToDelete) {
      try {
        await api(`todos/${todoIdToDelete}`, { method: 'DELETE' });
        setTodos(prev => prev.filter(t => t.id !== todoIdToDelete));
      } catch (e) { console.error('Failed to delete todo:', e); }
    }
    // Refresh todos panel count
    loadTodos();
    // Reset to unclaimed
    const updated = items.map(i => i.id === itemId ? { ...i, claimed: false, todo_id: null } : i);
    setEditingNote(prev => ({ ...prev, ai_action_items: updated }));
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ai_action_items: updated } : n));
    try {
      await api(`notes/${noteId}`, { method: 'PUT', body: JSON.stringify({ ai_action_items: updated }) });
    } catch (e) { console.error('Failed to update ai_action_items:', e); }
  }, [editingNote, todos, loadTodos]);

  const handleTranscriptChange = useCallback(async (newTranscript) => {
    if (!editingNote) return;
    const noteId = editingNote.id;
    setEditingNote(prev => ({ ...prev, transcript: newTranscript }));
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, transcript: newTranscript } : n));
    try {
      await api(`notes/${noteId}`, {
        method: 'PUT',
        body: JSON.stringify({ transcript: newTranscript }),
      });
    } catch (e) {
      console.error('Failed to update transcript:', e);
    }
  }, [editingNote]);

  // ===== TODO OPERATIONS =====
  const createTodo = async (text, noteId, tagIds, options = {}) => {
    try {
      const maxPosition = todos.reduce((max, t) => Math.max(max, t.position || 0), 0);
      const position = maxPosition + 1;

      const todo = await api('todos', {
        method: 'POST',
        body: JSON.stringify({ text, note_id: noteId || null, tag_ids: tagIds || [], position, due_date: options.due_date || null, content: options.content || null, skip_content_update: options.skipContentUpdate || false }),
      });
      setTodos(prev => [...prev, todo]);
      setNewTodoText('');
      if (noteId && !options.skipNoteReload) loadNotes();
      return todo;
    } catch (e) { console.error('Create todo error:', e); }
  };

  const updateTodo = async (todoId, updates) => {
    try {
      const todo = await api(`todos/${todoId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setTodos(prev => prev.map(t => t.id === todoId ? { ...todo, content: t.content, text: t.text } : t));
      if (todo.note_id) loadNotes();

      if (updates.is_done === true && todo.is_done) {
        toast('Action marked as done', {
          duration: 10000,
          action: {
            label: 'Undo',
            onClick: () => updateTodo(todoId, { is_done: false }),
          },
        });
      }
    } catch (e) { console.error('Update todo error:', e); }
  };

  const handleTodoContentUpdate = (todoId, content) => {
    if (todoSaveTimeoutRef.current) clearTimeout(todoSaveTimeoutRef.current);
    todoSaveTimeoutRef.current = setTimeout(() => {
      updateTodo(todoId, { content });
    }, 1500);
  };

  const toggleTodo = async (todoId) => {
    try {
      const todo = await api(`todos/${todoId}/toggle`, { method: 'PATCH', body: '{}' });
      setTodos(prev => prev.map(t => {
        if (t.id === todoId) return { ...t, ...todo };
        if (t.parent_todo_id === todoId && todo.is_done) return { ...t, is_done: true, done_at: new Date().toISOString() };
        return t;
      }));
      // Sync is_done into editingNote.ai_action_items so Summary tab reflects done state.
      // Use text-based fallback in case todo_id wasn't stored (network hiccup during claim).
      if (editingNote?.ai_action_items) {
        const todoText = todos.find(t => t.id === todoId)?.text?.trim().toLowerCase();
        const matchFn = (i) => i.todo_id === todoId || (todoText && i.claimed && i.text?.trim().toLowerCase() === todoText);
        if (editingNote.ai_action_items.some(matchFn)) {
          const updatedAiItems = editingNote.ai_action_items.map(i =>
            matchFn(i) ? { ...i, is_done: todo.is_done } : i
          );
          setEditingNote(prev => prev?.id === editingNote.id ? { ...prev, ai_action_items: updatedAiItems } : prev);
          // Also update notes array so navigating away and back preserves the done state
          setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, ai_action_items: updatedAiItems } : n));
          // Await so loadNotes() below doesn't race and overwrite with stale DB data
          await api(`notes/${editingNote.id}`, { method: 'PUT', body: JSON.stringify({ ai_action_items: updatedAiItems }) })
            .catch(e => console.error('Failed to sync ai_action_items is_done:', e));
        }
      }
      if (todo.is_done) {
        toast('Action marked as done', {
          duration: 10000,
          action: {
            label: 'Undo',
            onClick: () => toggleTodo(todoId),
          },
        });
      }
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
        body: JSON.stringify({ name: newTagName.trim(), type: newTagType, color: newTagColor }),
      });
      if (newTagType === 'source') {
        setSourceTags(prev => [...prev, tag]);
      } else {
        setProjectTags(prev => [...prev, tag]);
      }
      setNewTagName('');
      setShowTagForm(false);
    } catch (e) { console.error('Create tag error:', e); }
  };

  const deleteTag = async (tagId, tagType) => {
    try {
      await api(`tags/${tagId}`, { method: 'DELETE' });
      if (tagType === 'source') {
        setSourceTags(prev => prev.filter(t => t.id !== tagId));
      } else {
        setProjectTags(prev => prev.filter(t => t.id !== tagId));
      }
      if (selectedTagIds.includes(tagId)) setSelectedTagIds([]);
      // Reload notes and todos since their tag associations changed
      loadNotes();
      loadTodos();
      loadArchivedTags();
    } catch (e) { console.error('Delete tag error:', e); }
  };

  const updateTagDetails = async (tagId, name, color, tagType) => {
    try {
      const updated = await api(`tags/${tagId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, color }),
      });
      if (tagType === 'source') {
        setSourceTags(prev => prev.map(t => t.id === tagId ? updated : t));
      } else {
        setProjectTags(prev => prev.map(t => t.id === tagId ? updated : t));
      }
      setEditingTagId(null);
      // Reload notes/todos so inline tag badges update
      loadNotes();
      loadTodos();
    } catch (e) { console.error('Update tag error:', e); }
  };

  const archiveTag = async (tagId, tagType) => {
    try {
      await api(`tags/${tagId}`, {
        method: 'PUT',
        body: JSON.stringify({ archived: true }),
      });
      if (tagType === 'source') {
        setSourceTags(prev => prev.filter(t => t.id !== tagId));
      } else {
        setProjectTags(prev => prev.filter(t => t.id !== tagId));
      }
      if (selectedTagIds.includes(tagId)) setSelectedTagIds([]);
      setTagMenuId(null);
      loadArchivedTags();
    } catch (e) { console.error('Archive tag error:', e); }
  };

  const unarchiveTag = async (tagId) => {
    try {
      await api(`tags/${tagId}`, {
        method: 'PUT',
        body: JSON.stringify({ archived: false }),
      });
      setArchivedTags(prev => prev.filter(t => t.id !== tagId));
      // Reload active tags
      loadSourceTags();
      loadProjectTags();
    } catch (e) { console.error('Unarchive tag error:', e); }
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

  const createTagInline = async (noteId) => {
    if (!newInlineTagName.trim()) return;
    try {
      const color = newInlineTagColor || RANDOM_TAG_COLORS[Math.floor(Math.random() * RANDOM_TAG_COLORS.length)];
      const tag = await api('tags', {
        method: 'POST',
        body: JSON.stringify({ name: newInlineTagName.trim(), type: 'source', color }),
      });
      setSourceTags(prev => [...prev, tag]);
      await api('note-tags', { method: 'POST', body: JSON.stringify({ note_id: noteId, tag_id: tag.id }) });
      setNewInlineTagName('');
      setNewInlineTagColor(null);
      loadNotes();
      const updated = await api(`notes/${noteId}`);
      setEditingNote(updated);
    } catch (e) { console.error('Create inline tag error:', e); }
  };

  const toggleTodoTag = async (todoId, tagId) => {
    const todo = todos.find(t => t.id === todoId);
    const hasTag = todo?.tags?.some(t => t.id === tagId);
    if (hasTag) {
      await api(`todo-tags/${todoId}/${tagId}`, { method: 'DELETE' });
    } else {
      await api('todo-tags', { method: 'POST', body: JSON.stringify({ todo_id: todoId, tag_id: tagId }) });
    }
    loadTodos();
  };

  const createProjectTagInline = async (todoId, tagName, tagColor) => {
    const name = tagName || newInlineProjectTagName;
    if (!name.trim()) return;
    try {
      const color = tagColor || newInlineProjectTagColor || RANDOM_TAG_COLORS[Math.floor(Math.random() * RANDOM_TAG_COLORS.length)];
      const tag = await api('tags', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type: 'project', color }),
      });
      setProjectTags(prev => [...prev, tag]);
      await api('todo-tags', { method: 'POST', body: JSON.stringify({ todo_id: todoId, tag_id: tag.id }) });
      setNewInlineProjectTagName('');
      setNewInlineProjectTagColor(null);
      loadTodos();
    } catch (e) { console.error('Create inline project tag error:', e); }
  };

  const createProjectTag = async (name, color) => {
    if (!name.trim()) return null;
    try {
      const c = color || RANDOM_TAG_COLORS[Math.floor(Math.random() * RANDOM_TAG_COLORS.length)];
      const tag = await api('tags', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type: 'project', color: c }),
      });
      setProjectTags(prev => [...prev, tag]);
      return tag;
    } catch (e) { console.error('Create project tag error:', e); return null; }
  };

  // ===== REORDER NOTE GROUPS (source tags + inbox) =====
  const [noteGroupOrder, setNoteGroupOrder] = useState([]);
  const reorderNoteGroups = async (activeId, overId) => {
    // Build current order from sourceTags + __untagged if not set
    const currentOrder = noteGroupOrder.length > 0 ? noteGroupOrder : [...sourceTags.map(t => t.id), '__untagged'];
    const oldIndex = currentOrder.indexOf(activeId);
    const newIndex = currentOrder.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    setNoteGroupOrder(newOrder);
    // Also reorder sourceTags to match (excluding __untagged)
    const tagOrder = newOrder.filter(id => id !== '__untagged');
    const newTags = tagOrder.map(id => sourceTags.find(t => t.id === id)).filter(Boolean);
    setSourceTags(newTags);
    try {
      await api('tags/batch-reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds: tagOrder })
      });
    } catch (e) {
      console.error('Source tag reorder error:', e);
      loadSourceTags();
    }
  };

  // ===== DRAG & DROP =====
  const handleDragStart = (event) => {
    const { active } = event;
    const type = active.data.current?.type;

    if (type === 'projectGroup') {
      setActiveDragGroup(active.data.current.group);
      setActiveDragTodo(null);
    } else {
      const todo = todos.find(t => t.id === active.id);
      setActiveDragTodo(todo || null);
      setActiveDragGroup(null);
    }
  };

  const handleDragEnd = async (event) => {
    setActiveDragTodo(null);
    setActiveDragGroup(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const type = active.data.current?.type;

    if (type === 'projectGroup') {
      const oldIndex = projectTags.findIndex(t => t.id === active.id);
      const newIndex = projectTags.findIndex(t => t.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newTags = [...projectTags];
      const [movedTag] = newTags.splice(oldIndex, 1);
      newTags.splice(newIndex, 0, movedTag);

      // Optimistic update
      setProjectTags(newTags);

      try {
        await api('tags/batch-reorder', {
          method: 'POST',
          body: JSON.stringify({ orderedIds: newTags.map(t => t.id) })
        });
      } catch (e) {
        console.error('Group reorder error:', e);
        loadProjectTags(); // Re-sync on failure
      }
      return;
    }

    const todoTree = buildTodoTree(todos);
    const groups = groupTodos(todoTree, todoGroupBy);

    // Find source and destination groups
    let sourceGroup = null, destGroup = null;
    for (const group of groups) {
      if (group.todos.some(t => t.id === active.id)) sourceGroup = group;
      if (group.todos.some(t => t.id === over.id)) destGroup = group;
    }

    if (!sourceGroup || !destGroup) return;

    if (sourceGroup.key === destGroup.key) {
      // Same group: reorder while preserving other items' exact global positions
      const oldIndex = sourceGroup.todos.findIndex(t => t.id === active.id);
      const newIndex = sourceGroup.todos.findIndex(t => t.id === over.id);
      const reorderedGroupTodos = arrayMove(sourceGroup.todos, oldIndex, newIndex);

      // Get the original global indices (slots) of these group items
      const globalIndices = sourceGroup.todos
        .map(t => todos.findIndex(gt => gt.id === t.id))
        .sort((a, b) => a - b);

      // Plop the reordered group items exactly back into their original global slots
      const newTodos = [...todos];
      for (let i = 0; i < globalIndices.length; i++) {
        newTodos[globalIndices[i]] = reorderedGroupTodos[i];
      }

      const allOrderedIds = newTodos.map(t => t.id);

      // Optimistically update positions and UI flat list
      setTodos(newTodos.map((t, idx) => ({ ...t, position: idx })));

      try {
        await api('todos/batch-reorder', {
          method: 'POST',
          body: JSON.stringify({ orderedIds: allOrderedIds }),
        });
      } catch (e) { console.error('Reorder error:', e); loadTodos(); }

    } else {
      // Different group: move between groups (only supports project tag transfer)
      if (todoGroupBy === 'project') {
        const activeTodo = todos.find(t => t.id === active.id);

        // Determine new project tag from dest group
        let newProjectTagId = null;
        if (destGroup.key !== '__untagged') {
          const destTodo = destGroup.todos.find(t => t.id !== active.id);
          const destProjectTag = destTodo?.tags?.find(t => t.type === 'project');
          newProjectTagId = destProjectTag?.id || destGroup.key;
        }

        const newTags = (activeTodo.tags || []).filter(tag => tag.type !== 'project');
        if (newProjectTagId) {
          const newTag = projectTags.find(pt => pt.id === newProjectTagId);
          if (newTag) newTags.push(newTag);
        }

        // Isolate and move dragged item's position relative strictly to the single target it dropped on
        const flatIds = todos.map(t => t.id);
        const activeGlobalIdx = flatIds.indexOf(active.id);
        flatIds.splice(activeGlobalIdx, 1); // Extract active item

        const overGlobalIdx = flatIds.indexOf(over.id);
        flatIds.splice(overGlobalIdx, 0, active.id); // Insert before 'over' item

        // Optimistic UI Update 
        setTodos(prev => {
          const map = {};
          prev.forEach(t => map[t.id] = t);
          map[active.id] = { ...map[active.id], tags: newTags };
          return flatIds.map((id, index) => ({ ...map[id], position: index }));
        });

        try {
          // Push Tag Change First
          await api(`todos/${active.id}`, {
            method: 'PUT',
            body: JSON.stringify({ tags: newTags.map(t => t.id) })
          });

          // Execute Full Reorder Backup
          await api('todos/batch-reorder', {
            method: 'POST',
            body: JSON.stringify({ orderedIds: flatIds }),
          });
          loadTodos();
        } catch (e) { console.error('Reorder error:', e); loadTodos(); }
      }
    }
  };

  // ===== NAVIGATE TO NOTE FROM TODO =====
  const navigateToNote = async (noteId) => {
    try {
      setView('notebook');
      setSearchQuery('');
      setSelectedTagIds([]);
      const noteData = await api(`notes/${noteId}`);
      setSelectedNoteId(noteId);
      setNoteTab('notes');
      setEditingNote(noteData);
      await loadNotes();
    } catch (e) { console.error('Navigate to note error:', e); }
  };

  // ===== MEMOIZED: groupTodos wrapper =====
  const groupTodos = useCallback((tree, groupBy) => {
    return groupTodosHelper(tree, groupBy, projectTags);
  }, [projectTags]);

  // ===== MEMOIZED: Filtered todos, tree, and groups =====
  const localFilteredTodos = useMemo(() => {
    return todos.filter(t => {
      if (todoFilters.length > 0) {
        const isOpen = !t.is_done && !t.archived_at;
        const isDone = t.is_done && !t.archived_at;
        const isArchived = !!t.archived_at;
        const matchesStatus =
          (todoFilters.includes('open') && isOpen) ||
          (todoFilters.includes('done') && isDone) ||
          (todoFilters.includes('archived') && isArchived);
        if (!matchesStatus) return false;
      }
      if (todoProjectFilterIds.length > 0) {
        const projectTag = t.tags?.find(tag => tag.type === 'project');
        const projectId = projectTag ? projectTag.id : '__untagged';
        if (!todoProjectFilterIds.includes(projectId)) return false;
      }
      if (todoDateFilter.length > 0) {
        const dueDate = t.due_date ? t.due_date.split('T')[0] : null;
        if (!dueDate) return todoDateFilter.includes('no_date');
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
        const thisWeekStart = new Date(now); thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek);
        const thisWeekEnd = new Date(thisWeekStart); thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);
        const nextWeekStart = new Date(thisWeekEnd); nextWeekStart.setDate(nextWeekStart.getDate() + 1);
        const nextWeekEnd = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
        const fmt = d => d.toISOString().split('T')[0];
        const matchesDate =
          (todoDateFilter.includes('past_due') && dueDate < todayStr) ||
          (todoDateFilter.includes('today') && dueDate === todayStr) ||
          (todoDateFilter.includes('tomorrow') && dueDate === tomorrowStr) ||
          (todoDateFilter.includes('this_week') && dueDate >= fmt(thisWeekStart) && dueDate <= fmt(thisWeekEnd)) ||
          (todoDateFilter.includes('next_week') && dueDate >= fmt(nextWeekStart) && dueDate <= fmt(nextWeekEnd)) ||
          (todoDateFilter.includes('no_date') && !dueDate);
        if (!matchesDate) return false;
      }
      if (todoDateRangeFrom || todoDateRangeTo) {
        const dueDate = t.due_date ? t.due_date.split('T')[0] : null;
        if (!dueDate) return false;
        let dFrom = todoDateRangeFrom, dTo = todoDateRangeTo;
        if (dFrom && dTo && dFrom > dTo) { [dFrom, dTo] = [dTo, dFrom]; }
        if (dFrom && dueDate < dFrom) return false;
        if (dTo && dueDate > dTo) return false;
      }
      if (todoCreatedFilter.length > 0 || todoCreatedRangeFrom || todoCreatedRangeTo) {
        const createdDate = t.created_at ? t.created_at.split('T')[0] : null;
        if (!createdDate) return false;
        if (todoCreatedFilter.length > 0) {
          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
          const thisWeekStart = new Date(now); thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek);
          const fmt = d => d.toISOString().split('T')[0];
          const match = todoCreatedFilter.some(f =>
            (f === 'today' && createdDate === todayStr) ||
            (f === 'yesterday' && createdDate === yesterdayStr) ||
            (f === 'this_week' && createdDate >= fmt(thisWeekStart) && createdDate <= todayStr)
          );
          if (!match) return false;
        }
        let cFrom = todoCreatedRangeFrom, cTo = todoCreatedRangeTo;
        if (cFrom && cTo && cFrom > cTo) { [cFrom, cTo] = [cTo, cFrom]; }
        if (cFrom && createdDate < cFrom) return false;
        if (cTo && createdDate > cTo) return false;
      }
      return true;
    });
  }, [todos, todoFilters, todoProjectFilterIds, todoDateFilter, todoDateRangeFrom, todoDateRangeTo, todoCreatedFilter, todoCreatedRangeFrom, todoCreatedRangeTo]);

  const todoTree = useMemo(() => buildTodoTree(localFilteredTodos), [localFilteredTodos]);
  const todoGroups = useMemo(() => groupTodos(todoTree, todoGroupBy), [todoTree, todoGroupBy, groupTodos]);

  // ===== Stable TodoItemRow props object =====
  const todoItemRowProps = useMemo(() => ({
    editingTodoId, setEditingTodoId, setEditingTodoText, expandedTodos, setExpandedTodos,
    toggleTodo, todoVisibleFields, todoGroupBy, todoTagPickerId, setTodoTagPickerId,
    navigateToNote, archiveTodo, deleteTodo, newInlineProjectTagName, setNewInlineProjectTagName,
    newInlineProjectTagColor, setNewInlineProjectTagColor, createProjectTagInline, toggleTodoTag, projectTags
  }), [editingTodoId, expandedTodos, toggleTodo, todoVisibleFields, todoGroupBy, todoTagPickerId, navigateToNote, archiveTodo, deleteTodo, newInlineProjectTagName, newInlineProjectTagColor, createProjectTagInline, toggleTodoTag, projectTags]);

  // ===== Wrapped TodoItemRow that injects shared props =====
  const TodoItemRowWrapped = useCallback(({ todo, depth }) => (
    <TodoItemRow todo={todo} depth={depth} {...todoItemRowProps} />
  ), [todoItemRowProps]);

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

  return (
    <>
      <TooltipProvider delayDuration={150}>
        <div className="min-h-screen flex bg-background">
          {/* ===== SIDEBAR ===== */}
          <Sidebar
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            view={view}
            setView={setView}
            setSearchQuery={setSearchQuery}
            setSelectedTagIds={setSelectedTagIds}
            notebookSavedViews={notebookSavedViews}
            todoSavedViews={todoSavedViews}
            activeNotebookViewId={activeNotebookViewId}
            activeTodoViewId={activeTodoViewId}
            onApplyNotebookView={applyNotebookView}
            onApplyTodoView={applyTodoView}
            onSaveNotebookView={saveCurrentNotebookView}
            onSaveTodoView={saveCurrentTodoView}
            onRenameNotebookView={renameNotebookView}
            onRenameTodoView={renameTodoView}
            onUpdateNotebookView={updateNotebookSavedView}
            onUpdateTodoView={updateTodoSavedView}
            onDeleteNotebookView={deleteNotebookView}
            onDeleteTodoView={deleteTodoView}
            onLogout={handleLogout}
          />

          {/* ===== MAIN CONTENT ===== */}
          <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
            {/* ===== TOP BAR ===== */}
            <TopNavBar
              view={view}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              noteMeetingFilterOpen={noteMeetingFilterOpen}
              setNoteMeetingFilterOpen={setNoteMeetingFilterOpen}
              noteMeetingFilters={noteMeetingFilters}
              setNoteMeetingFilters={setNoteMeetingFilters}
              noteStatusFilters={noteStatusFilters}
              setNoteStatusFilters={setNoteStatusFilters}
              sourceTags={sourceTags}
              setSelectedTagIds={setSelectedTagIds}
              noteDateFilter={noteDateFilter}
              setNoteDateFilter={setNoteDateFilter}
              noteGroupBy={noteGroupBy}
              setNoteGroupBy={setNoteGroupBy}
              viewLayout={viewLayout}
              setViewLayout={setViewLayout}
              todoStatusFilterOpen={todoStatusFilterOpen}
              setTodoStatusFilterOpen={setTodoStatusFilterOpen}
              todoFilters={todoFilters}
              setTodoFilters={setTodoFilters}
              todoProjectFilterOpen={todoProjectFilterOpen}
              setTodoProjectFilterOpen={setTodoProjectFilterOpen}
              todoProjectFilterIds={todoProjectFilterIds}
              setTodoProjectFilterIds={setTodoProjectFilterIds}
              projectTags={projectTags}
              todoDateFilter={todoDateFilter}
              setTodoDateFilter={setTodoDateFilter}
              todoDateRangeFrom={todoDateRangeFrom}
              setTodoDateRangeFrom={setTodoDateRangeFrom}
              todoDateRangeTo={todoDateRangeTo}
              setTodoDateRangeTo={setTodoDateRangeTo}
              todoCreatedFilter={todoCreatedFilter}
              setTodoCreatedFilter={setTodoCreatedFilter}
              todoCreatedRangeFrom={todoCreatedRangeFrom}
              setTodoCreatedRangeFrom={setTodoCreatedRangeFrom}
              todoCreatedRangeTo={todoCreatedRangeTo}
              setTodoCreatedRangeTo={setTodoCreatedRangeTo}
              todoGroupBy={todoGroupBy}
              setTodoGroupBy={setTodoGroupBy}
              collapsedGroups={collapsedGroups}
              setCollapsedGroups={setCollapsedGroups}
              groupTodos={groupTodos}
              todoTree={todoTree}
              createNote={createNote}
              hiddenBoardGroups={hiddenBoardGroups}
              setHiddenBoardGroups={setHiddenBoardGroups}
              noteVisibleFields={noteVisibleFields}
              setNoteVisibleFields={setNoteVisibleFields}
              todoVisibleFields={todoVisibleFields}
              setTodoVisibleFields={setTodoVisibleFields}
              boardColumnSize={boardColumnSize}
              setBoardColumnSize={handleSetBoardColumnSize}
            />
            {/* ===== CONTENT AREA ===== */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* ===== MIDDLE: Notes/Todos Browser/Tags ===== */}
              {view === 'tags' ? (
                /* ===== TAGS MANAGEMENT VIEW ===== */
                <TagsManagement
                  sourceTags={sourceTags}
                  projectTags={projectTags}
                  archivedTags={archivedTags}
                  showTagForm={showTagForm}
                  setShowTagForm={setShowTagForm}
                  newTagType={newTagType}
                  setNewTagType={setNewTagType}
                  newTagName={newTagName}
                  setNewTagName={setNewTagName}
                  newTagColor={newTagColor}
                  setNewTagColor={setNewTagColor}
                  createTag={createTag}
                  TAG_COLORS={TAG_COLORS}
                  tagMenuId={tagMenuId}
                  setTagMenuId={setTagMenuId}
                  editingTagId={editingTagId}
                  setEditingTagId={setEditingTagId}
                  editingTagName={editingTagName}
                  setEditingTagName={setEditingTagName}
                  editingTagColor={editingTagColor}
                  setEditingTagColor={setEditingTagColor}
                  updateTagDetails={updateTagDetails}
                  archiveTag={archiveTag}
                  deleteTag={deleteTag}
                  showArchivedTags={showArchivedTags}
                  setShowArchivedTags={setShowArchivedTags}
                  loadArchivedTags={loadArchivedTags}
                  unarchiveTag={unarchiveTag}
                  searchQuery={searchQuery}
                />
              ) : (
                <div className={`h-full overflow-auto transition-all duration-300 ${view === 'notebook' && selectedNoteId ? (focusMode ? 'hidden' : 'w-[40%] min-w-[300px] border-r border-border/50 bg-muted/10') : view === 'todos' && editingTodoId ? (focusMode ? 'hidden' : 'w-[65%] min-w-[400px] border-r border-border/50 bg-muted/10') : 'flex-1'}`}>
                  <div className={`p-6 ${viewLayout === 'board' ? '' : 'max-w-4xl'} mx-auto`}>
                    {view === 'notebook' ? (
                      /* ===== NOTEBOOK VIEW ===== */
                      <NotesBrowser
                        notes={notes}
                        loading={loading}
                        noteDateFilter={noteDateFilter}
                        noteGroupBy={noteGroupBy}
                        viewLayout={viewLayout}
                        selectedNoteId={selectedNoteId}
                        setSelectedNoteId={setSelectedNoteId}
                        setEditingNote={async (note) => {
                          if (editingNote?.id === note.id) return;
                          try {
                            const full = await api(`notes/${note.id}`);
                            setEditingNote(full);
                          } catch (e) {
                            setEditingNote(note); // fallback to cached version
                          }
                        }}
                        setTagDropdownNoteId={setTagDropdownNoteId}
                        formatDate={formatDate}
                        extractActionItems={extractActionItems}
                        createNote={createNote}
                        noteTotal={noteTotal}
                        noteOffset={noteOffset}
                        loadMoreNotes={loadMoreNotes}
                        sourceTags={sourceTags}
                        tagDropdownNoteId={tagDropdownNoteId}
                        newInlineTagName={newInlineTagName}
                        setNewInlineTagName={setNewInlineTagName}
                        createTagInline={createTagInline}
                        newInlineTagColor={newInlineTagColor}
                        setNewInlineTagColor={setNewInlineTagColor}
                        RANDOM_TAG_COLORS={RANDOM_TAG_COLORS}
                        toggleNoteTag={toggleNoteTag}
                        visibleFields={noteVisibleFields}
                        getContentPreview={getContentPreview}
                        collapsedGroups={collapsedNoteGroups}
                        setCollapsedGroups={setCollapsedNoteGroups}
                        reorderNoteGroups={reorderNoteGroups}
                        noteGroupOrder={noteGroupOrder}
                        boardColumnSize={boardColumnSize}
                        noteMeetingFilters={noteMeetingFilters}
                        setNoteMeetingFilters={setNoteMeetingFilters}
                      />
                    ) : (
                      /* ===== TODO VIEW ===== */
                      <TodosBrowser
                        todoTree={todoTree}
                        todoGroupBy={todoGroupBy}
                        viewLayout={viewLayout}
                        groupTodos={groupTodos}
                        sensors={sensors}
                        handleDragStart={handleDragStart}
                        handleDragEnd={handleDragEnd}
                        groups={todoGroups}
                        SortableGroupHeader={SortableGroupHeader}
                        TodoItemRow={TodoItemRowWrapped}
                        updateTodo={updateTodo}
                        createTodo={createTodo}
                        inlineAddingGroupId={inlineAddingGroupId}
                        setInlineAddingGroupId={setInlineAddingGroupId}
                        inlineTodoText={inlineTodoText}
                        setInlineTodoText={setInlineTodoText}
                        collapsedGroups={collapsedGroups}
                        setCollapsedGroups={setCollapsedGroups}
                        activeDragGroup={activeDragGroup}
                        activeDragTodo={activeDragTodo}
                        editingTodoId={editingTodoId}
                        setEditingTodoId={setEditingTodoId}
                        extractActionItems={extractActionItems}
                        hiddenBoardGroups={hiddenBoardGroups}
                        setHiddenBoardGroups={setHiddenBoardGroups}
                        todoTotal={todoTotal}
                        todoOffset={todoOffset}
                        loadMoreTodos={loadMoreTodos}
                        setEditingTodoText={setEditingTodoText}
                        visibleFields={todoVisibleFields}
                        boardColumnSize={boardColumnSize}
                        toggleTodoTag={toggleTodoTag}
                        projectTags={projectTags}
                        createProjectTagInline={createProjectTagInline}
                        newInlineProjectTagName={newInlineProjectTagName}
                        setNewInlineProjectTagName={setNewInlineProjectTagName}
                        newInlineProjectTagColor={newInlineProjectTagColor}
                        setNewInlineProjectTagColor={setNewInlineProjectTagColor}
                        RANDOM_TAG_COLORS={RANDOM_TAG_COLORS}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ===== RIGHT: Note Editor Panel ===== */}
              {view === 'notebook' && selectedNoteId && editingNote && (
                <div className={`${focusMode ? 'flex-1' : 'w-[60%]'} border-l bg-background flex flex-col h-full flex-shrink-0 min-h-0 transition-all duration-300`}>
                  {/* Panel Header: timestamp + tags + close */}
                  <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20 flex-shrink-0">
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                        <Clock size={11} />
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="font-medium hover:text-foreground transition-colors outline-none">
                              {formatDate(editingNote.created_at)}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="start">
                            <div className="flex items-center justify-between mb-3 px-1">
                              <span className="text-sm font-medium">
                                {new Date(editingNote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' }).replace(/\//g, '.')}
                              </span>
                              <div className="flex items-center gap-2">
                                {/* <span className="text-sm text-muted-foreground">Jetzt</span> */}
                                <select
                                  value={formatDate(editingNote.created_at).split(', ')[2] || ''}
                                  onChange={(e) => {
                                    const [hours, minutes] = e.target.value.split(':');
                                    const newDate = new Date(editingNote.created_at);
                                    newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                                    handleNoteContentUpdate(editingNote.id, editingNote.title, editingNote.content, editingNote.tags?.map(t => t.id) || [], newDate.toISOString());
                                  }}
                                  className="bg-muted/50 border rounded text-xs font-medium text-foreground cursor-pointer hover:bg-muted focus:ring-1 focus:ring-primary p-1 outline-none"
                                >
                                  {Array.from({ length: 24 * 4 }).map((_, i) => {
                                    const h = Math.floor(i / 4).toString().padStart(2, '0');
                                    const m = ((i % 4) * 15).toString().padStart(2, '0');
                                    const timeStr = `${h}:${m}`;
                                    return <option key={timeStr} value={timeStr}>{timeStr}</option>;
                                  })}
                                </select>
                              </div>
                            </div>
                            <Separator className="mb-3" />
                            <Calendar
                              mode="single"
                              selected={new Date(editingNote.created_at)}
                              onSelect={(date) => {
                                if (!date) return;
                                const newDate = new Date(editingNote.created_at);
                                date.setHours(newDate.getHours(), newDate.getMinutes(), 0, 0);
                                handleNoteContentUpdate(editingNote.id, editingNote.title, editingNote.content, editingNote.tags?.map(t => t.id) || [], date.toISOString());
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </span>
                      {editingNote.tags?.map(tag => (
                        <span
                          key={tag.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 flex-shrink-0"
                          style={{ backgroundColor: tag.color + '20', color: tag.color }}
                        >
                          {tag.name}
                          <button
                            onClick={() => toggleNoteTag(editingNote.id, tag.id, editingNote.tags || [])}
                            className="hover:opacity-70"
                          >
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                      <div className="relative" ref={tagDropdownRef}>
                        <button
                          onClick={() => { setEditorTagDropdownNoteId(editorTagDropdownNoteId === editingNote.id ? null : editingNote.id); setNewInlineTagName(''); }}
                          className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center gap-0.5 flex-shrink-0"
                        >
                          <Tag size={8} /> Tag
                        </button>
                        {editorTagDropdownNoteId === editingNote.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setEditorTagDropdownNoteId(null)} />
                            <div className="absolute left-0 top-6 z-50 w-48 bg-popover border rounded-lg shadow-lg py-1" onClick={e => e.stopPropagation()}>
                              <div className="px-2 py-1.5 border-b">
                                <input
                                  type="text"
                                  value={newInlineTagName}
                                  onChange={e => setNewInlineTagName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') createTagInline(editingNote.id); }}
                                  placeholder="New tag name..."
                                  className="flex-1 text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring w-full"
                                  autoFocus
                                />
                                {newInlineTagName.trim() && (
                                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                    {RANDOM_TAG_COLORS.map(c => (
                                      <button key={c} onClick={() => setNewInlineTagColor(c)} className={`w-4 h-4 rounded-full border-2 transition-transform ${newInlineTagColor === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="max-h-40 overflow-y-auto py-1">
                                {sourceTags.length === 0 && (
                                  <p className="text-xs text-muted-foreground px-3 py-2 italic">No tags yet</p>
                                )}
                                {sourceTags.map(tag => {
                                  const hasTag = (editingNote.tags || []).some(t => t.id === tag.id);
                                  return (
                                    <button
                                      key={tag.id}
                                      onClick={() => toggleNoteTag(editingNote.id, tag.id, editingNote.tags || [])}
                                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2"
                                    >
                                      <div className={`w-3 h-3 rounded flex items-center justify-center border ${hasTag ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                                        {hasTag && <Check size={8} />}
                                      </div>
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                      <span className="truncate">{tag.name}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setFocusMode(!focusMode)}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 ml-2"
                      title={focusMode ? "Exit focus mode" : "Focus mode"}
                    >
                      {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                      onClick={() => { setSelectedNoteId(null); setEditingNote(null); setTagDropdownNoteId(null); setFocusMode(false); }}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      title="Close panel (ESC)"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Title row with formatting toggle */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
                    <Input
                      value={editingNote.title || ''}
                      onChange={e => {
                        const newTitle = e.target.value;
                        setEditingNote(prev => ({ ...prev, title: newTitle }));
                        setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, title: newTitle } : n));
                        handleNoteContentUpdate(editingNote.id, newTitle, editingNote.content, editingNote.tags?.map(t => t.id));
                      }}
                      placeholder="Note title"
                      className="border-none text-base font-semibold px-0 h-auto focus-visible:ring-0 shadow-none flex-1"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditorToolbarOpen(!editorToolbarOpen)}
                        className={`p-1 rounded-md transition-colors flex-shrink-0 ${editorToolbarOpen
                          ? 'bg-orange-100 text-orange-500'
                          : 'text-orange-400 hover:text-orange-500 hover:bg-orange-50'
                          }`}
                        title={editorToolbarOpen ? 'Hide formatting' : 'Show formatting'}
                      >
                        <Type size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowActionItems(!showActionItems)}
                        className={`p-1 rounded-md transition-colors flex-shrink-0 ${showActionItems
                          ? 'bg-orange-100 text-orange-500'
                          : 'text-orange-400 hover:text-orange-500 hover:bg-orange-50'
                          }`}
                        title={showActionItems ? 'Hide action items' : 'Show action items'}
                      >
                        <ListTodo size={14} />
                      </button>
                      <RecordingControls noteId={editingNote?.id} onTranscriptReady={handleTranscriptReady} />
                    </div>
                  </div>

                  {/* Collapsible Action Items Summary */}
                  {showActionItems && (
                    <div className="border-b bg-muted/20 px-4 py-3 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-orange-500">
                        <ListTodo size={12} />
                        Action Items
                      </div>
                      {(() => {
                        const editorItems = extractActionItems(editingNote.content);
                        const aiClaimed = (editingNote.ai_action_items || []).filter(i => i.claimed);
                        if (editorItems.length === 0 && aiClaimed.length === 0) {
                          return <p className="text-xs text-muted-foreground italic">No action items found in this note.</p>;
                        }
                        return (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {editorItems.map((item, idx) => (
                              <div key={`ed-${idx}`} className="flex items-start gap-2 text-[13px] leading-tight">
                                <span className="mt-0.5 text-muted-foreground/70 pointer-events-none">
                                  {item.isChecked ? <CheckSquare size={13} className="text-primary/70" /> : <div className="w-[13px] h-[13px] border rounded-[3px] border-muted-foreground/50" />}
                                </span>
                                <span className={`flex-1 ${item.isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                  {item.text || 'Empty task'}
                                </span>
                              </div>
                            ))}
                            {aiClaimed.map(item => {
                              const linkedTodo = item.todo_id ? todos.find(t => t.id === item.todo_id) : todos.find(t => t.note_id === editingNote.id && t.text === item.text);
                              const isDone = item.is_done ?? linkedTodo?.is_done ?? false;
                              return (
                                <div key={`ai-${item.id}`} className="flex items-start gap-2 text-[13px] leading-tight">
                                  <span className="mt-0.5 text-muted-foreground/70 pointer-events-none flex-shrink-0">
                                    {isDone
                                      ? <CheckSquare size={13} className="text-primary/70" />
                                      : <div className="w-[13px] h-[13px] border rounded-[3px] border-muted-foreground/50" />}
                                  </span>
                                  <span className={`flex-1 ${isDone ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                                    {item.text}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Tab switcher — always visible */}
                  <div className="flex items-center gap-0 px-4 border-b flex-shrink-0">
                    {[
                      { id: 'notes', label: 'Notes' },
                      { id: 'summary', label: 'Summary' },
                      { id: 'transcript', label: 'Transcript' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setNoteTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${noteTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        {tab.label}
                        {tab.id === 'summary' && isGeneratingSummary && (
                          <Loader2 size={10} className="animate-spin" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Editor area */}
                  <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 min-h-0">

                    {/* ── NOTES TAB ── */}
                    {noteTab === 'notes' && (
                      <>
                        {/* Actions from Summary — AI-claimed items, driven by ai_action_items state */}
                        {(() => {
                          const claimedItems = (editingNote.ai_action_items || []).filter(i => i.claimed);
                          if (!claimedItems.length) return null;
                          return (
                            <div className="mb-4 pb-4 border-b pl-3 border-l-2 border-l-orange-400">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500 mb-2">Actions from Summary</p>
                              <div className="space-y-1">
                                {claimedItems.map(item => {
                                  const linkedTodo = item.todo_id ? todos.find(t => t.id === item.todo_id) : todos.find(t => t.note_id === editingNote.id && t.text === item.text);
                                  const isDone = item.is_done ?? linkedTodo?.is_done ?? false;
                                  const todoId = item.todo_id || linkedTodo?.id;
                                  const projectTag = linkedTodo?.tags?.find(t => t.type === 'project');
                                  return (
                                    <div key={item.id} className="flex items-center gap-2 text-[13px] group/airow">
                                      <button
                                        onClick={() => todoId && toggleTodo(todoId)}
                                        className={`flex-shrink-0 transition-colors ${todoId ? 'cursor-pointer hover:opacity-70' : 'cursor-default opacity-50'}`}
                                        title={isDone ? 'Mark as open' : 'Mark as done'}
                                      >
                                        {isDone
                                          ? <CheckSquare size={13} className="text-primary/50" />
                                          : <div className="w-[13px] h-[13px] border rounded-[3px] border-muted-foreground/30" />}
                                      </button>
                                      <span className={`flex-1 ${isDone ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>{item.text}</span>
                                      {projectTag && (
                                        <span
                                          className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: projectTag.color + '20', color: projectTag.color }}
                                        >
                                          {projectTag.name}
                                        </span>
                                      )}
                                      {linkedTodo?.due_date && (() => {
                                        const today = new Date(); today.setHours(0,0,0,0);
                                        const due = new Date(linkedTodo.due_date); due.setHours(0,0,0,0);
                                        const diff = Math.round((due - today) / 86400000);
                                        const color = diff < 0 ? 'text-red-500' : diff === 0 ? 'text-orange-500' : 'text-muted-foreground';
                                        return <span className={`text-[10px] flex-shrink-0 ${color}`}>{due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>;
                                      })()}
                                      {todoId && (
                                        <div className="flex items-center gap-px p-px bg-popover/80 border border-border/20 rounded shadow-sm opacity-0 group-hover/airow:opacity-100 transition-opacity flex-shrink-0">
                                          {aiActionBubbleExpandedId !== todoId ? (
                                            <button
                                              onClick={() => setAiActionBubbleExpandedId(todoId)}
                                              className={`p-0.5 rounded hover:bg-muted transition-colors ${linkedTodo?.due_date || projectTag ? 'text-primary/70' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                                              title="Task Options"
                                            >
                                              <MoreHorizontal size={10} />
                                            </button>
                                          ) : (
                                            <>
                                              <button
                                                onClick={() => setAiActionBubbleExpandedId(null)}
                                                className="p-1 rounded hover:bg-muted text-muted-foreground/60 transition-colors"
                                                title="Collapse"
                                              >
                                                <X size={10} />
                                              </button>
                                              <div className="w-px h-3 bg-border mr-1" />
                                              <div className="relative flex items-center">
                                                <button
                                                  onClick={() => document.getElementById(`ai-date-${todoId}`)?.showPicker()}
                                                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-dashed transition-colors ${linkedTodo?.due_date ? 'border-primary/30 text-foreground bg-primary/5' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
                                                >
                                                  <CalendarIcon size={12} />
                                                  {linkedTodo?.due_date ? (
                                                    <span>{new Date(linkedTodo.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                  ) : 'Date'}
                                                </button>
                                                <input
                                                  id={`ai-date-${todoId}`}
                                                  type="date"
                                                  value={linkedTodo?.due_date ? linkedTodo.due_date.split('T')[0] : ''}
                                                  onChange={(e) => updateTodo(todoId, { due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                                />
                                              </div>
                                              <div className="w-px h-3 bg-border mx-0.5" />
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <button
                                                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-dashed transition-colors ${projectTag ? 'border-primary/30 text-foreground bg-primary/5' : 'border-transparent text-muted-foreground hover:bg-muted'}`}
                                                  >
                                                    <Tag size={12} />
                                                    {projectTag ? projectTag.name : 'Project'}
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-48 p-1" align="end" sideOffset={5}>
                                                  <div className="max-h-48 overflow-y-auto">
                                                    {projectTags.length === 0 && (
                                                      <p className="text-xs text-muted-foreground px-2 py-2 italic">No projects exist</p>
                                                    )}
                                                    {projectTags.map(tag => {
                                                      const hasTag = linkedTodo?.tags?.some(t => t.id === tag.id);
                                                      return (
                                                        <button
                                                          key={tag.id}
                                                          onClick={() => toggleTodoTag(todoId, tag.id)}
                                                          className="w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 rounded hover:bg-muted transition-colors"
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
                                                </PopoverContent>
                                              </Popover>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                        <NoteEditor
                          key={`note-${editingNote.id}`}
                          id={editingNote.id}
                          content={editingNote.content}
                          onUpdate={(newContent) => {
                            setEditingNote(prev => ({ ...prev, content: newContent }));
                            setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, content: newContent } : n));
                            handleNoteContentUpdate(editingNote.id, editingNote.title, newContent, editingNote.tags?.map(t => t.id));
                          }}
                          placeholder="Start writing..."
                          toolbarOpen={editorToolbarOpen}
                          onToolbarToggle={setEditorToolbarOpen}
                          projectTags={projectTags}
                        />
                      </>
                    )}

                    {/* ── SUMMARY TAB ── */}
                    {noteTab === 'summary' && (
                      <div className="space-y-4">
                        {isGeneratingSummary ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                            <Loader2 size={12} className="animate-spin" />
                            Generating AI summary…
                          </div>
                        ) : (Array.isArray(editingNote.summary) && editingNote.summary.length > 0) ? (
                          <>
                            {/* Action items — top */}
                            {editingNote.ai_action_items?.length > 0 && (
                              <div className="pb-3 border-b">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500 mb-1.5">Action Items</p>
                                <div className="space-y-1.5">
                                  {editingNote.ai_action_items.map(item => {
                                    const linkedTodo = item.todo_id ? todos.find(t => t.id === item.todo_id) : null;
                                    const isDone = item.is_done ?? linkedTodo?.is_done ?? false;
                                    return (
                                      <div key={item.id} className="flex items-center gap-2 text-[13px] leading-tight rounded-md px-2 py-1.5 transition-colors hover:bg-muted/30">
                                        <span className="flex-shrink-0">
                                          {isDone
                                            ? <CheckSquare size={13} className="text-muted-foreground/40" />
                                            : item.claimed
                                              ? <div className="w-[13px] h-[13px] rounded-[3px] border border-foreground/40" />
                                              : <div className="w-[13px] h-[13px] border rounded-[3px] border-muted-foreground/30" />}
                                        </span>
                                        <span className={`flex-1 ${isDone ? 'line-through text-muted-foreground/40' : item.claimed ? 'text-foreground' : 'text-muted-foreground/60 italic'}`}>
                                          {item.text}
                                          {item.speaker && <span className="ml-1.5 text-[11px] text-muted-foreground/40 font-normal not-italic">— {item.speaker}</span>}
                                        </span>
                                        {!item.claimed && (
                                          <button
                                            onClick={() => claimAiActionItem(item.id)}
                                            className="flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                                            title="Add to your To-Do list"
                                          >
                                            + Add
                                          </button>
                                        )}
                                        {item.claimed && !isDone && (
                                          <button
                                            onClick={() => unclaimAiActionItem(item.id)}
                                            className="flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                            title="Remove from To-Do list"
                                          >
                                            Undo
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {/* Summary sections */}
                            <div className="space-y-3">
                              {editingNote.summary.map((section, si) => (
                                <div key={si}>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500 mb-1">{section.title}</p>
                                  <ul className="space-y-0.5">
                                    {section.points.map((point, pi) => (
                                      <li key={pi} className="flex gap-2 text-[13px] text-foreground/75 leading-snug">
                                        <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                                        {point}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          /* Empty state */
                          <div className="pt-2 space-y-2">
                            {editingNote.transcript?.utterances?.length > 0 ? (
                              <>
                                <p className="text-xs text-muted-foreground">No summary yet.</p>
                                <button
                                  onClick={retrySummary}
                                  className="text-[11px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                                >
                                  Generate AI summary
                                </button>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">Record or upload a meeting to generate a summary.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TRANSCRIPT TAB ── */}
                    {noteTab === 'transcript' && (
                      editingNote.transcript
                        ? <TranscriptViewer key={`transcript-${editingNote.id}`} transcript={editingNote.transcript} onChange={handleTranscriptChange} />
                        : <p className="text-xs text-muted-foreground pt-2">No transcript available.</p>
                    )}
                  </div>

                  {/* Panel Footer */}
                  <div className="px-4 py-2 border-t flex justify-between items-center flex-shrink-0 bg-muted/20">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => { deleteNote(editingNote.id); setSelectedNoteId(null); setEditingNote(null); }}
                    >
                      <Trash2 size={12} className="mr-1" /> Delete
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs text-white hover:opacity-90"
                      style={{ backgroundColor: '#5BA89D' }}
                      onClick={() => { setSelectedNoteId(null); setEditingNote(null); setTagDropdownNoteId(null); }}
                    >
                      <Save size={12} className="mr-1" /> Done
                    </Button>
                  </div>
                </div>
              )}

              {/* ===== RIGHT: Todo Editor Panel ===== */}
              {view === 'todos' && editingTodoId && (
                <TodoDetailPanel
                  editingTodoId={editingTodoId}
                  setEditingTodoId={setEditingTodoId}
                  todoTree={todoTree}
                  todos={todos}
                  formatDate={formatDate}
                  toggleTodoTag={toggleTodoTag}
                  todoTagPickerId={todoTagPickerId}
                  setTodoTagPickerId={setTodoTagPickerId}
                  projectTags={projectTags}
                  tagDropdownRef={tagDropdownRef}
                  updateTodo={updateTodo}
                  editingTodoText={editingTodoText}
                  setEditingTodoText={setEditingTodoText}
                  setTodos={setTodos}
                  navigateToNote={navigateToNote}
                  todoToolbarOpen={todoToolbarOpen}
                  setTodoToolbarOpen={setTodoToolbarOpen}
                  showTodoActionItems={showTodoActionItems}
                  setShowTodoActionItems={setShowTodoActionItems}
                  extractActionItems={extractActionItems}
                  NoteEditor={NoteEditor}
                  handleTodoContentUpdate={handleTodoContentUpdate}
                  deleteTodo={deleteTodo}
                  createProjectTagInline={createProjectTagInline}
                  focusMode={focusMode}
                  setFocusMode={setFocusMode}
                />
              )}
            </div >
          </div >
        </div >
      </TooltipProvider >
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        createTodo={createTodo}
        projectTags={projectTags}
        NoteEditor={NoteEditor}
        createProjectTag={createProjectTag}
      />
    </>
  );
}
