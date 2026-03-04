import { useState } from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    BookOpen, CheckSquare, Tag, ChevronRight,
    PanelLeftClose, LogOut,
    MoreHorizontal, Edit3, Trash2, Save, X, Check,
    LayoutGrid, List
} from 'lucide-react';

export default function Sidebar({
    sidebarCollapsed,
    setSidebarCollapsed,
    view,
    setView,
    setSearchQuery,
    setSelectedTagIds,
    notebookSavedViews,
    todoSavedViews,
    activeNotebookViewId,
    activeTodoViewId,
    onApplyNotebookView,
    onApplyTodoView,
    onSaveNotebookView,
    onSaveTodoView,
    onRenameNotebookView,
    onRenameTodoView,
    onUpdateNotebookView,
    onUpdateTodoView,
    onDeleteNotebookView,
    onDeleteTodoView,
    onLogout
}) {
    return (
        <div className={`${sidebarCollapsed ? 'w-[48px]' : 'w-60'} border-r bg-sidebar flex flex-col transition-all duration-300 ease-in-out flex-shrink-0 h-screen sticky top-0`}>
            {/* Sidebar Header */}
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center p-2 pt-3' : 'justify-between p-3'}`}>
                {!sidebarCollapsed ? (
                    <div className="flex items-center gap-2 min-w-0">
                        <img src="/icon.png" alt="NoteFlow Logo" width={33} height={33} className="rounded-md flex-shrink-0" />
                        <h1 className="font-semibold text-sm truncate">NoteFlow</h1>
                    </div>
                ) : (
                    <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="rounded-md hover:opacity-80 transition-opacity"
                        title="Expand sidebar"
                    >
                        <img src="/icon.png" alt="NoteFlow Logo" width={28} height={28} className="rounded-md" />
                    </button>
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

            {/* Navigation */}
            <nav className={`space-y-0.5 ${sidebarCollapsed ? 'px-1.5 pt-2' : 'p-2 pt-1 space-y-1'}`}>
                {sidebarCollapsed ? (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => { setView('notebook'); setSearchQuery(''); setSelectedTagIds([]); }}
                                    className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${view === 'notebook' ? '' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                                        }`}
                                    style={view === 'notebook' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
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
                                    onClick={() => { setView('todos'); setSearchQuery(''); setSelectedTagIds([]); }}
                                    className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${view === 'todos' ? '' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                                        }`}
                                    style={view === 'todos' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                                >
                                    <CheckSquare size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                To-Do List
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => { setView('tags'); setSearchQuery(''); setSelectedTagIds([]); }}
                                    className={`w-full flex items-center justify-center p-2 rounded-md transition-colors ${view === 'tags' ? '' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                                        }`}
                                    style={view === 'tags' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                                >
                                    <Tag size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                Tags
                            </TooltipContent>
                        </Tooltip>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => { setView('notebook'); setSearchQuery(''); setSelectedTagIds([]); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${view === 'notebook' ? 'font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                }`}
                            style={view === 'notebook' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                        >
                            <BookOpen size={18} />
                            <span>Notebook</span>
                        </button>
                        <button
                            onClick={() => { setView('todos'); setSearchQuery(''); setSelectedTagIds([]); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${view === 'todos' ? 'font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                }`}
                            style={view === 'todos' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                        >
                            <CheckSquare size={18} />
                            <span>To-Do List</span>
                        </button>
                        <button
                            onClick={() => { setView('tags'); setSearchQuery(''); setSelectedTagIds([]); }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${view === 'tags' ? 'font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                                }`}
                            style={view === 'tags' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                        >
                            <Tag size={18} />
                            <span>Tags</span>
                        </button>
                    </>
                )}
            </nav>

            {/* Saved Views Section */}
            {!sidebarCollapsed && (
                <div className="p-3 pt-2 flex-1 overflow-y-auto space-y-4">
                    {/* Notebook Saved Views Section */}
                    <SavedViewsSection
                        title="Notebook"
                        icon={BookOpen}
                        viewType="notebook"
                        currentView={view}
                        setView={setView}
                        savedViews={notebookSavedViews || []}
                        activeViewId={activeNotebookViewId}
                        onApplyView={onApplyNotebookView}
                        onSaveView={onSaveNotebookView}
                        onRenameView={onRenameNotebookView}
                        onUpdateView={onUpdateNotebookView}
                        onDeleteView={onDeleteNotebookView}
                    />

                    {/* TODO List Saved Views Section */}
                    <SavedViewsSection
                        title="TODO List"
                        icon={CheckSquare}
                        viewType="todos"
                        currentView={view}
                        setView={setView}
                        savedViews={todoSavedViews || []}
                        activeViewId={activeTodoViewId}
                        onApplyView={onApplyTodoView}
                        onSaveView={onSaveTodoView}
                        onRenameView={onRenameTodoView}
                        onUpdateView={onUpdateTodoView}
                        onDeleteView={onDeleteTodoView}
                    />
                </div>
            )}

            {/* Logout Button */}
            <div className={`border-t p-2 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
                {sidebarCollapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={onLogout}
                                className="p-2 rounded-md text-sidebar-foreground/60 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                                <LogOut size={18} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Sign out</TooltipContent>
                    </Tooltip>
                ) : (
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <LogOut size={14} />
                        <span>Sign out</span>
                    </button>
                )}
            </div>
        </div>
    );
}

function SavedViewsSection({
    title,
    icon: Icon,
    viewType,
    currentView,
    setView,
    savedViews,
    activeViewId,
    onApplyView,
    onSaveView,
    onRenameView,
    onUpdateView,
    onDeleteView
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [menuViewId, setMenuViewId] = useState(null);
    const [renamingViewId, setRenamingViewId] = useState(null);
    const [renameText, setRenameText] = useState('');
    const [savingNew, setSavingNew] = useState(false);
    const [newViewName, setNewViewName] = useState('');
    const [newViewLayout, setNewViewLayout] = useState('list');

    const handleSaveNew = () => {
        if (newViewName.trim()) {
            onSaveView(newViewName.trim(), newViewLayout);
            setNewViewName('');
            setNewViewLayout('list');
            setSavingNew(false);
        }
    };

    return (
        <div>
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1.5 mb-2 w-full text-left group"
            >
                <ChevronRight
                    size={12}
                    className={`text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                />
                <Icon size={14} style={{ color: '#5BA89D' }} />
                <span className="text-xs font-semibold uppercase tracking-wider flex-1" style={{ color: '#5BA89D' }}>
                    {title}
                </span>
                {savedViews.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#5BA89D20', color: '#5BA89D' }}>
                        {savedViews.length}
                    </span>
                )}
            </button>

            {!isCollapsed && (
                <div className="space-y-1 pl-4">
                    {savedViews.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground py-2 italic">
                            No saved views yet
                        </p>
                    ) : (
                        savedViews.map(view => (
                            <div key={view.id} className="relative group">
                                {renamingViewId === view.id ? (
                                    <Input
                                        autoFocus
                                        value={renameText}
                                        onChange={(e) => setRenameText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && renameText.trim()) {
                                                onRenameView(view.id, renameText.trim());
                                                setRenamingViewId(null);
                                            }
                                            if (e.key === 'Escape') setRenamingViewId(null);
                                        }}
                                        onBlur={() => {
                                            if (renameText.trim()) onRenameView(view.id, renameText.trim());
                                            setRenamingViewId(null);
                                        }}
                                        className="h-7 text-xs"
                                    />
                                ) : (
                                    <div
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${activeViewId === view.id
                                            ? 'font-medium'
                                            : 'hover:bg-sidebar-accent/50'
                                            }`}
                                        style={activeViewId === view.id ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                                    >
                                        <button
                                            onClick={() => {
                                                if (currentView !== viewType) {
                                                    setView(viewType);
                                                }
                                                onApplyView(view.id);
                                            }}
                                            className="flex items-center gap-2 flex-1 min-w-0"
                                        >
                                            {view.viewLayout === 'board' ? (
                                                <LayoutGrid size={12} className="flex-shrink-0 text-muted-foreground" />
                                            ) : (
                                                <List size={12} className="flex-shrink-0 text-muted-foreground" />
                                            )}
                                            <span className="truncate">{view.name}</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuViewId(menuViewId === view.id ? null : view.id);
                                            }}
                                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
                                        >
                                            <MoreHorizontal size={12} />
                                        </button>
                                    </div>
                                )}

                                {/* Context menu */}
                                {menuViewId === view.id && (
                                    <>
                                        <div className="fixed inset-0 z-[9998]" onClick={() => setMenuViewId(null)} />
                                        <div className="absolute left-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 min-w-[140px] z-[9999]">
                                            <button
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                                                onClick={() => {
                                                    setRenamingViewId(view.id);
                                                    setRenameText(view.name);
                                                    setMenuViewId(null);
                                                }}
                                            >
                                                <Edit3 size={11} /> Rename
                                            </button>
                                            <button
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                                                onClick={() => {
                                                    onUpdateView(view.id);
                                                    setMenuViewId(null);
                                                }}
                                            >
                                                <Save size={11} /> Update
                                            </button>
                                            <div className="px-3 py-1.5">
                                                <div className="text-[10px] text-muted-foreground mb-1.5">View Type</div>
                                                <div className="flex gap-1">
                                                    <button
                                                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border transition-colors ${view.viewLayout === 'list'
                                                            ? 'text-white border-transparent'
                                                            : 'border-border hover:bg-muted'
                                                            }`}
                                                        style={view.viewLayout === 'list' ? { backgroundColor: '#5BA89D' } : {}}
                                                        onClick={() => {
                                                            onRenameView(view.id, view.name, 'list');
                                                            setMenuViewId(null);
                                                        }}
                                                    >
                                                        <List size={10} />
                                                        List
                                                    </button>
                                                    <button
                                                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border transition-colors ${view.viewLayout === 'board'
                                                            ? 'text-white border-transparent'
                                                            : 'border-border hover:bg-muted'
                                                            }`}
                                                        style={view.viewLayout === 'board' ? { backgroundColor: '#5BA89D' } : {}}
                                                        onClick={() => {
                                                            onRenameView(view.id, view.name, 'board');
                                                            setMenuViewId(null);
                                                        }}
                                                    >
                                                        <LayoutGrid size={10} />
                                                        Board
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="h-px bg-border my-0.5" />
                                            <button
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 text-destructive"
                                                onClick={() => {
                                                    onDeleteView(view.id);
                                                    setMenuViewId(null);
                                                }}
                                            >
                                                <Trash2 size={11} /> Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}

                    {/* Save new view form */}
                    {savingNew ? (
                        <div className="p-2 border rounded-md bg-muted/30 space-y-2">
                            <Input
                                autoFocus
                                value={newViewName}
                                onChange={(e) => setNewViewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveNew();
                                    if (e.key === 'Escape') {
                                        setSavingNew(false);
                                        setNewViewName('');
                                    }
                                }}
                                placeholder="View name..."
                                className="h-7 text-xs"
                            />
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground">View Type</div>
                                <div className="flex gap-1">
                                    <button
                                        className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-colors flex-1 ${newViewLayout === 'list'
                                            ? 'text-white border-transparent'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                        style={newViewLayout === 'list' ? { backgroundColor: '#5BA89D' } : {}}
                                        onClick={() => setNewViewLayout('list')}
                                    >
                                        <List size={11} />
                                        List
                                    </button>
                                    <button
                                        className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-colors flex-1 ${newViewLayout === 'board'
                                            ? 'text-white border-transparent'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                        style={newViewLayout === 'board' ? { backgroundColor: '#5BA89D' } : {}}
                                        onClick={() => setNewViewLayout('board')}
                                    >
                                        <LayoutGrid size={11} />
                                        Board
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <Button size="sm" className="h-6 text-xs flex-1 hover:opacity-90 text-white" style={{ backgroundColor: '#5BA89D' }} onClick={handleSaveNew}>
                                    <Check size={12} className="mr-1" /> Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs"
                                    onClick={() => {
                                        setSavingNew(false);
                                        setNewViewName('');
                                    }}
                                >
                                    <X size={12} className="mr-1" /> Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                if (currentView !== viewType) {
                                    setView(viewType);
                                }
                                setSavingNew(true);
                            }}
                            className="w-full text-left px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                        >
                            + New saved view
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
