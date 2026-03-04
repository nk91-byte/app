import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as TiptapNode, mergeAttributes, textblockTypeInputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useRef } from 'react';

// Add global style for collapsed content
if (typeof document !== 'undefined') {
  const styleId = 'collapsible-heading-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .collapsed-by-heading {
        display: none !important;
      }
      .debug-target {
        border: 2px solid red !important;
      }
    `;
    document.head.appendChild(style);
  }
}

// React component for the heading with collapse button
const HeadingNodeView = ({ node, updateAttributes, editor, getPos }) => {
  const [isCollapsed, setIsCollapsed] = useState(node.attrs.collapsed || false);
  const level = node.attrs.level;
  const wrapperRef = useRef(null);

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    updateAttributes({ collapsed: newCollapsed });
  };

  const HeadingTag = `h${level}`;
  // Reduced icon sizes so they fit better when pulled left with negative margin
  const iconSize = 12;

  // Smaller font sizes for headers - H3 same as body but bold, H2 slightly bigger, H1 slightly bigger than H2
  const fontSize = level === 1 ? '15px' : level === 2 ? '14px' : '13px';
  const fontWeight = 'bold';
  const lineHeight = '1.4';
  const marginBottom = '0';

  return (
    <NodeViewWrapper className="collapsible-heading-wrapper" ref={wrapperRef}>
      <HeadingTag
        className="flex items-center group"
        data-collapsed={isCollapsed}
        style={{
          fontSize,
          fontWeight,
          lineHeight,
          marginBottom,
          marginTop: '0'
        }}
      >
        <button
          onClick={toggleCollapse}
          contentEditable={false}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center flex-shrink-0"
          style={{ marginLeft: '-16px', width: '16px' }}
          type="button"
        >
          {isCollapsed ? (
            <ChevronRight size={iconSize} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={iconSize} className="text-muted-foreground" />
          )}
        </button>
        <NodeViewContent className="flex-1" as="span" />
      </HeadingTag>
    </NodeViewWrapper>
  );
};

// A ProseMirror Plugin implementation to hide nodes that fall under a collapsed heading
const getHeadingFoldDecorations = (doc) => {
  const decorations = [];

  // Track the current collapsing level state. If this is > 0, we are actively hiding items.
  let currentFoldLevel = null;

  doc.descendants((node, pos) => {
    // If it's another heading, check if we should break out of the fold or start a new fold
    if (node.type.name === 'heading') {
      const level = node.attrs.level;

      if (currentFoldLevel !== null && level <= currentFoldLevel) {
        // We hit a heading of the same or higher importance, end the previous fold.
        currentFoldLevel = null;
      }

      if (currentFoldLevel === null && node.attrs.collapsed) {
        // We just hit a heading that is collapsed! Start folding its contents.
        currentFoldLevel = level;
      }

      // The heading itself should never be hidden by its own fold, but CAN be hidden by a larger fold.
      if (currentFoldLevel !== null && currentFoldLevel < level) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, { class: 'collapsed-by-heading' })
        );
        return false; // Skip traversing children of this heading because the whole block is hidden
      }

      return true; // We don't hide this heading, traverse its children
    }

    // For all other block nodes (paragraphs, lists, etc)
    if (currentFoldLevel !== null && node.isBlock) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, { class: 'collapsed-by-heading' })
      );
      return false; // Skip traversing its children since the parent block is hidden
    }

    return true; // Keep traversing
  });

  return DecorationSet.create(doc, decorations);
};

export const CollapsibleHeadingPluginKey = new PluginKey('collapsibleHeadingPlugin');

export const CollapsibleHeading = TiptapNode.create({
  name: 'heading',

  priority: 1000,

  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5, 6],
    };
  },

  content: 'inline*',

  group: 'block',

  defining: true,

  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false,
      },
      collapsed: {
        default: false,
        parseHTML: element => element.getAttribute('data-collapsed') === 'true',
        renderHTML: attributes => {
          if (!attributes.collapsed) {
            return {};
          }
          return {
            'data-collapsed': attributes.collapsed,
          };
        },
      },
    };
  },

  parseHTML() {
    return this.options.levels.map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    }));
  },

  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel ? node.attrs.level : this.options.levels[0];

    return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setHeading: (attributes) => ({ commands }) => {
        return commands.setNode(this.name, attributes);
      },
      toggleHeading: (attributes) => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph', attributes);
      },
    };
  },

  addKeyboardShortcuts() {
    return this.options.levels.reduce(
      (items, level) => ({
        ...items,
        ...{
          [`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level }),
        },
      }),
      {}
    );
  },

  addInputRules() {
    return this.options.levels.map((level) => {
      return textblockTypeInputRule({
        find: new RegExp(`^(#{${level}})\\s$`),
        type: this.type,
        getAttributes: { level },
      });
    });
  },

  addNodeView() {
    return ReactNodeViewRenderer(HeadingNodeView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: CollapsibleHeadingPluginKey,
        state: {
          init: (_, { doc }) => getHeadingFoldDecorations(doc),
          apply: (tr, oldState) => {
            if (tr.docChanged) {
              return getHeadingFoldDecorations(tr.doc);
            }
            return oldState.map(tr.mapping, tr.doc);
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        }
      })
    ];
  },
});
