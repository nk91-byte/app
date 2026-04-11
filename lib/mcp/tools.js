import { v4 as uuidv4 } from 'uuid';

// ===== TIPTAP PLAIN TEXT EXTRACTOR =====

// Block-level node types that should be followed by a newline.
// Inner table nodes (tableRow, tableCell, tableHeader) are intentionally
// excluded to avoid 3-4 consecutive newlines per table cell.
const OUTER_BLOCK_TYPES = new Set([
  'doc', 'paragraph', 'heading', 'bulletList', 'orderedList',
  'listItem', 'taskList', 'taskItem', 'blockquote', 'codeBlock', 'table',
]);

export function tiptapToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  const children = (node.content || []).map(tiptapToText).join('');
  return OUTER_BLOCK_TYPES.has(node.type) ? children + '\n' : children;
}

// ===== PLAIN TEXT TO TIPTAP =====

function plainTextToTiptap(text) {
  if (!text || !text.trim()) return { type: 'doc', content: [{ type: 'paragraph' }] };
  const paragraphs = text.split('\n').map(line => {
    if (!line) return { type: 'paragraph' };
    return { type: 'paragraph', content: [{ type: 'text', text: line }] };
  });
  return { type: 'doc', content: paragraphs };
}

// ===== TAG RESOLVER =====

async function resolveTagIdByName(supabase, ownerId, tagName) {
  const { data } = await supabase
    .from('tags')
    .select('id')
    .eq('owner_id', ownerId)
    .ilike('name', tagName)
    .is('archived_at', null)
    .limit(1)
    .single();
  return data?.id || null;
}

// ===== TOOL IMPLEMENTATIONS =====

