'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { InputRule, Extension, textInputRule } from '@tiptap/core';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CollapsibleHeading } from './extensions/CollapsibleHeading';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, CheckSquare, Undo2, Redo2, Heading1, Heading2, Heading3,
  Link as LinkIcon, Palette, Paintbrush, Table as TableIcon,
  Plus, Minus, Trash2, MergeIcon, Calendar, Tag, X, MoreHorizontal, Check
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CustomArrowExtension = Extension.create({
  name: 'customArrows',
  addInputRules() {
    return [
      textInputRule({ find: /-+-+>$/, replace: '→' }),
      textInputRule({ find: /->$/, replace: '→' }),
      textInputRule({ find: /-->$/, replace: '→' }),
      textInputRule({ find: /=>$/, replace: '⇒' }),
      textInputRule({ find: /==>$/, replace: '⇒' }),
      textInputRule({ find: /<-$/, replace: '←' }),
      textInputRule({ find: /<--$/, replace: '←' }),
      textInputRule({ find: /<=$/, replace: '⇐' }),
      textInputRule({ find: /<==$/, replace: '⇐' }),
      textInputRule({ find: /<->$/, replace: '↔' }),
      textInputRule({ find: /<=>$/, replace: '⇔' }),
    ];
  },
});

const HorizontalRuleSpaceInput = Extension.create({
  name: 'horizontalRuleSpaceInput',
  addInputRules() {
    return [
      new InputRule({
        find: /^---\s$/,
        handler: ({ state, range, chain }) => {
          chain().deleteRange(range).setHorizontalRule().run();
        },
      }),
    ];
  },
});

const CustomTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      todoId: {
        default: null,
        parseHTML: element => element.getAttribute('data-todo-id'),
        renderHTML: attributes => {
          if (!attributes.todoId) return {};
          return { 'data-todo-id': attributes.todoId };
        },
      },
      dueDate: {
        default: null,
        parseHTML: element => element.getAttribute('data-due-date'),
        renderHTML: attributes => {
          if (!attributes.dueDate) return {};
          return { 'data-due-date': attributes.dueDate };
        },
      },
      projectTagId: {
        default: null,
        parseHTML: element => element.getAttribute('data-project-tag-id'),
        renderHTML: attributes => {
          if (!attributes.projectTagId) return {};
          return { 'data-project-tag-id': attributes.projectTagId };
        },
      },
    };
  },
  addInputRules() {
    return [
      // . + space → unchecked task item
      new InputRule({
        find: /^\s*\.\s$/,
        handler: ({ state, range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run();
        },
      }),
      // [] + space → unchecked task item
      new InputRule({
        find: /^\s*\[\]\s$/,
        handler: ({ state, range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run();
        },
      }),
      // [ ] + space → unchecked task item
      new InputRule({
        find: /^\s*\[ \]\s$/,
        handler: ({ state, range, chain }) => {
          chain().deleteRange(range).toggleTaskList().run();
        },
      }),
      // [x] + space → checked task item
      new InputRule({
        find: /^\s*\[x\]\s$/i,
        handler: ({ state, range, chain }) => {
          chain().deleteRange(range).toggleTaskList().updateAttributes('taskItem', { checked: true }).run();
        },
      }),
    ];
  },
});

