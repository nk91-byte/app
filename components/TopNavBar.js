import { useState } from 'react';
import { Search, X, CircleDot, CalendarIcon, LayoutGrid, List, Columns3, CheckSquare, FolderOpen, Calendar as CalendarIconLucide, EyeOff, Eye, SlidersHorizontal, ChevronDown, Check, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TopNavBar({
    view,
    searchQuery,
    setSearchQuery,
    noteMeetingFilterOpen,
    setNoteMeetingFilterOpen,
    noteMeetingFilters,
    setNoteMeetingFilters,
    noteStatusFilters,
    setNoteStatusFilters,
    sourceTags,
    setSelectedTagIds,
    noteDateFilter,
    setNoteDateFilter,
    noteGroupBy,
    setNoteGroupBy,
    viewLayout,
    setViewLayout,
    todoStatusFilterOpen,
    setTodoStatusFilterOpen,
    todoFilters,
    setTodoFilters,
    todoProjectFilterOpen,
    setTodoProjectFilterOpen,
    todoProjectFilterIds,
    setTodoProjectFilterIds,
    projectTags,
    todoDateFilter,
    setTodoDateFilter,
    todoDateRangeFrom,
    setTodoDateRangeFrom,
    todoDateRangeTo,
    setTodoDateRangeTo,
    todoCreatedFilter,
    setTodoCreatedFilter,
    todoCreatedRangeFrom,
    setTodoCreatedRangeFrom,
    todoCreatedRangeTo,
    setTodoCreatedRangeTo,
    todoGroupBy,
    setTodoGroupBy,
    collapsedGroups,
    setCollapsedGroups,
    groupTodos,
    todoTree,
    createNote,
    hiddenBoardGroups,
    setHiddenBoardGroups,
    noteVisibleFields,
    setNoteVisibleFields,
    todoVisibleFields,
    setTodoVisibleFields,
    boardColumnSize,
    setBoardColumnSize
}) {
    const [noteStatusFilterOpen, setNoteStatusFilterOpen] = useState(false);
    return (<>
        <div className="border-b px-6 py-3 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={
                        view === 'notebook' ? 'Search notes...' :
                            view === 'tags' ? 'Search tags...' :
                                'Search todos...'
                    }
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

            {view === 'notebook' && (
                <div className="flex items-center gap-1.5 flex-wrap">

                    {/* Note Status Filter */}
                    <Popover open={noteStatusFilterOpen} onOpenChange={setNoteStatusFilterOpen}>
                        <PopoverTrigger asChild>
                            <button className="relative h-7 pl-2 pr-6 rounded-md border text-xs bg-background appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring flex items-center min-w-[100px]">
                                {(() => {
                                    if (noteStatusFilters?.length === 0 || !noteStatusFilters) return <span>All Statuses</span>;
                                    const hidden = 3 - noteStatusFilters.length;
                                    if (hidden > 0) return <span>{hidden} Hidden</span>;
                                    return <span>All Statuses</span>;
                                })()}
                                <CheckSquare size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1" align="start">
                            <div className="flex gap-1 mb-1">
                                <button
                                    className={`flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors ${!noteStatusFilters || noteStatusFilters.length === 0 ? 'bg-accent/50 font-medium' : ''}`}
                                    onClick={() => setNoteStatusFilters([])}
                                >
                                    Show All
                                </button>
                                <button
                                    className="flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors"
                                    onClick={() => setNoteStatusFilters(['__none__'])}
                                >
                                    Hide All
                                </button>
                            </div>
                            <div className="h-px bg-border my-1" />
                            {['open', 'closed', 'no_action'].map(status => {
                                const isVisible = !noteStatusFilters || noteStatusFilters.length === 0 || noteStatusFilters.includes(status);
                                const displayName = status === 'no_action' ? 'No Action' : status.charAt(0).toUpperCase() + status.slice(1);
                                return (
                                    <button
                                        key={status}
                                        className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center justify-between ${!isVisible ? 'opacity-50' : ''}`}
                                        onClick={() => {
                                            const filters = noteStatusFilters || [];
                                            if (filters.length === 0) {
                                                setNoteStatusFilters(['open', 'closed', 'no_action'].filter(s => s !== status));
                                            } else if (filters.includes(status)) {
                                                const next = filters.filter(s => s !== status);
                                                setNoteStatusFilters(next.length === 0 ? [] : next);
                                            } else {
                                                const next = [...filters, status];
                                                setNoteStatusFilters(next.length === 3 ? [] : next);
                                            }
                                        }}
                                    >
                                        <span>{displayName}</span>
                                        {isVisible ? <Eye size={10} className="text-muted-foreground" /> : <EyeOff size={10} className="text-muted-foreground" />}
                                    </button>
                                );
                            })}
                        </PopoverContent>
                    </Popover>

                    {/* Meeting filter */}
                    <Popover open={noteMeetingFilterOpen} onOpenChange={setNoteMeetingFilterOpen}>
                        <PopoverTrigger asChild>
                            <button className="relative h-7 pl-2 pr-6 rounded-md border text-xs bg-background appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring flex items-center min-w-[120px]">
                                {noteMeetingFilters.length === 0
                                    ? <span>All Meetings</span>
                                    : <span>{noteMeetingFilters.length} Hidden</span>
                                }
                                <CircleDot size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="start">
                            <div className="flex gap-1 mb-1">
                                <button
                                    className={`flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors ${noteMeetingFilters.length === 0 ? 'bg-accent/50 font-medium' : ''}`}
                                    onClick={() => { setNoteMeetingFilters([]); setSelectedTagIds([]); }}
                                >
                                    Show All
                                </button>
                                <button
                                    className="flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors"
                                    onClick={() => setNoteMeetingFilters([...sourceTags.map(s => s.id), 'untagged'])}
                                >
                                    Hide All
                                </button>
                            </div>
                            <div className="h-px bg-border my-1" />
                            {[{ id: 'untagged', name: 'Inbox (Untagged)', color: '#9ca3af' }, ...sourceTags].map(t => {
                                const isVisible = !noteMeetingFilters.includes(t.id);
                                return (
                                    <button
                                        key={t.id}
                                        className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5 justify-between ${!isVisible ? 'opacity-50' : ''}`}
                                        onClick={() => {
                                            setNoteMeetingFilters(prev =>
                                                prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                                            );
                                            setSelectedTagIds([]);
                                        }}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                                            <span className="truncate">{t.name}</span>
                                        </div>
                                        {isVisible ? <Eye size={10} className="text-muted-foreground" /> : <EyeOff size={10} className="text-muted-foreground" />}
                                    </button>
                                );
                            })}
                        </PopoverContent>
                    </Popover>

                    {/* Date filter */}


                    {/* Group by */}
                    <div className="relative">
                        <select
                            value={noteGroupBy}
                            onChange={e => setNoteGroupBy(e.target.value)}
                            className="h-7 pl-2 pr-6 rounded-md border text-xs bg-background appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            <option value="none">No Grouping</option>
                            <option value="meeting">Group by Meeting</option>
                            <option value="date">Group by Date</option>
                        </select>
                        <LayoutGrid size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Properties toggle */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="h-7 px-2 rounded-md border text-xs bg-background hover:border-primary/50 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                                <SlidersHorizontal size={10} />
                                <span>Properties</span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="start">
                            <div className="text-xs font-medium text-muted-foreground mb-2">Visible fields</div>
                            {[
                                { key: 'date', label: 'Date' },
                                { key: 'actionItems', label: 'Action Items' },
                                { key: 'tags', label: 'Tags' },
                                { key: 'preview', label: 'Preview' },
                            ].map(field => {
                                const active = noteVisibleFields?.includes(field.key);
                                return (
                                    <button
                                        key={field.key}
                                        onClick={() => {
                                            if (active) {
                                                setNoteVisibleFields(noteVisibleFields.filter(f => f !== field.key));
                                            } else {
                                                setNoteVisibleFields([...noteVisibleFields, field.key]);
                                            }
                                        }}
                                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted text-xs transition-colors"
                                    >
                                        <span>{field.label}</span>
                                        {active ? <Eye size={12} className="text-foreground" /> : <EyeOff size={12} className="text-muted-foreground" />}
                                    </button>
                                );
                            })}
                        </PopoverContent>
                    </Popover>

                    <div className="w-px h-5 bg-border mx-0.5" />

                    {/* List / Board toggle */}
                    <div className="flex items-center border rounded-md overflow-hidden bg-background">
                        <button
                            onClick={() => setViewLayout('list')}
                            className={`p-1.5 transition-colors ${viewLayout === 'list' ? 'font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                            style={viewLayout === 'list' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                            title="List view"
                        >
                            <List size={12} />
                        </button>

                        {viewLayout === 'board' ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        className="p-1.5 transition-colors flex items-center gap-1 font-medium"
                                        style={{ backgroundColor: '#5BA89D18', color: '#5BA89D' }}
                                        title="Board view sizing"
                                    >
                                        <Columns3 size={12} />
                                        <ChevronDown size={10} className="opacity-50" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-36 p-1" align="end" sideOffset={8}>
                                    <div className="text-[10px] font-medium text-muted-foreground px-2 py-1 mb-1 bg-muted/30 rounded-sm">Column Size</div>
                                    {['small', 'medium', 'large'].map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setBoardColumnSize(size)}
                                            className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center justify-between"
                                        >
                                            <span className="capitalize">{size}</span>
                                            {boardColumnSize === size && <Check size={10} className="text-foreground" />}
                                        </button>
                                    ))}
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <button
                                onClick={() => { setViewLayout('board'); if (noteGroupBy === 'none') setNoteGroupBy('meeting'); }}
                                className="p-1.5 transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                title="Board view"
                            >
                                <Columns3 size={12} />
                            </button>
                        )}
                    </div>

                    {noteMeetingFilters.length > 0 && (
                        <button
                            onClick={() => setNoteMeetingFilters([])}
                            className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            Clear filter
                        </button>
                    )}
                </div>
            )}

            {view === 'todos' && (
                <div className="flex items-center gap-1.5 flex-wrap">

                    {/* Status filter */}
                    <Popover open={todoStatusFilterOpen} onOpenChange={setTodoStatusFilterOpen}>
                        <PopoverTrigger asChild>
                            <button className="relative h-7 pl-2 pr-6 rounded-md border text-xs bg-background appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring flex items-center min-w-[100px]">
                                {(() => {
                                    if (todoFilters.length === 0) return <span>All Statuses</span>;
                                    const hidden = 3 - todoFilters.length;
                                    if (hidden > 0) return <span>{hidden} Hidden</span>;
                                    return <span>All Statuses</span>;
                                })()}
                                <CheckSquare size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1" align="start">
                            <div className="flex gap-1 mb-1">
                                <button
                                    className={`flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors ${todoFilters.length === 0 ? 'bg-accent/50 font-medium' : ''}`}
                                    onClick={() => setTodoFilters([])}
                                >
                                    Show All
                                </button>
                                <button
                                    className="flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors"
                                    onClick={() => setTodoFilters(['__none__'])}
                                >
                                    Hide All
                                </button>
                            </div>
                            <div className="h-px bg-border my-1" />
                            {['open', 'done', 'archived'].map(status => {
                                const isVisible = todoFilters.length === 0 || todoFilters.includes(status);
                                return (
                                    <button
                                        key={status}
                                        className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center justify-between ${!isVisible ? 'opacity-50' : ''}`}
                                        onClick={() => {
                                            if (todoFilters.length === 0) {
                                                // Currently showing all → hide this one
                                                setTodoFilters(['open', 'done', 'archived'].filter(s => s !== status));
                                            } else if (todoFilters.includes(status)) {
                                                const next = todoFilters.filter(s => s !== status);
                                                setTodoFilters(next.length === 0 ? [] : next);
                                            } else {
                                                const next = [...todoFilters, status];
                                                setTodoFilters(next.length === 3 ? [] : next);
                                            }
                                        }}
                                    >
                                        <span className="capitalize">{status}</span>
                                        {isVisible ? <Eye size={10} className="text-muted-foreground" /> : <EyeOff size={10} className="text-muted-foreground" />}
                                    </button>
                                );
                            })}
                        </PopoverContent>
                    </Popover>

                    {/* Project filter */}
                    <Popover open={todoProjectFilterOpen} onOpenChange={setTodoProjectFilterOpen}>
                        <PopoverTrigger asChild>
                            <button className="relative h-7 pl-2 pr-6 rounded-md border text-xs bg-background appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring flex items-center min-w-[120px]">
                                {todoProjectFilterIds.length === 0
                                    ? <span>All Projects</span>
                                    : <span>{todoProjectFilterIds.length} Hidden</span>
                                }
                                <FolderOpen size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1 max-h-[300px] overflow-y-auto" align="start">
                            <div className="flex gap-1 mb-1">
                                <button
                                    className={`flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors ${todoProjectFilterIds.length === 0 ? 'bg-accent/50 font-medium' : ''}`}
                                    onClick={() => setTodoProjectFilterIds([])}
                                >
                                    Show All
                                </button>
                                <button
                                    className="flex-1 text-center px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors"
                                    onClick={() => setTodoProjectFilterIds([...projectTags.map(t => t.id), '__untagged'])}
                                >
                                    Hide All
                                </button>
                            </div>
                            <div className="h-px bg-border my-1" />
                            <button
                                className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5 justify-between ${todoProjectFilterIds.includes('__untagged') ? 'opacity-50' : ''}`}
                                onClick={() => setTodoProjectFilterIds(prev =>
                                    prev.includes('__untagged') ? prev.filter(id => id !== '__untagged') : [...prev, '__untagged']
                                )}
                            >
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground/30" />
                                    <span className="truncate">Inbox</span>
                                </div>
                                {!todoProjectFilterIds.includes('__untagged') ? <Eye size={10} className="text-muted-foreground" /> : <EyeOff size={10} className="text-muted-foreground" />}
                            </button>
                            {projectTags.map(t => {
                                const isVisible = !todoProjectFilterIds.includes(t.id);
                                return (
                                    <button
                                        key={t.id}
                                        className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center gap-1.5 justify-between ${!isVisible ? 'opacity-50' : ''}`}
                                        onClick={() => setTodoProjectFilterIds(prev =>
                                            prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                                            <span className="truncate">{t.name}</span>
                                        </div>
                                        {isVisible ? <Eye size={10} className="text-muted-foreground" /> : <EyeOff size={10} className="text-muted-foreground" />}
                                    </button>
                                );
                            })}
                        </PopoverContent>
                    </Popover>

                    {hiddenBoardGroups.length > 0 && viewLayout === 'board' && (
                        <button
                            onClick={() => setHiddenBoardGroups([])}
                            className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1 border border-dashed border-muted-foreground/30"
                            title="Unhide board columns"
                        >
                            <Eye size={10} />
                            {hiddenBoardGroups.length} Hidden
                        </button>
                    )}

                    {/* Date filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="relative h-7 pl-2 pr-6 rounded-md border text-xs bg-background cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring flex items-center gap-1 min-w-[90px]">
                                {(() => {
                                    if (todoDateRangeFrom || todoDateRangeTo) {
                                        let rFrom = todoDateRangeFrom, rTo = todoDateRangeTo;
                                        if (rFrom && rTo && rFrom > rTo) { [rFrom, rTo] = [rTo, rFrom]; }
                                        const from = rFrom ? new Date(rFrom + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '...';
                                        const to = rTo ? new Date(rTo + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '...';
                                        return <span>{from} – {to}</span>;
                                    }
                                    if (todoDateFilter.length === 0) return <span>Any Date</span>;
                                    const labels = { past_due: 'Past Due', today: 'Today', tomorrow: 'Tomorrow', this_week: 'This Week', next_week: 'Next Week', no_date: 'No Date' };
                                    if (todoDateFilter.length === 1) return <span>{labels[todoDateFilter[0]]}</span>;
                                    return <span>{todoDateFilter.length} Selected</span>;
                                })()}
                                <CalendarIcon size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start" sideOffset={5}>
                            <div className="flex items-center justify-between px-2 py-1.5 border-b">
                                <span className="text-xs font-medium text-muted-foreground">Due Date</span>
                                {(todoDateFilter.length > 0 || todoDateRangeFrom || todoDateRangeTo) && (
                                    <button onClick={() => { setTodoDateFilter([]); setTodoDateRangeFrom(''); setTodoDateRangeTo(''); }} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                                )}
                            </div>
                            <div className="py-1">
                                {[
                                    { id: 'past_due', label: 'Past Due' },
                                    { id: 'today', label: 'Today' },
                                    { id: 'tomorrow', label: 'Tomorrow' },
                                    { id: 'this_week', label: 'This Week' },
                                    { id: 'next_week', label: 'Next Week' },
                                    { id: 'no_date', label: 'No Date' },
                                ].map(opt => {
                                    const isActive = todoDateFilter.includes(opt.id);
                                    return (
                                        <button
                                            key={opt.id}
                                            className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center justify-between ${!isActive && todoDateFilter.length > 0 ? 'opacity-50' : ''}`}
                                            onClick={() => {
                                                setTodoDateRangeFrom('');
                                                setTodoDateRangeTo('');
                                                setTodoDateFilter(prev => {
                                                    if (prev.includes(opt.id)) {
                                                        const next = prev.filter(x => x !== opt.id);
                                                        return next;
                                                    }
                                                    return [...prev, opt.id];
                                                });
                                            }}
                                        >
                                            <span>{opt.label}</span>
                                            {isActive ? <Eye size={10} className="text-muted-foreground" /> : <EyeOff size={10} className="text-muted-foreground" />}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="border-t px-2 py-2">
                                <span className="text-[10px] text-muted-foreground font-medium">Custom Range</span>
                                <div className="flex flex-col gap-1.5 mt-1.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground w-8">From</span>
                                        <input
                                            type="date"
                                            value={todoDateRangeFrom}
                                            onChange={e => { setTodoDateRangeFrom(e.target.value); if (e.target.value) setTodoDateFilter([]); }}
                                            className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground w-8">To</span>
                                        <input
                                            type="date"
                                            value={todoDateRangeTo}
                                            onChange={e => { setTodoDateRangeTo(e.target.value); if (e.target.value) setTodoDateFilter([]); }}
                                            className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                                        />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Created date filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="relative h-7 pl-2 pr-6 rounded-md border text-xs bg-background cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring flex items-center gap-1 min-w-[90px]">
                                {(() => {
                                    if (todoCreatedRangeFrom || todoCreatedRangeTo) {
                                        let rFrom = todoCreatedRangeFrom, rTo = todoCreatedRangeTo;
                                        if (rFrom && rTo && rFrom > rTo) { [rFrom, rTo] = [rTo, rFrom]; }
                                        const from = rFrom ? new Date(rFrom + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '...';
                                        const to = rTo ? new Date(rTo + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '...';
                                        return <span>{from} – {to}</span>;
                                    }
                                    const labels = { today: 'Today', yesterday: 'Yesterday', this_week: 'This Week' };
                                    if (todoCreatedFilter.length > 0) return <span>Created: {todoCreatedFilter.map(f => labels[f]).join(', ')}</span>;
                                    return <span>Created</span>;
                                })()}
                                <Clock size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start" sideOffset={5}>
                            <div className="flex items-center justify-between px-2 py-1.5 border-b">
                                <span className="text-xs font-medium text-muted-foreground">Created Date</span>
                                {(todoCreatedFilter.length > 0 || todoCreatedRangeFrom || todoCreatedRangeTo) && (
                                    <button onClick={() => { setTodoCreatedFilter([]); setTodoCreatedRangeFrom(''); setTodoCreatedRangeTo(''); }} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                                )}
                            </div>
                            <div className="py-1">
                                {[
                                    { id: 'today', label: 'Today' },
                                    { id: 'yesterday', label: 'Yesterday' },
                                    { id: 'this_week', label: 'This Week' },
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        className={`w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center justify-between ${todoCreatedFilter.includes(opt.id) ? '' : 'opacity-70'}`}
                                        onClick={() => {
                                            setTodoCreatedRangeFrom('');
                                            setTodoCreatedRangeTo('');
                                            setTodoCreatedFilter(prev => prev.includes(opt.id) ? prev.filter(f => f !== opt.id) : [...prev, opt.id]);
                                        }}
                                    >
                                        <span>{opt.label}</span>
                                        {todoCreatedFilter.includes(opt.id) ? <Eye size={10} className="text-muted-foreground" /> : <EyeOff size={10} className="text-muted-foreground" />}
                                    </button>
                                ))}
                            </div>
                            <div className="border-t px-2 py-2">
                                <span className="text-[10px] text-muted-foreground font-medium">Custom Range</span>
                                <div className="flex flex-col gap-1.5 mt-1.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground w-8">From</span>
                                        <input
                                            type="date"
                                            value={todoCreatedRangeFrom}
                                            onChange={e => { setTodoCreatedRangeFrom(e.target.value); if (e.target.value) setTodoCreatedFilter([]); }}
                                            className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground w-8">To</span>
                                        <input
                                            type="date"
                                            value={todoCreatedRangeTo}
                                            onChange={e => { setTodoCreatedRangeTo(e.target.value); if (e.target.value) setTodoCreatedFilter([]); }}
                                            className="flex-1 text-[11px] px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                                        />
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="w-px h-5 bg-border mx-0.5" />

                    {/* Group by */}
                    <div className="relative">
                        <select
                            value={todoGroupBy}
                            onChange={e => setTodoGroupBy(e.target.value)}
                            className="h-7 pl-2 pr-6 rounded-md border text-xs bg-background appearance-none cursor-pointer hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            <option value="none">No Grouping</option>
                            <option value="project">Group by Project</option>
                            <option value="status">Group by Status</option>
                            <option value="date">Group by Date</option>
                        </select>
                        <LayoutGrid size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Properties toggle */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="h-7 px-2 rounded-md border text-xs bg-background hover:border-primary/50 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                                <SlidersHorizontal size={10} />
                                <span>Properties</span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="start">
                            <div className="text-xs font-medium text-muted-foreground mb-2">Visible fields</div>
                            {[
                                { key: 'tags', label: 'Tags' },
                                { key: 'actionItems', label: 'Action Items' },
                                { key: 'daysTillDue', label: 'Days till Due' },
                                { key: 'dueDate', label: 'Due Date' },
                                { key: 'linkedNote', label: 'Linked Note' },
                            ].map(field => {
                                const active = todoVisibleFields?.includes(field.key);
                                return (
                                    <button
                                        key={field.key}
                                        onClick={() => {
                                            if (active) {
                                                setTodoVisibleFields(todoVisibleFields.filter(f => f !== field.key));
                                            } else {
                                                setTodoVisibleFields([...todoVisibleFields, field.key]);
                                            }
                                        }}
                                        className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted text-xs transition-colors"
                                    >
                                        <span>{field.label}</span>
                                        {active ? <Eye size={12} className="text-foreground" /> : <EyeOff size={12} className="text-muted-foreground" />}
                                    </button>
                                );
                            })}
                        </PopoverContent>
                    </Popover>

                    <div className="w-px h-5 bg-border mx-0.5" />

                    {/* List / Board toggle */}
                    <div className="flex items-center border rounded-md overflow-hidden bg-background">
                        <button
                            onClick={() => setViewLayout('list')}
                            className={`p-1.5 transition-colors ${viewLayout === 'list' ? 'font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                            style={viewLayout === 'list' ? { backgroundColor: '#5BA89D18', color: '#5BA89D' } : {}}
                            title="List view"
                        >
                            <List size={12} />
                        </button>

                        {viewLayout === 'board' ? (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        className="p-1.5 transition-colors flex items-center gap-1 font-medium"
                                        style={{ backgroundColor: '#5BA89D18', color: '#5BA89D' }}
                                        title="Board view sizing"
                                    >
                                        <Columns3 size={12} />
                                        <ChevronDown size={10} className="opacity-50" />
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-36 p-1" align="end" sideOffset={8}>
                                    <div className="text-[10px] font-medium text-muted-foreground px-2 py-1 mb-1 bg-muted/30 rounded-sm">Column Size</div>
                                    {['small', 'medium', 'large'].map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setBoardColumnSize(size)}
                                            className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors flex items-center justify-between"
                                        >
                                            <span className="capitalize">{size}</span>
                                            {boardColumnSize === size && <Check size={10} className="text-foreground" />}
                                        </button>
                                    ))}
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <button
                                onClick={() => { setViewLayout('board'); if (todoGroupBy === 'none') setTodoGroupBy('project'); }}
                                className="p-1.5 transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                title="Board view"
                            >
                                <Columns3 size={12} />
                            </button>
                        )}
                    </div>

                    {/* Active filter indicators */}
                    {(todoFilters.length > 0 || todoProjectFilterIds.length > 0 || todoDateFilter.length > 0 || todoDateRangeFrom || todoDateRangeTo || todoCreatedFilter.length > 0 || todoCreatedRangeFrom || todoCreatedRangeTo) && (
                        <button
                            onClick={() => { setTodoFilters([]); setTodoProjectFilterIds([]); setTodoDateFilter([]); setTodoDateRangeFrom(''); setTodoDateRangeTo(''); setTodoCreatedFilter([]); setTodoCreatedRangeFrom(''); setTodoCreatedRangeTo(''); }}
                            className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            Clear filters
                        </button>
                    )}

                    {todoGroupBy !== 'none' && (
                        <>
                            <div className="w-px h-5 bg-border mx-0.5" />
                            <button
                                onClick={() => {
                                    if (collapsedGroups.length > 0) {
                                        setCollapsedGroups([]);
                                    } else {
                                        const groups = groupTodos(todoTree, todoGroupBy);
                                        setCollapsedGroups(groups.map(g => g.key));
                                    }
                                }}
                                className="px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                                {collapsedGroups.length > 0 ? 'Expand all' : 'Collapse all'}
                            </button>
                        </>
                    )}
                </div>
            )}

            {view === 'notebook' && (
                <Button
                    size="sm"
                    onClick={() => createNote()}
                    className="h-8 text-white hover:opacity-90"
                    style={{ backgroundColor: '#5BA89D' }}
                >
                    <CalendarIconLucide size={14} className="mr-1" />
                    New Note
                </Button>
            )}
        </div>

    </>);
}