export async function searchNotes(supabase, ownerId, args) {
  const { query, tag, limit = 20 } = args;

  let noteIds = null;

  if (tag) {
    const tagId = await resolveTagIdByName(supabase, ownerId, tag);
    if (!tagId) return JSON.stringify([]);
    const { data: ntRows } = await supabase
      .from('note_tags').select('note_id').eq('tag_id', tagId);
    noteIds = (ntRows || []).map(r => r.note_id);
    if (noteIds.length === 0) return JSON.stringify([]);
  }

  let q = supabase
    .from('notes')
    .select('id, title, content, created_at, note_tags(tags(name))')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (noteIds) q = q.in('id', noteIds);

  if (query) {
    const safe = query.replace(/,/g, '');
    q = q.or(`title.ilike.%${safe}%,content::text.ilike.%${safe}%`);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const results = (data || []).map(n => {
    const tags = (n.note_tags || []).map(nt => nt.tags?.name).filter(Boolean);
    const plainText = tiptapToText(n.content);
    const snippet = plainText.replace(/\n+/g, ' ').trim().slice(0, 200);
    return { id: n.id, title: n.title, created_at: n.created_at, tags, snippet };
  });

  return JSON.stringify(results, null, 2);
}

export async function getNote(supabase, ownerId, args) {
  const { id } = args;

  const { data: note, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .single();

  if (error || !note) throw new Error('Note not found');

  const { data: noteTags } = await supabase
    .from('note_tags').select('tags(name)').eq('note_id', id);
  const tags = (noteTags || []).map(nt => nt.tags?.name).filter(Boolean);

  const plain_text = tiptapToText(note.content).trim();

  const transcript_text = note.transcript?.utterances?.length
    ? note.transcript.utterances.map(u => `${u.speaker}: ${u.text}`).join('\n')
    : null;

  const result = {
    id: note.id,
    title: note.title,
    created_at: note.created_at,
    updated_at: note.updated_at,
    tags,
    plain_text,
    summary: note.summary || null,
    ai_action_items: note.ai_action_items || null,
    transcript: transcript_text,
  };

  return JSON.stringify(result, null, 2);
}

export async function listTodos(supabase, ownerId, args) {
  const { status = 'open', search, tag, due_before, due_after, limit = 50 } = args;

  let todoIds = null;

  if (tag) {
    const tagId = await resolveTagIdByName(supabase, ownerId, tag);
    if (!tagId) return JSON.stringify([]);
    const { data: ttRows } = await supabase
      .from('todo_tags').select('todo_id').eq('tag_id', tagId);
    todoIds = (ttRows || []).map(r => r.todo_id);
    if (todoIds.length === 0) return JSON.stringify([]);
  }

  let q = supabase
    .from('todos')
    .select('id, text, is_done, due_date, created_at, done_at, todo_tags(tags(name))')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'open') {
    q = q.eq('is_done', false).is('archived_at', null);
  } else if (status === 'done') {
    q = q.eq('is_done', true).is('archived_at', null);
  }
  // 'all' applies no status filter

  if (search) {
    q = q.ilike('text', `%${search.replace(/,/g, '')}%`);
  }

  if (due_before) q = q.lte('due_date', due_before);
  if (due_after) q = q.gte('due_date', due_after);
  if (todoIds) q = q.in('id', todoIds);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const results = (data || []).map(t => {
    const tags = (t.todo_tags || []).map(tt => tt.tags?.name).filter(Boolean);
    const { todo_tags, ...rest } = t;
    return { ...rest, tags };
  });

  return JSON.stringify(results, null, 2);
}

export async function listTags(supabase, ownerId, args) {
  const { type = 'all' } = args;

  let q = supabase
    .from('tags')
    .select('id, name, type, color')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('position', { ascending: true });

  if (type !== 'all') q = q.eq('type', type);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return JSON.stringify(data || [], null, 2);
}

export async function createNote(supabase, ownerId, args) {
  const { title, text } = args;
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const content = plainTextToTiptap(text || '');

  const { data, error } = await supabase
    .from('notes')
    .insert({ id, owner_id: ownerId, title: title || '', content, created_at: timestamp, updated_at: timestamp })
    .select('id, title, created_at')
    .single();

  if (error) throw new Error(error.message);
  return JSON.stringify(data, null, 2);
}

export async function createTodo(supabase, ownerId, args) {
  const { text, due_date } = args;
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from('todos')
    .insert({
      id, owner_id: ownerId, text: text || '',
      is_done: false, due_date: due_date || null,
      created_at: timestamp, updated_at: timestamp,
    })
    .select('id, text, due_date, created_at')
    .single();

  if (error) throw new Error(error.message);
  return JSON.stringify(data, null, 2);
}

export async function updateNote(supabase, ownerId, args) {
  const { id, title, text } = args;

  const { data: existing, error: fetchErr } = await supabase
    .from('notes').select('*').eq('id', id).eq('owner_id', ownerId).single();
  if (fetchErr || !existing) throw new Error('Note not found');

  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (text !== undefined) updates.content = plainTextToTiptap(text);

  const { error } = await supabase.from('notes').update(updates).eq('id', id);
  if (error) throw new Error(error.message);

  return JSON.stringify({ id, updated: true }, null, 2);
}

export async function updateTodo(supabase, ownerId, args) {
  const { id, text, notes, is_done, due_date } = args;

  const { data: existing, error: fetchErr } = await supabase
    .from('todos').select('*').eq('id', id).eq('owner_id', ownerId).single();
  if (fetchErr || !existing) throw new Error('Todo not found');

  const now = () => new Date().toISOString();
  const newText    = text     !== undefined ? text     : existing.text;
  const newIsDone  = is_done  !== undefined ? is_done  : existing.is_done;
  const newDueDate = due_date !== undefined ? due_date : existing.due_date;
  const newContent = notes    !== undefined ? plainTextToTiptap(notes) : existing.content;

  const isDoneChanged = is_done !== undefined && is_done !== existing.is_done;
  const doneAt = newIsDone ? (isDoneChanged ? now() : existing.done_at) : null;

  const { error } = await supabase.from('todos').update({
    text: newText,
    content: newContent,
    is_done: newIsDone,
    done_at: doneAt,
    due_date: newDueDate,
    updated_at: now(),
  }).eq('id', id);
  if (error) throw new Error(error.message);

  // Sync text/done change back into the parent note's tiptap content
  if (existing.note_id && (text !== undefined || is_done !== undefined)) {
    const { data: note } = await supabase.from('notes').select('*').eq('id', existing.note_id).single();
    if (note?.content) {
      const updatedContent = updateTodoInNoteContent(
        JSON.parse(JSON.stringify(note.content)), id, newText, newIsDone
      );
      await supabase.from('notes').update({ content: updatedContent, updated_at: now() }).eq('id', existing.note_id);
    }
  }

  return JSON.stringify({ id, updated: true }, null, 2);
}

// Walk tiptap tree and update a taskItem matching todoId
function updateTodoInNoteContent(node, todoId, newText, isChecked) {
  if (node.type === 'taskItem' && node.attrs?.todoId === todoId) {
    node.attrs.checked = isChecked;
    if (node.content) {
      for (const child of node.content) {
        if (child.type === 'paragraph') {
          child.content = [{ type: 'text', text: newText }];
          break;
        }
      }
    }
    return node;
  }
  if (node.content) node.content = node.content.map(c => updateTodoInNoteContent(c, todoId, newText, isChecked));
  return node;
}