function ToolbarButton({ onClick, active, disabled, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1 rounded-md transition-colors ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}

const COLORS = [
  '#000000', '#6B7280', '#EF4444', '#F97316', '#EAB308',
  '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6',
];

export default function NoteEditor({ content, onUpdate, placeholder, toolbarOpen, onToolbarToggle, id, projectTags = [] }) {
  const isUpdatingRef = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  const onToolbarToggleRef = useRef(onToolbarToggle);
  const currentIdRef = useRef(id);
  const [activeTaskNode, setActiveTaskNode] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [bubbleMenuExpanded, setBubbleMenuExpanded] = useState(false);
  const editorWrapperRef = useRef(null);
  const [dueDateInput, setDueDateInput] = useState('');

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onToolbarToggleRef.current = onToolbarToggle;
  }, [onUpdate, onToolbarToggle]);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const colorPickerRef = useRef(null);
  const [copiedFormat, setCopiedFormat] = useState(null);
  const [formatPainterLocked, setFormatPainterLocked] = useState(false);
  const [isInTable, setIsInTable] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, // Disable default heading, we use CollapsibleHeading instead
        history: true,
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      CollapsibleHeading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Underline,
      TaskList,
      CustomTaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing...' }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
      }),
      TextStyle,
      Color,
      CustomArrowExtension,
      HorizontalRuleSpaceInput,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm focus:outline-none min-h-[120px] max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (!isUpdatingRef.current && onUpdateRef.current) {
        onUpdateRef.current(editor.getJSON());
      }
    },
  });

  useEffect(() => {
    if (editor && content) {
      const currentJSON = JSON.stringify(editor.getJSON());
      const newJSON = JSON.stringify(content);
      if (currentJSON !== newJSON) {
        isUpdatingRef.current = true;
        const { from, to } = editor.state.selection;
        editor.commands.setContent(content);
        try {
          const maxPos = editor.state.doc.content.size;
          const safeFrom = Math.min(from, maxPos);
          const safeTo = Math.min(to, maxPos);
          editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
        } catch (e) { }
        isUpdatingRef.current = false;
      }
    }
  }, [content, editor]);

  // Close color picker on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColorPicker]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (!linkUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const captureMarks = useCallback(() => {
    if (!editor) return null;
    const marks = {};
    marks.bold = editor.isActive('bold');
    marks.italic = editor.isActive('italic');
    marks.underline = editor.isActive('underline');
    marks.strike = editor.isActive('strike');
    const color = editor.getAttributes('textStyle').color;
    if (color) marks.color = color;
    return marks;
  }, [editor]);

  const copyFormat = useCallback(() => {
    if (!editor) return;
    if (copiedFormat) {
      setCopiedFormat(null);
      setFormatPainterLocked(false);
      return;
    }
    setCopiedFormat(captureMarks());
    setFormatPainterLocked(false);
  }, [editor, copiedFormat, captureMarks]);

  const copyFormatLocked = useCallback(() => {
    if (!editor) return;
    setCopiedFormat(captureMarks());
    setFormatPainterLocked(true);
  }, [editor, captureMarks]);

  const applyFormat = useCallback(() => {
    if (!editor || !copiedFormat) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    let chain = editor.chain().focus().unsetAllMarks();
    if (copiedFormat.bold) chain = chain.setBold();
    if (copiedFormat.italic) chain = chain.setItalic();
    if (copiedFormat.underline) chain = chain.setUnderline();
    if (copiedFormat.strike) chain = chain.setStrike();
    if (copiedFormat.color) chain = chain.setColor(copiedFormat.color);
    chain.run();
  }, [editor, copiedFormat]);

  // Track whether cursor is inside a table
  useEffect(() => {
    if (!editor) return;
    const update = () => setIsInTable(editor.isActive('table'));
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  // Track active task node for inline properties menu
  useEffect(() => {
    if (!editor) return;
    const updateTaskNode = () => {
      if (!editor.isActive('taskItem')) {
        setActiveTaskNode(null);
        setMenuPosition(null);
        return;
      }
      const { $from } = editor.state.selection;
      let taskNode = null;
      let taskPos = null;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type.name === 'taskItem') {
          taskNode = node;
          taskPos = $from.before(d);
          break;
        }
      }
      if (taskNode && editorWrapperRef.current) {
        setActiveTaskNode({ pos: taskPos, node: taskNode });
        // Compute position relative to editor wrapper
        const wrapperRect = editorWrapperRef.current.getBoundingClientRect();
        const coords = editor.view.coordsAtPos(taskPos + 1);
        const lineHeight = coords.bottom - coords.top;
        const topVal = coords.top - wrapperRect.top + (lineHeight / 2) - 12;
        setMenuPosition({ top: topVal });
      } else {
        setActiveTaskNode(null);
        setMenuPosition(null);
      }
    };
    editor.on('selectionUpdate', updateTaskNode);
    editor.on('transaction', updateTaskNode);
    return () => {
      editor.off('selectionUpdate', updateTaskNode);
      editor.off('transaction', updateTaskNode);
    };
  }, [editor]);

  // Apply format on mouseup after user finishes selecting text
  useEffect(() => {
    if (!editor || !copiedFormat) return;
    const el = editor.view.dom;
    const handleMouseUp = () => {
      setTimeout(() => {
        const { from, to } = editor.state.selection;
        if (from !== to) {
          applyFormat();
          if (!formatPainterLocked) setCopiedFormat(null);
        }
      }, 10);
    };
    el.addEventListener('mouseup', handleMouseUp);
    return () => el.removeEventListener('mouseup', handleMouseUp);
  }, [editor, copiedFormat, applyFormat, formatPainterLocked]);

  if (!editor) return null;

  const iconSize = 14;

  return (
    <div>
      {/* Toolbar (controlled by parent) */}
      {toolbarOpen && (
        <div className="flex flex-wrap items-center gap-0.5 p-1.5 border rounded-lg bg-muted/30 mb-3">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
            <Bold size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
            <Italic size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
            <UnderlineIcon size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
            <Strikethrough size={iconSize} />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
            <Heading1 size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
            <Heading2 size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
            <Heading3 size={iconSize} />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
            <List size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
            <ListOrdered size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task List">
            <CheckSquare size={iconSize} />
          </ToolbarButton>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Font Color */}
          <div className="relative" ref={colorPickerRef}>
            <ToolbarButton onClick={() => setShowColorPicker(!showColorPicker)} active={showColorPicker} title="Font Color">
              <Palette size={iconSize} />
            </ToolbarButton>
            {showColorPicker && (
              <div className="absolute left-0 top-8 z-50 bg-popover border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-[140px]">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowColorPicker(false);
                    }}
                    className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <button
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setShowColorPicker(false);
                  }}
                  className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform text-[8px] flex items-center justify-center text-muted-foreground"
                  title="Reset color"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Format Painter */}
          <button
            type="button"
            onClick={copyFormat}
            onDoubleClick={copyFormatLocked}
            title={formatPainterLocked ? "Format painter locked – click to cancel" : copiedFormat ? "Format painter active – select text to apply (click to cancel)" : "Copy format (double-click to lock)"}
            className={`p-1 rounded-md transition-colors cursor-pointer ${formatPainterLocked ? 'bg-primary text-primary-foreground ring-2 ring-primary/50' :
              copiedFormat ? 'bg-primary text-primary-foreground' :
                'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
          >
            <Paintbrush size={iconSize} />
          </button>

          {/* Hyperlink */}
          <div className="relative">
            <ToolbarButton
              onClick={() => {
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run();
                } else {
                  const existing = editor.getAttributes('link').href || '';
                  setLinkUrl(existing);
                  setShowLinkInput(!showLinkInput);
                }
              }}
              active={editor.isActive('link')}
              title="Insert Link"
            >
              <LinkIcon size={iconSize} />
            </ToolbarButton>
            {showLinkInput && (
              <div className="absolute left-0 top-8 z-50 bg-popover border rounded-lg shadow-lg p-2 flex items-center gap-1 w-64">
                <input
                  type="text"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
                  placeholder="https://example.com"
                  className="flex-1 text-xs px-2 py-1 rounded border bg-background outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
                <button onClick={setLink} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">
                  Set
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-border mx-0.5" />

          {/* Table */}
          {!isInTable ? (
            <ToolbarButton
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              title="Insert Table"
            >
              <TableIcon size={iconSize} />
            </ToolbarButton>
          ) : (
            <>
              <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column">
                <span className="flex items-center text-[9px] font-bold gap-px"><Plus size={8} />Col</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row">
                <span className="flex items-center text-[9px] font-bold gap-px"><Plus size={8} />Row</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
                <span className="flex items-center text-[9px] font-bold gap-px"><Minus size={8} />Col</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
                <span className="flex items-center text-[9px] font-bold gap-px"><Minus size={8} />Row</span>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().mergeOrSplit().run()} title="Merge/Split Cells">
                <MergeIcon size={iconSize} />
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
                <Trash2 size={iconSize} />
              </ToolbarButton>
            </>
          )}

          <div className="w-px h-4 bg-border mx-0.5" />

          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
            <Undo2 size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
            <Redo2 size={iconSize} />
          </ToolbarButton>
        </div>
      )}

      {/* Editor Content (borderless) */}
      <div ref={editorWrapperRef} className="relative overflow-visible">
        <EditorContent editor={editor} />

        {/* Inline Task Properties Menu - custom positioned */}
        {activeTaskNode && menuPosition && (
          <div
            className="absolute z-50 transition-all duration-75"
            style={{ top: menuPosition.top, right: 0 }}
          >
            <div className="flex items-center gap-px p-px bg-primary/10 border border-primary/20 rounded shadow-sm">
              {!bubbleMenuExpanded ? (
                <button
                  onClick={() => setBubbleMenuExpanded(true)}
                  className={`p-0.5 rounded hover:bg-muted transition-colors ${activeTaskNode.node.attrs.dueDate || activeTaskNode.node.attrs.projectTagId ? 'text-primary/70' : 'text-muted-foreground/40 hover:text-muted-foreground'
                    }`}
                  title="Task Options"
                >
                  <MoreHorizontal size={10} />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setBubbleMenuExpanded(false)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground/60 transition-colors"
                    title="Collapse Options"
                  >
                    <X size={10} />
                  </button>

                  <div className="w-px h-3 bg-border mr-1" />

                  {/* Due Date Picker */}
                  <div className="relative flex items-center">
                    <button
                      onClick={() => document.getElementById(`inline-date-${currentIdRef.current}`)?.showPicker()}
                      className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-dashed transition-colors ${activeTaskNode.node.attrs.dueDate ? 'border-primary/30 text-foreground bg-primary/5' : 'border-transparent text-muted-foreground hover:bg-muted'
                        }`}
                    >
                      <Calendar size={12} />
                      {activeTaskNode.node.attrs.dueDate ? (
                        <span>{new Date(activeTaskNode.node.attrs.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      ) : 'Date'}
                    </button>
                    <input
                      id={`inline-date-${currentIdRef.current}`}
                      type="date"
                      value={activeTaskNode.node.attrs.dueDate || ''}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        editor.chain().focus().setNodeSelection(activeTaskNode.pos).updateAttributes('taskItem', { dueDate: newDate || null }).setTextSelection(activeTaskNode.pos + 2).run();
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                    {activeTaskNode.node.attrs.dueDate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editor.chain().focus().setNodeSelection(activeTaskNode.pos).updateAttributes('taskItem', { dueDate: null }).setTextSelection(activeTaskNode.pos + 2).run();
                        }}
                        className="absolute -right-1 -top-1 p-0.5 bg-muted rounded-full text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={8} />
                      </button>
                    )}
                  </div>

                  <div className="w-px h-3 bg-border mx-0.5" />

                  {/* Tag Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-dashed transition-colors ${activeTaskNode.node.attrs.projectTagId ? 'border-primary/30 text-foreground bg-primary/5' : 'border-transparent text-muted-foreground hover:bg-muted'
                          }`}
                      >
                        <Tag size={12} />
                        {activeTaskNode.node.attrs.projectTagId ? (
                          projectTags.find(t => t.id === activeTaskNode.node.attrs.projectTagId)?.name || 'Project'
                        ) : 'Project'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="start" sideOffset={5}>
                      <div className="max-h-48 overflow-y-auto">
                        {projectTags.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-2 italic">No projects exist</p>
                        )}
                        {projectTags.map(tag => {
                          const isSelected = activeTaskNode.node.attrs.projectTagId === tag.id;
                          return (
                            <button
                              key={tag.id}
                              onClick={() => {
                                editor.chain().focus().setNodeSelection(activeTaskNode.pos).updateAttributes('taskItem', { projectTagId: isSelected ? null : tag.id }).setTextSelection(activeTaskNode.pos + 2).run();
                              }}
                              className="w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 rounded hover:bg-muted transition-colors"
                            >
                              <div className={`w-3 h-3 rounded flex items-center justify-center border ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
                                {isSelected && <Check size={8} />}
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
          </div>
        )}
      </div>
    </div>
  );
}
