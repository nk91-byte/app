'use client';

import { useState } from 'react';
import { Plus, Trash2, Star, ChevronDown, ChevronRight, Check, X } from 'lucide-react';

export default function SettingsPanel({ summaryPresets, defaultPresetId, onSavePresets, defaultTodoGroupBy, persistDefaultTodoGroupBy, defaultNoteGroupBy, persistDefaultNoteGroupBy }) {
  const [presets, setPresets] = useState(summaryPresets);
  const [defaultId, setDefaultId] = useState(defaultPresetId);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  // Track unsaved instruction edits per preset
  const [instructionDrafts, setInstructionDrafts] = useState({});

  const commit = (newPresets, newDefaultId) => {
    setPresets(newPresets);
    setDefaultId(newDefaultId);
    onSavePresets(newPresets, newDefaultId);
  };

  const createPreset = () => {
    if (!newName.trim()) return;
    const preset = { id: crypto.randomUUID(), name: newName.trim(), instruction: '' };
    const updated = [...presets, preset];
    commit(updated, defaultId);
    setAddingNew(false);
    setNewName('');
    setExpandedId(preset.id);
  };

  const deletePreset = (id) => {
    const updated = presets.filter(p => p.id !== id);
    const newDefault = defaultId === id ? null : defaultId;
    commit(updated, newDefault);
    setConfirmDeleteId(null);
  };

  const renamePreset = (id) => {
    if (!renameText.trim()) { setRenamingId(null); return; }
    const updated = presets.map(p => p.id === id ? { ...p, name: renameText.trim() } : p);
    commit(updated, defaultId);
    setRenamingId(null);
  };

  const saveInstruction = (id) => {
    const draft = instructionDrafts[id];
    if (draft === undefined) return; // no edit happened
    const updated = presets.map(p => p.id === id ? { ...p, instruction: draft } : p);
    commit(updated, defaultId);
    setInstructionDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const toggleDefault = (id) => {
    const newDefault = defaultId === id ? null : id;
    setDefaultId(newDefault);
    onSavePresets(presets, newDefault);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Summary Instructions</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* Default Grouping */}
        {persistDefaultTodoGroupBy && (
          <div className="max-w-2xl">
            <h3 className="text-xs font-semibold mb-1">Default Grouping</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Grouping applied when opening a view without a saved view active.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">To-Do List</span>
                <select
                  value={defaultTodoGroupBy || 'project'}
                  onChange={e => persistDefaultTodoGroupBy(e.target.value)}
                  className="text-xs h-7 pl-2 pr-6 rounded-md border bg-background appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="project">By Project</option>
                  <option value="status">By Status</option>
                  <option value="date">By Date</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">Notebook</span>
                <select
                  value={defaultNoteGroupBy || 'meeting'}
                  onChange={e => persistDefaultNoteGroupBy(e.target.value)}
                  className="text-xs h-7 pl-2 pr-6 rounded-md border bg-background appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="meeting">By Meeting</option>
                  <option value="date">By Date</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Summary Instructions */}
        <div className="max-w-2xl">
        <h3 className="text-xs font-semibold mb-1">Summary Instructions</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Named presets that guide AI summary generation. When generating a summary, choose a preset from the dropdown. A starred preset is the default.
        </p>

        <div className="space-y-2 max-w-2xl">
          {presets.length === 0 && !addingNew && (
            <p className="text-xs text-muted-foreground italic py-1">No presets yet.</p>
          )}

          {presets.map(preset => {
            const isDefault = defaultId === preset.id;
            const isExpanded = expandedId === preset.id;
            const isRenaming = renamingId === preset.id;
            const isConfirmingDelete = confirmDeleteId === preset.id;
            const instructionValue = instructionDrafts[preset.id] !== undefined
              ? instructionDrafts[preset.id]
              : preset.instruction;

            return (
              <div key={preset.id} className="border rounded-lg overflow-hidden">
                {/* Preset header row */}
                <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20">
                  {/* Name / rename */}
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameText}
                      onChange={e => setRenameText(e.target.value)}
                      onBlur={() => renamePreset(preset.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renamePreset(preset.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="flex-1 text-sm bg-transparent border-b border-primary/40 outline-none py-0.5"
                    />
                  ) : (
                    <button
                      className="flex-1 text-left text-sm font-medium hover:text-primary transition-colors truncate"
                      onClick={() => { setRenamingId(preset.id); setRenameText(preset.name); }}
                      title="Click to rename"
                    >
                      {preset.name}
                    </button>
                  )}

                  {/* Default star */}
                  <button
                    onClick={() => toggleDefault(preset.id)}
                    title={isDefault ? 'Default (click to unset)' : 'Set as default'}
                    className={`p-1 rounded transition-colors flex-shrink-0 ${isDefault ? 'text-primary' : 'text-muted-foreground/30 hover:text-muted-foreground'}`}
                  >
                    <Star size={13} fill={isDefault ? 'currentColor' : 'none'} />
                  </button>

                  {/* Expand/collapse */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>

                  {/* Delete */}
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[11px] text-destructive">Delete?</span>
                      <button onClick={() => deletePreset(preset.id)} className="p-0.5 rounded text-destructive hover:bg-destructive/10">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="p-0.5 rounded text-muted-foreground hover:bg-muted">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(preset.id)}
                      className="p-1 rounded text-muted-foreground/30 hover:text-destructive transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Instruction editor */}
                {isExpanded && (
                  <div className="p-3 border-t bg-background">
                    <p className="text-[11px] text-muted-foreground mb-1.5">Instruction — appended to the base prompt when this preset is selected</p>
                    <textarea
                      value={instructionValue}
                      onChange={e => setInstructionDrafts(prev => ({ ...prev, [preset.id]: e.target.value }))}
                      onBlur={() => saveInstruction(preset.id)}
                      placeholder="e.g. Always include a Risks section. Keep bullet points under 10 words each. Focus on decisions made."
                      className="w-full text-xs border rounded p-2 resize-y min-h-[80px] bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                      rows={4}
                    />
                    {isDefault && (
                      <p className="text-[11px] text-primary mt-1.5">★ This preset is the default</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new preset */}
          {addingNew ? (
            <div className="border rounded-lg p-3 space-y-2">
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createPreset();
                  if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
                }}
                placeholder="Preset name..."
                className="w-full text-sm border rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={createPreset}
                  className="text-xs px-3 py-1 rounded bg-primary text-white hover:opacity-90 transition-opacity"
                >
                  Create
                </button>
                <button
                  onClick={() => { setAddingNew(false); setNewName(''); }}
                  className="text-xs px-3 py-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 mt-1"
            >
              <Plus size={13} />
              New preset
            </button>
          )}
        </div>
        </div> {/* end Summary Instructions */}
      </div>
    </div>
  );
}
