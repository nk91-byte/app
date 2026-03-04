import { CheckSquare, Plus, GripVertical, Repeat, Check, Tag } from 'lucide-react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

function SortableBoardCard({ todo, children, editingTodoId, setEditingTodoId, setEditingTodoText }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });
    const isSelected = todo.id === editingTodoId;
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`border rounded-lg bg-background hover:border-primary/20 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'shadow-lg ring-1 ring-primary/20' : ''} ${isSelected ? 'bg-muted/60 ring-1 ring-inset ring-primary/30' : ''}`}
            onClick={() => { setEditingTodoId(todo.id); setEditingTodoText(todo.text); }}
        >
            {children}
        </div>
    );
}

export default function TodosBrowser({
    todoTree,
    todoGroupBy,
    viewLayout,
    groupTodos,
    sensors,
    handleDragStart,
    handleDragEnd,
    groups,
    SortableGroupHeader,
    TodoItemRow,
    updateTodo,
    createTodo,
    inlineAddingGroupId,
    setInlineAddingGroupId,
    inlineTodoText,
    setInlineTodoText,
    collapsedGroups,
    setCollapsedGroups,
    activeDragGroup,
    activeDragTodo,
    editingTodoId,
    setEditingTodoId,
    extractActionItems,
    hiddenBoardGroups,
    setHiddenBoardGroups,
    todoTotal,
    todoOffset,
    loadMoreTodos,
    setEditingTodoText,
    visibleFields,
    boardColumnSize = 'medium',
    toggleTodoTag,
    projectTags = [],
    createProjectTagInline,
    newInlineProjectTagName,
    setNewInlineProjectTagName,
    newInlineProjectTagColor,
    setNewInlineProjectTagColor,
    RANDOM_TAG_COLORS = []
}) {
    const columnWidthClass = boardColumnSize === 'small' ? 'w-52' : boardColumnSize === 'large' ? 'w-[400px]' : 'w-80';
    const [boardTagPickerId, setBoardTagPickerId] = useState(null);
    const [boardTagDropdownPos, setBoardTagDropdownPos] = useState(null);

    const createTodoInGroup = async (text, group) => {
        let tagIds = [];
        let options = {};
        if (todoGroupBy === 'project' && group.key !== '__untagged' && group.key !== '__all') {
            tagIds = [group.key];
        }
        if (todoGroupBy === 'date' && group.key !== '9999-99') {
            const today = new Date();
            today.setHours(12, 0, 0, 0);
            if (group.key === '01') { // Past Due - set to yesterday
                const d = new Date(today); d.setDate(d.getDate() - 1);
                options.due_date = d.toISOString();
            } else if (group.key === '02') { // Today
                options.due_date = today.toISOString();
            } else if (group.key === '03') { // Tomorrow
                const d = new Date(today); d.setDate(d.getDate() + 1);
                options.due_date = d.toISOString();
            } else if (group.key === '04') { // This Week - next weekday
                const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
                const d = new Date(today); d.setDate(d.getDate() + (7 - dayOfWeek));
                options.due_date = d.toISOString();
            } else if (group.key === '05') { // Next Week - Monday of next week
                const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
                const d = new Date(today); d.setDate(d.getDate() + (8 - dayOfWeek));
                options.due_date = d.toISOString();
            }
        }
        const todo = await createTodo(text, null, tagIds, options);
        if (todoGroupBy === 'status' && todo) {
            if (group.key === 'done') {
                updateTodo(todo.id, { is_done: true });
            } else if (group.key === 'archived') {
                updateTodo(todo.id, { archived_at: new Date().toISOString() });
            }
        }
    };

    return (
        <div onClick={(e) => {
            // Only close if clicking directly on the empty area, not on a todo item
            if (e.target === e.currentTarget) {
                setEditingTodoId(null);
            }
        }}>
            {todoTree.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                    <CheckSquare className="mx-auto mb-3" size={40} strokeWidth={1} />
                    <p className="text-lg font-medium">No todos found</p>
                    <p className="text-sm mt-1">Create a new todo or adjust your filters</p>
                </div>
            )}

            {/* Grouped Todo List */}
            {todoTree.length > 0 && (() => {
                return (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        {viewLayout === 'board' && groups.length > 1 ? (
                            /* ===== BOARD VIEW FOR TODOS ===== */
                            <>
                                <SortableContext items={groups.map(g => g.key)} strategy={horizontalListSortingStrategy}>
                                    <div className="flex gap-3 pb-4" style={{ minHeight: 'calc(100vh - 220px)', minWidth: 'min-content' }}>
                                        {groups.filter(g => !hiddenBoardGroups.includes(g.key)).map(group => (
                                            <div key={group.key} className={`flex-shrink-0 ${columnWidthClass} flex flex-col`}>
                                                <SortableGroupHeader group={group} isBoard={true} onHide={(key) => setHiddenBoardGroups(prev => [...prev, key])} onAdd={() => { setInlineAddingGroupId(group.key); setInlineTodoText(''); }} />
                                                <SortableContext items={group.todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                    <div className="space-y-1 flex-1 overflow-y-auto pr-1">
                                                        {group.todos.map(todo => (
                                                            <SortableBoardCard key={todo.id} todo={todo} editingTodoId={editingTodoId} setEditingTodoId={setEditingTodoId} setEditingTodoText={setEditingTodoText}>
                                                                <div className="px-2.5 py-1.5">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); updateTodo(todo.id, { is_done: !todo.is_done }); }}
                                                                            className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${todo.is_done ? 'bg-muted border-muted-foreground/20 text-muted-foreground/50' : 'border-muted-foreground/30 hover:border-primary'}`}
                                                                        >
                                                                            {todo.is_done && <CheckSquare size={9} />}
                                                                        </button>
                                                                        <span className={`text-xs flex-1 line-clamp-2 break-words leading-tight ${todo.is_done ? 'line-through text-muted-foreground' : ''}`}>{todo.text || 'Empty todo'}</span>
                                                                    </div>
                                                                    {visibleFields?.includes('tags') && (() => {
                                                                        const displayTags = todo.tags?.filter(t => todoGroupBy !== 'project' || t.type !== 'project');
                                                                        return (
                                                                            <div className="flex flex-wrap gap-1 mt-1 ml-5 relative">
                                                                                {displayTags && displayTags.length > 0 ? displayTags.map(t => (
                                                                                    <span
                                                                                        key={t.id}
                                                                                        className="px-1 py-0 rounded-full text-[8px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                                                                        style={{ backgroundColor: t.color + '20', color: t.color }}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                                            setBoardTagDropdownPos({ top: rect.bottom + 4, left: rect.left });
                                                                                            setBoardTagPickerId(boardTagPickerId === todo.id ? null : todo.id);
                                                                                        }}
                                                                                    >
                                                                                        {t.name}
                                                                                    </span>
                                                                                )) : (
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                                            setBoardTagDropdownPos({ top: rect.bottom + 4, left: rect.left });
                                                                                            setBoardTagPickerId(boardTagPickerId === todo.id ? null : todo.id);
                                                                                        }}
                                                                                        className="text-[8px] px-1 py-0 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 transition-colors"
                                                                                    >
                                                                                        No tag
                                                                                    </button>
                                                                                )}
                                                                                {boardTagPickerId === todo.id && boardTagDropdownPos && (
                                                                                    <>
                                                                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setBoardTagPickerId(null); setBoardTagDropdownPos(null); }} />
                                                                                        <div className="fixed z-50 w-48 bg-popover border rounded-lg shadow-lg py-1" style={{ top: boardTagDropdownPos.top, left: boardTagDropdownPos.left }} onClick={e => e.stopPropagation()}>
                                                                                            <div className="px-2 py-1.5 border-b">
                                                                                                <input
                                                                                                    type="text"
                                                                                                    value={newInlineProjectTagName}
                                                                                                    onChange={e => setNewInlineProjectTagName(e.target.value)}
                                                                                                    onKeyDown={e => { if (e.key === 'Enter') { createProjectTagInline(todo.id); setBoardTagPickerId(null); } }}
                                                                                                    placeholder="New tag..."
                                                                                                    className="flex-1 text-xs px-1.5 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring w-full"
                                                                                                    autoFocus
                                                                                                />
                                                                                                {newInlineProjectTagName.trim() && RANDOM_TAG_COLORS.length > 0 && (
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
                                                                        );
                                                                    })()}
                                                                    {/* Due date + sub-task indicators */}
                                                                    {(((visibleFields?.includes('daysTillDue') || visibleFields?.includes('dueDate')) && todo.due_date) || (visibleFields?.includes('actionItems') && (() => { const c = typeof todo.content === 'string' ? (() => { try { return JSON.parse(todo.content); } catch { return null; } })() : todo.content; return extractActionItems(c).length > 0; })())) && (
                                                                        <div className="flex items-center gap-1 mt-1 ml-5">
                                                                            {visibleFields?.includes('actionItems') && (() => {
                                                                                const content = typeof todo.content === 'string' ? (() => { try { return JSON.parse(todo.content); } catch { return null; } })() : todo.content;
                                                                                const actionItems = extractActionItems(content);
                                                                                if (actionItems.length === 0) return null;
                                                                                const total = actionItems.length;
                                                                                const done = actionItems.filter(t => t.isChecked).length;
                                                                                return (
                                                                                    <div className="flex items-center gap-0.5 px-1 py-0 rounded text-[8px] font-medium bg-muted/60 text-muted-foreground">
                                                                                        <CheckSquare size={7} />
                                                                                        <span>{done}/{total}</span>
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                            {(visibleFields?.includes('daysTillDue') || visibleFields?.includes('dueDate')) && todo.due_date && (() => {
                                                                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                                                                const due = new Date(todo.due_date); due.setHours(0, 0, 0, 0);
                                                                                const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
                                                                                const color = diff < 0 ? 'bg-red-100 text-red-600' : diff === 0 ? 'bg-orange-100 text-orange-600' : diff === 1 ? 'bg-yellow-100 text-yellow-600' : 'bg-muted/60 text-muted-foreground';
                                                                                const dueDateStr = new Date(todo.due_date).toISOString().split('T')[0];
                                                                                return (
                                                                                    <div className="relative flex items-center gap-1 cursor-pointer hover:opacity-70" onClick={(e) => { e.stopPropagation(); e.currentTarget.querySelector('input')?.showPicker(); }}>
                                                                                        {visibleFields?.includes('daysTillDue') && (
                                                                                            <span className={`px-1 py-0 rounded-full text-[8px] font-medium flex items-center gap-0.5 ${color}`}>
                                                                                                {todo.recurrence && <Repeat size={7} />}
                                                                                                {diff > 0 ? `+${diff}` : diff}d
                                                                                            </span>
                                                                                        )}
                                                                                        {visibleFields?.includes('dueDate') && (
                                                                                            <span className="text-[8px] text-muted-foreground">{new Date(todo.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                                                                        )}
                                                                                        <input
                                                                                            type="date"
                                                                                            defaultValue={dueDateStr}
                                                                                            onChange={(e) => { if (e.target.value) updateTodo(todo.id, { due_date: new Date(e.target.value).toISOString() }); }}
                                                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </SortableBoardCard>
                                                        ))}
                                                        {group.todos.length === 0 && (
                                                            <div className="text-center py-8 text-muted-foreground text-xs italic">No todos</div>
                                                        )}
                                                        {inlineAddingGroupId === group.key ? (
                                                            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 border rounded-lg bg-background shadow-sm">
                                                                <Plus size={14} className="text-muted-foreground" />
                                                                <Input
                                                                    autoFocus
                                                                    value={inlineTodoText}
                                                                    onChange={e => setInlineTodoText(e.target.value)}
                                                                    placeholder="New action..."
                                                                    className="h-7 text-xs flex-1 border-none focus-visible:ring-0 shadow-none px-0"
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter' && inlineTodoText.trim()) {
                                                                            createTodoInGroup(inlineTodoText.trim(), group);
                                                                            setInlineTodoText('');
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setInlineAddingGroupId(null);
                                                                            setInlineTodoText('');
                                                                        }
                                                                    }}
                                                                    onBlur={() => {
                                                                        if (inlineTodoText.trim()) {
                                                                            createTodoInGroup(inlineTodoText.trim(), group);
                                                                        }
                                                                        setInlineAddingGroupId(null);
                                                                        setInlineTodoText('');
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setInlineAddingGroupId(group.key); setInlineTodoText(''); }}
                                                                className="flex items-center gap-2 mt-2 py-1.5 px-2 text-xs text-muted-foreground hover:bg-muted/50 rounded-md transition-colors w-full text-left"
                                                            >
                                                                <Plus size={12} /> New action
                                                            </button>
                                                        )}
                                                    </div>
                                                </SortableContext>
                                            </div>
                                        ))}
                                    </div>
                                </SortableContext>
                            </>
                        ) : (
                            /* ===== LIST VIEW FOR TODOS ===== */
                            <>
                                <SortableContext items={groups.map(g => g.key)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-2">
                                        {groups.map(group => (
                                            <div key={group.key}>
                                                {group.label && (
                                                    <SortableGroupHeader
                                                        group={group}
                                                        isBoard={false}
                                                        collapsed={collapsedGroups.includes(group.key)}
                                                        onToggleCollapse={() => setCollapsedGroups(prev => prev.includes(group.key) ? prev.filter(k => k !== group.key) : [...prev, group.key])}
                                                        onAdd={() => { setInlineAddingGroupId(group.key); setInlineTodoText(''); }}
                                                    />
                                                )}
                                                {!collapsedGroups.includes(group.key) && (
                                                    <>
                                                        <SortableContext items={group.todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
                                                            <div className="space-y-0">
                                                                {group.todos.map(todo => (
                                                                    <TodoItemRow key={todo.id} todo={todo} />
                                                                ))}
                                                            </div>
                                                        </SortableContext>
                                                        {inlineAddingGroupId === group.key ? (
                                                            <div className="flex items-center gap-2 py-1 px-3 border rounded-lg bg-background shadow-sm">
                                                                <div className="w-5" />
                                                                <Plus size={14} className="text-muted-foreground" />
                                                                <Input
                                                                    autoFocus
                                                                    value={inlineTodoText}
                                                                    onChange={e => setInlineTodoText(e.target.value)}
                                                                    placeholder="New action..."
                                                                    className="h-7 text-sm flex-1 border-none focus-visible:ring-0 shadow-none px-0"
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter' && inlineTodoText.trim()) {
                                                                            createTodoInGroup(inlineTodoText.trim(), group);
                                                                            setInlineTodoText('');
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setInlineAddingGroupId(null);
                                                                            setInlineTodoText('');
                                                                        }
                                                                    }}
                                                                    onBlur={() => {
                                                                        if (inlineTodoText.trim()) {
                                                                            createTodoInGroup(inlineTodoText.trim(), group);
                                                                        }
                                                                        setInlineAddingGroupId(null);
                                                                        setInlineTodoText('');
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setInlineAddingGroupId(group.key); setInlineTodoText(''); }}
                                                                className="flex items-center gap-2 py-1 px-3 text-sm text-muted-foreground hover:bg-muted/50 rounded-md transition-colors w-full text-left opacity-60 hover:opacity-100 focus-visible:opacity-100"
                                                            >
                                                                <div className="w-5" />
                                                                <Plus size={14} /> New action
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </SortableContext>
                            </>
                        )}
                        <DragOverlay>
                            {activeDragGroup ? (
                                <div className={`opacity-90 shadow-xl border rounded-lg ${viewLayout === 'board' ? 'w-[280px] bg-muted/80 p-2' : 'p-2 bg-background'}`}>
                                    <div className="flex items-center gap-2">
                                        {activeDragGroup.color && (
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeDragGroup.color }} />
                                        )}
                                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide truncate">{activeDragGroup.label || 'All'}</h3>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#5BA89D20', color: '#5BA89D' }}>{activeDragGroup.todos.length}</span>
                                    </div>
                                </div>
                            ) : activeDragTodo ? (
                                <div className="bg-background border rounded-md shadow-lg px-3 py-2 flex items-center gap-2 opacity-90 cursor-grabbing">
                                    <span className={`text-sm ${activeDragTodo.is_done ? 'line-through text-muted-foreground' : ''}`}>
                                        {activeDragTodo.text || 'Empty todo'}
                                    </span>
                                    {activeDragTodo.tags?.map(tag => (
                                        <span
                                            key={tag.id}
                                            className="text-xs px-1.5 py-0.5 rounded-full"
                                            style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                        >
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                );
            })()}

            {/* Load More Button outside the DnD Context to avoid drag glitches */}
            {todoTree.length > 0 && groups.reduce((acc, g) => acc + g.todos.length, 0) < todoTotal && (
                <div className="pt-6 pb-12 flex justify-center">
                    <button
                        onClick={loadMoreTodos}
                        className="px-4 py-2 text-sm border font-medium rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                        Load More To-Dos ({todoTotal - groups.reduce((acc, g) => acc + g.todos.length, 0)} remaining)
                    </button>
                </div>
            )}
        </div>
    );
}
