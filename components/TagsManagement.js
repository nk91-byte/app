import { useState } from 'react';
import { Tag, Plus, Edit3, Trash2, Archive, ArchiveRestore, X, Check, MoreHorizontal, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TagsManagement({
    sourceTags,
    projectTags,
    archivedTags,
    showTagForm,
    setShowTagForm,
    newTagType,
    setNewTagType,
    newTagName,
    setNewTagName,
    newTagColor,
    setNewTagColor,
    createTag,
    TAG_COLORS,
    tagMenuId,
    setTagMenuId,
    editingTagId,
    setEditingTagId,
    editingTagName,
    setEditingTagName,
    editingTagColor,
    setEditingTagColor,
    updateTagDetails,
    archiveTag,
    deleteTag,
    showArchivedTags,
    setShowArchivedTags,
    loadArchivedTags,
    unarchiveTag,
    searchQuery
}) {
    const [showMeetingTags, setShowMeetingTags] = useState(false);
    const [showProjectTags, setShowProjectTags] = useState(false);
    const [showArchivedSection, setShowArchivedSection] = useState(false);
    const [showArchivedMeetingTags, setShowArchivedMeetingTags] = useState(false);
    const [showArchivedProjectTags, setShowArchivedProjectTags] = useState(false);

    // Filter tags based on search query
    const filteredSourceTags = sourceTags.filter(tag =>
        tag.name.toLowerCase().includes((searchQuery || '').toLowerCase())
    );
    const filteredProjectTags = projectTags.filter(tag =>
        tag.name.toLowerCase().includes((searchQuery || '').toLowerCase())
    );
    const filteredArchivedTags = archivedTags.filter(tag =>
        tag.name.toLowerCase().includes((searchQuery || '').toLowerCase())
    );

    // Separate archived tags by type
    const filteredArchivedSourceTags = filteredArchivedTags.filter(tag => tag.type === 'source');
    const filteredArchivedProjectTags = filteredArchivedTags.filter(tag => tag.type === 'project');
    return (
        <div className="h-full flex flex-col bg-background w-full">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-3 border-b flex items-center justify-between">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="text-primary" size={18} />
                    Tag Management
                </h1>
                <Button
                    onClick={() => setShowTagForm(!showTagForm)}
                    size="sm"
                    variant={showTagForm ? "outline" : "default"}
                >
                    <Plus size={14} className="mr-2" />
                    New Tag
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-6 max-w-6xl mx-auto space-y-6">
                    {/* Create New Tag Form */}
                    {showTagForm && (
                        <div className="border-b pb-4">
                            <div className="flex items-end gap-3">
                                <div className="flex-1 max-w-xs space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tag Name</label>
                                    <Input
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        placeholder="Enter tag name"
                                        className="h-9"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newTagName.trim()) {
                                                createTag();
                                            }
                                        }}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                                    <div className="flex gap-1">
                                        <Button
                                            onClick={() => setNewTagType('source')}
                                            variant={newTagType === 'source' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-9"
                                        >
                                            Meeting
                                        </Button>
                                        <Button
                                            onClick={() => setNewTagType('project')}
                                            variant={newTagType === 'project' ? 'default' : 'outline'}
                                            size="sm"
                                            className="h-9"
                                        >
                                            Project
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Color</label>
                                    <div className="flex gap-1">
                                        {TAG_COLORS.map((color, idx) => {
                                            const colorValue = typeof color === 'object' ? color.value : color;
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setNewTagColor(colorValue)}
                                                    className={`w-7 h-7 rounded border-2 transition-all ${
                                                        newTagColor === colorValue ? 'border-foreground scale-105' : 'border-transparent hover:scale-105'
                                                    }`}
                                                    style={{ backgroundColor: colorValue }}
                                                    title={colorValue}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                                <Button
                                    onClick={createTag}
                                    disabled={!newTagName.trim()}
                                    size="sm"
                                    className="h-9"
                                >
                                    <Check size={14} className="mr-2" />
                                    Create
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Meeting Tags Section */}
                    <div>
                        <button
                            onClick={() => setShowMeetingTags(!showMeetingTags)}
                            className="flex items-center justify-between mb-3 w-full text-left hover:opacity-80 transition-opacity"
                        >
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <ChevronRight
                                    size={14}
                                    className={`transition-transform ${showMeetingTags ? 'rotate-90' : ''}`}
                                />
                                Meeting Tags ({filteredSourceTags.length})
                            </h2>
                        </button>
                        {showMeetingTags && filteredSourceTags.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic py-8 text-center">
                                {searchQuery ? 'No matching meeting tags' : 'No meeting tags yet'}
                            </p>
                        ) : showMeetingTags && (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr className="border-b">
                                            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Color</th>
                                            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Name</th>
                                            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredSourceTags.map(tag => (
                                            <TagRow
                                                key={tag.id}
                                                tag={tag}
                                                tagType="source"
                                                editingTagId={editingTagId}
                                                setEditingTagId={setEditingTagId}
                                                editingTagName={editingTagName}
                                                setEditingTagName={setEditingTagName}
                                                editingTagColor={editingTagColor}
                                                setEditingTagColor={setEditingTagColor}
                                                updateTagDetails={updateTagDetails}
                                                archiveTag={archiveTag}
                                                deleteTag={deleteTag}
                                                TAG_COLORS={TAG_COLORS}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Project Tags Section */}
                    <div>
                        <button
                            onClick={() => setShowProjectTags(!showProjectTags)}
                            className="flex items-center justify-between mb-3 w-full text-left hover:opacity-80 transition-opacity"
                        >
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <ChevronRight
                                    size={14}
                                    className={`transition-transform ${showProjectTags ? 'rotate-90' : ''}`}
                                />
                                Project Tags ({filteredProjectTags.length})
                            </h2>
                        </button>
                        {showProjectTags && filteredProjectTags.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic py-8 text-center">
                                {searchQuery ? 'No matching project tags' : 'No project tags yet'}
                            </p>
                        ) : showProjectTags && (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-muted/50">
                                        <tr className="border-b">
                                            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Color</th>
                                            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Name</th>
                                            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredProjectTags.map(tag => (
                                            <TagRow
                                                key={tag.id}
                                                tag={tag}
                                                tagType="project"
                                                editingTagId={editingTagId}
                                                setEditingTagId={setEditingTagId}
                                                editingTagName={editingTagName}
                                                setEditingTagName={setEditingTagName}
                                                editingTagColor={editingTagColor}
                                                setEditingTagColor={setEditingTagColor}
                                                updateTagDetails={updateTagDetails}
                                                archiveTag={archiveTag}
                                                deleteTag={deleteTag}
                                                TAG_COLORS={TAG_COLORS}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Archived Tags Section */}
                    <div>
                        <button
                            onClick={() => {
                                const newState = !showArchivedSection;
                                setShowArchivedSection(newState);
                                if (newState) {
                                    loadArchivedTags();
                                }
                            }}
                            className="flex items-center justify-between mb-3 w-full text-left hover:opacity-80 transition-opacity"
                        >
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <ChevronRight
                                    size={14}
                                    className={`transition-transform ${showArchivedSection ? 'rotate-90' : ''}`}
                                />
                                Archived Tags ({filteredArchivedTags.length})
                            </h2>
                        </button>

                        {showArchivedSection && (
                            <div className="space-y-6 pl-4">
                                {/* Archived Meeting Tags */}
                                <div>
                                    <button
                                        onClick={() => setShowArchivedMeetingTags(!showArchivedMeetingTags)}
                                        className="flex items-center justify-between mb-3 w-full text-left hover:opacity-80 transition-opacity"
                                    >
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <ChevronRight
                                                size={14}
                                                className={`transition-transform ${showArchivedMeetingTags ? 'rotate-90' : ''}`}
                                            />
                                            Archived Meeting Tags ({filteredArchivedSourceTags.length})
                                        </h3>
                                    </button>
                                    {showArchivedMeetingTags && filteredArchivedSourceTags.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic py-8 text-center">
                                            {searchQuery ? 'No matching archived meeting tags' : 'No archived meeting tags'}
                                        </p>
                                    ) : showArchivedMeetingTags && (
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-muted/50">
                                                    <tr className="border-b">
                                                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Color</th>
                                                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Name</th>
                                                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {filteredArchivedSourceTags.map(tag => (
                                                        <tr key={tag.id} className="hover:bg-muted/30">
                                                            <td className="px-4 py-2.5">
                                                                <div
                                                                    className="w-4 h-4 rounded-full"
                                                                    style={{ backgroundColor: tag.color }}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-sm">{tag.name}</td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <Button
                                                                    onClick={() => unarchiveTag(tag.id)}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                >
                                                                    <ArchiveRestore size={14} className="mr-2" />
                                                                    Unarchive
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Archived Project Tags */}
                                <div>
                                    <button
                                        onClick={() => setShowArchivedProjectTags(!showArchivedProjectTags)}
                                        className="flex items-center justify-between mb-3 w-full text-left hover:opacity-80 transition-opacity"
                                    >
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                            <ChevronRight
                                                size={14}
                                                className={`transition-transform ${showArchivedProjectTags ? 'rotate-90' : ''}`}
                                            />
                                            Archived Project Tags ({filteredArchivedProjectTags.length})
                                        </h3>
                                    </button>
                                    {showArchivedProjectTags && filteredArchivedProjectTags.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic py-8 text-center">
                                            {searchQuery ? 'No matching archived project tags' : 'No archived project tags'}
                                        </p>
                                    ) : showArchivedProjectTags && (
                                        <div className="border rounded-lg overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-muted/50">
                                                    <tr className="border-b">
                                                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Color</th>
                                                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Name</th>
                                                        <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {filteredArchivedProjectTags.map(tag => (
                                                        <tr key={tag.id} className="hover:bg-muted/30">
                                                            <td className="px-4 py-2.5">
                                                                <div
                                                                    className="w-4 h-4 rounded-full"
                                                                    style={{ backgroundColor: tag.color }}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-sm">{tag.name}</td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <Button
                                                                    onClick={() => unarchiveTag(tag.id)}
                                                                    variant="ghost"
                                                                    size="sm"
                                                                >
                                                                    <ArchiveRestore size={14} className="mr-2" />
                                                                    Unarchive
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

function TagRow({
    tag,
    tagType,
    editingTagId,
    setEditingTagId,
    editingTagName,
    setEditingTagName,
    editingTagColor,
    setEditingTagColor,
    updateTagDetails,
    archiveTag,
    deleteTag,
    TAG_COLORS
}) {
    const isEditing = editingTagId === tag.id;

    if (isEditing) {
        return (
            <tr className="bg-muted/30">
                <td className="px-4 py-2.5" colSpan="3">
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tag Name</label>
                            <Input
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                placeholder="Tag name"
                                className="h-8 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingTagName.trim()) {
                                        updateTagDetails(tag.id, editingTagName, editingTagColor, tagType);
                                    }
                                    if (e.key === 'Escape') setEditingTagId(null);
                                }}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Color</label>
                            <div className="flex gap-1">
                                {TAG_COLORS.map((color, idx) => {
                                    const colorValue = typeof color === 'object' ? color.value : color;
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => setEditingTagColor(colorValue)}
                                            className={`w-6 h-6 rounded border-2 transition-all ${
                                                editingTagColor === colorValue ? 'border-foreground scale-105' : 'border-transparent hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: colorValue }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                onClick={() => updateTagDetails(tag.id, editingTagName, editingTagColor, tagType)}
                                disabled={!editingTagName.trim()}
                                size="sm"
                                className="h-8"
                            >
                                <Check size={14} className="mr-1" />
                                Save
                            </Button>
                            <Button
                                onClick={() => setEditingTagId(null)}
                                variant="outline"
                                size="sm"
                                className="h-8"
                            >
                                <X size={14} />
                            </Button>
                        </div>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <tr className="hover:bg-muted/30 group">
            <td className="px-4 py-2.5">
                <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: tag.color }}
                />
            </td>
            <td className="px-4 py-2.5 text-sm">{tag.name}</td>
            <td className="px-4 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        onClick={() => {
                            setEditingTagId(tag.id);
                            setEditingTagName(tag.name);
                            setEditingTagColor(tag.color);
                        }}
                        variant="ghost"
                        size="sm"
                    >
                        <Edit3 size={14} />
                    </Button>
                    <Button
                        onClick={() => archiveTag(tag.id, tagType)}
                        variant="ghost"
                        size="sm"
                    >
                        <Archive size={14} />
                    </Button>
                    <Button
                        onClick={() => {
                            if (confirm(`Delete "${tag.name}"? This cannot be undone.`)) {
                                deleteTag(tag.id, tagType);
                            }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                    >
                        <Trash2 size={14} />
                    </Button>
                </div>
            </td>
        </tr>
    );
}
