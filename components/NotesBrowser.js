import { BookOpen, Plus, Clock, Check, CheckSquare, ChevronRight, GripVertical, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableNoteGroup({ id, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
        zIndex: isDragging ? 50 : 10,
    };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {children}
        </div>
    );
}

function SortableBoardColumn({ id, className, header, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className={className}>
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                {header}
            </div>
            {children}
        </div>
    );
}

export default function NotesBrowser({
    notes,
    loading,
    noteDateFilter,
    noteGroupBy,
    viewLayout,
    selectedNoteId,
    setSelectedNoteId,
    setEditingNote,
    setTagDropdownNoteId,
    formatDate,
    extractActionItems,
    createNote,
    noteTotal,
    noteOffset,
    loadMoreNotes,
    sourceTags,
    tagDropdownNoteId,
    newInlineTagName,
    setNewInlineTagName,
    createTagInline,
    newInlineTagColor,
    setNewInlineTagColor,
    RANDOM_TAG_COLORS,
    toggleNoteTag,
    visibleFields,
    getContentPreview,
    collapsedGroups,
    setCollapsedGroups,
    reorderNoteGroups,
    noteGroupOrder,
    boardColumnSize = 'medium',
    noteMeetingFilters,
    setNoteMeetingFilters
}) {
    const columnWidthClass = boardColumnSize === 'small' ? 'w-52' : boardColumnSize === 'large' ? 'w-[400px]' : 'w-80';
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const [tagDropdownPos, setTagDropdownPos] = useState(null);
    return (
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

            {notes.length > 0 && (() => {
                // Grouping logic
                let noteGroups;
                if (noteGroupBy === 'meeting') {
                    const groups = {};
                    notes.forEach(note => {
                        const meetingTag = note.tags?.find(t => t.type === 'source');
                        const key = meetingTag ? meetingTag.id : '__untagged';
                        const label = meetingTag ? meetingTag.name : 'Inbox';
                        const color = meetingTag ? meetingTag.color : null;
                        if (!groups[key]) groups[key] = { key, label, color, notes: [] };
                        groups[key].notes.push(note);
                    });
                    noteGroups = Object.values(groups);
                    // Sort groups by noteGroupOrder (includes __untagged), fallback to sourceTags order
                    const order = noteGroupOrder && noteGroupOrder.length > 0 ? noteGroupOrder : [...sourceTags.map(t => t.id), '__untagged'];
                    noteGroups.sort((a, b) => {
                        const ai = order.indexOf(a.key);
                        const bi = order.indexOf(b.key);
                        return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
                    });
                    noteGroups.forEach(group => {
                        group.notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    });
                } else if (noteGroupBy === 'date') {
                    const groups = {};
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    notes.forEach(note => {
                        const d = new Date(note.created_at);
                        const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

                        const diffTime = today.getTime() - dDate.getTime();
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                        const keyDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        const keyMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-00`;
                        const keyYear = `${d.getFullYear()}-00-00`;

                        let key, label;
                        if (diffDays === 0) { key = keyDate; label = 'Today'; }
                        else if (diffDays === 1) { key = keyDate; label = 'Yesterday'; }
                        else if (diffDays >= 2 && diffDays <= 6) { key = keyDate; label = d.toLocaleDateString('en-US', { weekday: 'long' }); }
                        else if (d.getFullYear() === now.getFullYear()) { key = keyMonth; label = d.toLocaleDateString('en-US', { month: 'long' }); }
                        else { key = keyYear; label = d.getFullYear().toString(); }

                        if (!groups[key]) groups[key] = { key, label, color: null, notes: [] };
                        groups[key].notes.push(note);
                    });
                    noteGroups = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
                    noteGroups.forEach(group => {
                        group.notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    });
                } else {
                    noteGroups = [{ key: 'all', label: 'All Notes', notes: notes }];
                }

                if (viewLayout === 'board' && noteGroups.length > 1) {
                    // ===== BOARD VIEW =====
                    const isBoardSortable = noteGroupBy === 'meeting';
                    const handleBoardDragEnd = (event) => {
                        const { active, over } = event;
                        if (!over || active.id === over.id) return;
                        reorderNoteGroups?.(active.id, over.id);
                    };

                    const boardHeader = (group) => (
                        <div className="flex items-center gap-2 mb-3 px-2 py-2 bg-muted/50 rounded-lg sticky top-0 z-10 hover:bg-muted/80 transition-colors">
                            {group.color && (
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                            )}
                            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide truncate">{group.label || 'All'}</h3>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#5BA89D20', color: '#5BA89D' }}>{group.notes.length}</span>
                            <div className="flex-1" />
                            {noteGroupBy === 'meeting' && setNoteMeetingFilters && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (noteMeetingFilters.length === 0) {
                                            const allIds = [...sourceTags.map(t => t.id), 'untagged'];
                                            const tagId = group.key === '__untagged' ? 'untagged' : group.key;
                                            setNoteMeetingFilters(allIds.filter(id => id !== tagId));
                                        } else {
                                            const tagId = group.key === '__untagged' ? 'untagged' : group.key;
                                            const next = noteMeetingFilters.filter(id => id !== tagId);
                                            setNoteMeetingFilters(next.length === 0 ? ['__none__'] : next);
                                        }
                                    }}
                                    className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted transition-colors"
                                    title={`Hide ${group.label || 'group'}`}
                                >
                                    <EyeOff size={12} />
                                </button>
                            )}
                        </div>
                    );

                    const boardColumns = noteGroups.map(group => {
                        const Column = isBoardSortable ? SortableBoardColumn : 'div';
                        const columnProps = isBoardSortable
                            ? { id: group.key, className: `flex-shrink-0 ${columnWidthClass} flex flex-col`, header: boardHeader(group) }
                            : { className: `flex-shrink-0 ${columnWidthClass} flex flex-col` };
                        return (
                            <Column key={group.key} {...columnProps}>
                                {!isBoardSortable && boardHeader(group)}
                                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                                    {group.notes.map(note => {
                                        const isSelected = selectedNoteId === note.id;
                                        return (
                                            <div
                                                key={note.id}
                                                onClick={() => { setSelectedNoteId(note.id); setEditingNote(note); setTagDropdownNoteId(null); }}
                                                className={`border rounded-lg transition-all bg-background cursor-pointer ${isSelected ? 'ring-2 ring-primary/20 border-primary/30 shadow-sm' : 'hover:border-primary/20 hover:shadow-sm'}`}
                                            >
                                                <div className="px-3 py-2.5">
                                                    <h3 className="font-medium text-xs truncate">{note.title || 'Untitled'}</h3>
                                                    {visibleFields?.includes('preview') && note.content && (() => {
                                                        const parsed = typeof note.content === 'string' ? (() => { try { return JSON.parse(note.content); } catch { return null; } })() : note.content;
                                                        const preview = parsed ? getContentPreview(parsed) : (typeof note.content === 'string' ? note.content.replace(/<[^>]*>/g, '').slice(0, 100) : '');
                                                        return preview ? <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p> : null;
                                                    })()}
                                                    {(visibleFields?.includes('date') || visibleFields?.includes('actionItems')) && (
                                                        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground flex-wrap">
                                                            {visibleFields?.includes('date') && (
                                                                <div className="flex items-center gap-1 mr-2">
                                                                    <Clock size={9} className="flex-shrink-0" />
                                                                    <span className="truncate">{formatDate(note.created_at)}</span>
                                                                </div>
                                                            )}
                                                            {visibleFields?.includes('actionItems') && (() => {
                                                                const actionItems = extractActionItems(note.content);
                                                                if (actionItems.length === 0) return null;
                                                                const totalCount = actionItems.length;
                                                                const completedCount = actionItems.filter(t => t.isChecked).length;
                                                                return (
                                                                    <div className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium bg-muted/60 text-muted-foreground">
                                                                        <CheckSquare size={9} />
                                                                        <span>{completedCount}/{totalCount}</span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                    {visibleFields?.includes('tags') && (() => {
                                                        const displayTags = noteGroupBy === 'meeting' ? note.tags?.filter(t => t.type !== 'source') : note.tags;
                                                        return (
                                                            <div className="flex flex-wrap items-center gap-1 mt-1.5 relative">
                                                                {displayTags && displayTags.length > 0 ? displayTags.map(t => (
                                                                    <span
                                                                        key={t.id}
                                                                        className="px-1.5 py-0.5 rounded-full text-[9px] font-medium truncate max-w-full cursor-pointer hover:opacity-80 transition-opacity"
                                                                        style={{ backgroundColor: t.color + '20', color: t.color }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                            setTagDropdownPos({ top: rect.bottom + 4, left: rect.left });
                                                                            setTagDropdownNoteId(tagDropdownNoteId === note.id ? null : note.id);
                                                                            setNewInlineTagName('');
                                                                        }}
                                                                    >
                                                                        {t.name}
                                                                    </span>
                                                                )) : (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                            setTagDropdownPos({ top: rect.bottom + 4, left: rect.left });
                                                                            setTagDropdownNoteId(tagDropdownNoteId === note.id ? null : note.id);
                                                                            setNewInlineTagName('');
                                                                        }}
                                                                        className="text-[9px] px-1.5 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                                                                    >
                                                                        No tag
                                                                    </button>
                                                                )}
                                                                {tagDropdownNoteId === note.id && tagDropdownPos && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setTagDropdownNoteId(null); setTagDropdownPos(null); }} />
                                                                        <div className="fixed z-50 w-48 bg-popover border rounded-lg shadow-lg py-1" style={{ top: tagDropdownPos.top, left: tagDropdownPos.left }} onClick={e => e.stopPropagation()}>
                                                                            <div className="px-2 py-1.5 border-b">
                                                                                <input
                                                                                    type="text"
                                                                                    value={newInlineTagName}
                                                                                    onChange={e => setNewInlineTagName(e.target.value)}
                                                                                    onKeyDown={e => { if (e.key === 'Enter') createTagInline(note.id); }}
                                                                                    placeholder="New tag name..."
                                                                                    className="flex-1 text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring w-full"
                                                                                    autoFocus
                                                                                />
                                                                                {newInlineTagName.trim() && RANDOM_TAG_COLORS && (
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
                                                                                    const hasTag = (note.tags || []).some(t => t.id === tag.id);
                                                                                    return (
                                                                                        <button
                                                                                            key={tag.id}
                                                                                            onClick={() => toggleNoteTag(note.id, tag.id, note.tags || [])}
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
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {group.notes.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground text-xs italic">No notes</div>
                                    )}
                                </div>
                            </Column>
                        );
                    });

                    if (isBoardSortable) {
                        return (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBoardDragEnd}>
                                <SortableContext items={noteGroups.map(g => g.key)} strategy={horizontalListSortingStrategy}>
                                    <div className="flex gap-4" style={{ minWidth: 'min-content' }}>
                                        {boardColumns}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        );
                    }
                    return (
                        <div className="flex gap-4" style={{ minWidth: 'min-content' }}>
                            {boardColumns}
                        </div>
                    );
                }

                // ===== LIST VIEW =====
                const isSortable = noteGroupBy === 'meeting';

                const NoteGroupHeader = ({ group, isCollapsed, onToggle }) => (
                    <div
                        className="flex items-center gap-2 mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1.5 z-10 cursor-pointer select-none"
                        onClick={onToggle}
                    >
                        <div className="p-0.5 hover:bg-muted rounded text-muted-foreground">
                            <ChevronRight size={14} className={`transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
                        </div>
                        {group.color && (
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                        )}
                        <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wide">{group.label}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#5BA89D20', color: '#5BA89D' }}>{group.notes.length}</span>
                        <div className={`flex-1 border-b ${group.color ? 'opacity-30' : 'border-border/50'}`} style={group.color ? { borderColor: group.color } : {}} />
                    </div>
                );

                const handleNoteGroupDragEnd = (event) => {
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    reorderNoteGroups?.(active.id, over.id);
                };

                const listContent = noteGroups.map(group => {
                    const isCollapsed = collapsedGroups?.includes(group.key);
                    const toggleCollapse = () => setCollapsedGroups?.(prev => prev.includes(group.key) ? prev.filter(k => k !== group.key) : [...prev, group.key]);
                    const Wrapper = isSortable ? SortableNoteGroup : 'div';
                    const wrapperProps = isSortable ? { id: group.key } : {};
                    return (
                        <Wrapper key={group.key} {...wrapperProps}>
                            {group.label && (
                                <NoteGroupHeader group={group} isCollapsed={isCollapsed} onToggle={toggleCollapse} />
                            )}
                            {!isCollapsed && (
                                <div className="space-y-2">
                                    {group.notes.map(note => {
                                        const isSelected = selectedNoteId === note.id;
                                        return (
                                            <div
                                                key={note.id}
                                                onClick={() => { setSelectedNoteId(note.id); setEditingNote(note); setTagDropdownNoteId(null); }}
                                                className={`border rounded-lg transition-all cursor-pointer ${isSelected ? 'ring-2 ring-primary/20 border-primary/30 bg-accent/30' : 'hover:border-primary/20 hover:bg-accent/10'}`}
                                            >
                                                <div className="px-4 py-3 flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-medium text-xs truncate">
                                                            {note.title || <span className="text-muted-foreground italic">Untitled</span>}
                                                        </h3>
                                                        {visibleFields?.includes('preview') && note.content && (() => {
                                                            const parsed = typeof note.content === 'string' ? (() => { try { return JSON.parse(note.content); } catch { return null; } })() : note.content;
                                                            const preview = parsed ? getContentPreview(parsed) : (typeof note.content === 'string' ? note.content.replace(/<[^>]*>/g, '').slice(0, 120) : '');
                                                            return preview ? <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{preview}</p> : null;
                                                        })()}
                                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                            {visibleFields?.includes('date') && (
                                                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                    <Clock size={10} />
                                                                    {formatDate(note.created_at)}
                                                                </span>
                                                            )}
                                                            {visibleFields?.includes('actionItems') && (() => {
                                                                const actionItems = extractActionItems(note.content);
                                                                if (actionItems.length === 0) return null;
                                                                const totalCount = actionItems.length;
                                                                const completedCount = actionItems.filter(t => t.isChecked).length;
                                                                return (
                                                                    <span className="text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-muted/60 text-muted-foreground">
                                                                        <CheckSquare size={10} />
                                                                        {completedCount}/{totalCount}
                                                                    </span>
                                                                );
                                                            })()}
                                                            {visibleFields?.includes('tags') && (noteGroupBy === 'meeting' ? note.tags?.filter(t => t.type !== 'source') : note.tags)?.map(tag => (
                                                                <span
                                                                    key={tag.id}
                                                                    className="text-xs px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                                                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTagDropdownNoteId(tagDropdownNoteId === note.id ? null : note.id);
                                                                        setNewInlineTagName('');
                                                                    }}
                                                                >
                                                                    {tag.name}
                                                                </span>
                                                            ))}
                                                            {visibleFields?.includes('tags') && (!note.tags || note.tags.length === 0) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTagDropdownNoteId(tagDropdownNoteId === note.id ? null : note.id);
                                                                        setNewInlineTagName('');
                                                                    }}
                                                                    className="text-[11px] px-1.5 py-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex items-center gap-0.5"
                                                                >
                                                                    No tag
                                                                </button>
                                                            )}
                                                            {visibleFields?.includes('tags') && tagDropdownNoteId === note.id && (
                                                                <div className="relative inline-block">
                                                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setTagDropdownNoteId(null); }} />
                                                                    <div className="absolute left-0 top-2 z-50 w-48 bg-popover border rounded-lg shadow-lg py-1" onClick={e => e.stopPropagation()}>
                                                                        <div className="px-2 py-1.5 border-b">
                                                                            <input
                                                                                type="text"
                                                                                value={newInlineTagName}
                                                                                onChange={e => setNewInlineTagName(e.target.value)}
                                                                                onKeyDown={e => { if (e.key === 'Enter') createTagInline(note.id); }}
                                                                                placeholder="New tag name..."
                                                                                className="flex-1 text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring w-full"
                                                                                autoFocus
                                                                            />
                                                                            {newInlineTagName.trim() && RANDOM_TAG_COLORS && (
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
                                                                                const hasTag = (note.tags || []).some(t => t.id === tag.id);
                                                                                return (
                                                                                    <button
                                                                                        key={tag.id}
                                                                                        onClick={() => toggleNoteTag(note.id, tag.id, note.tags || [])}
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
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Wrapper>
                    );
                });

                if (isSortable) {
                    return (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNoteGroupDragEnd}>
                            <SortableContext items={noteGroups.map(g => g.key)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-0">{listContent}</div>
                            </SortableContext>
                        </DndContext>
                    );
                }
                return listContent;
            })()}

            {notes.length > 0 && notes.length < noteTotal && (
                <div className="pt-4 pb-8 flex justify-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreNotes}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Load More Notes ({noteTotal - notes.length} remaining)
                    </Button>
                </div>
            )}
        </div>
    );
}
