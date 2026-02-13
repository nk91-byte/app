import { NextResponse } from 'next/server';
import { getDb, SCHEMA_SQL } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_OWNER = '00000000-0000-0000-0000-000000000001';

// ===== PARSE HELPERS =====
function parseJsonField(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

function parseNote(note) {
  if (!note) return note;
  return { ...note, content: parseJsonField(note.content) };
}

// ===== HELPER FUNCTIONS =====

function getTextFromNode(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content) return node.content.map(getTextFromNode).join('');
  return '';
}

function extractTextFromTaskItem(taskItemNode) {
  let text = '';
  if (taskItemNode.content) {
    for (const child of taskItemNode.content) {
      if (child.type !== 'taskList') {
        text += getTextFromNode(child);
      }
    }
  }
  return text.trim();
}

function extractTaskItems(node, parentItemIndex = null, items = []) {
  if (node.type === 'taskItem') {
    const currentIndex = items.length;
    items.push({
      index: currentIndex,
      todoId: node.attrs?.todoId || null,
      checked: node.attrs?.checked || false,
      text: extractTextFromTaskItem(node),
      parentItemIndex: parentItemIndex,
    });
    if (node.content) {
      for (const child of node.content) {
        if (child.type === 'taskList') {
          for (const grandChild of (child.content || [])) {
            extractTaskItems(grandChild, currentIndex, items);
          }
        }
      }
    }
  } else if (node.content) {
    for (const child of node.content) {
      extractTaskItems(child, parentItemIndex, items);
    }
  }
  return items;
}

function updateContentTodoIds(node, items, counter = { idx: 0 }) {
  if (node.type === 'taskItem') {
    if (!node.attrs) node.attrs = {};
    if (counter.idx < items.length) {
      node.attrs.todoId = items[counter.idx].todoId;
      counter.idx++;
    }
    if (node.content) {
      for (const child of node.content) {
        if (child.type === 'taskList') {
          for (const grandChild of (child.content || [])) {
            updateContentTodoIds(grandChild, items, counter);
          }
        }
      }
    }
  } else if (node.content) {
    for (const child of node.content) {
      updateContentTodoIds(child, items, counter);
    }
  }
  return node;
}

function updateTodoInContent(content, todoId, newText, isChecked) {
  if (!content) return content;
  function walk(node) {
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
      return true;
    }
    if (node.content) {
      for (const child of node.content) {
        if (walk(child)) return true;
      }
    }
    return false;
  }
  walk(content);
  return content;
}

function insertTaskItemIntoContent(content, todoId, text) {
  if (!content) {
    return {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false, todoId: todoId },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: text }] }]
            }
          ]
        }
      ]
    };
  }
  const taskList = content.content?.find(n => n.type === 'taskList');
  if (taskList) {
    taskList.content = taskList.content || [];
    taskList.content.push({
      type: 'taskItem',
      attrs: { checked: false, todoId: todoId },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: text }] }]
    });
  } else {
    content.content = content.content || [];
    content.content.push({
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false, todoId: todoId },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: text }] }]
        }
      ]
    });
  }
  return content;
}

// ===== DB SETUP =====

async function setupDatabase() {
  const sql = getDb();
  try {
    await sql.unsafe(SCHEMA_SQL);
    return NextResponse.json({ success: true, message: 'Database schema created' });
  } catch (error) {
    console.error('Schema setup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ===== NOTES HANDLERS =====

async function getNotes(searchParams) {
  const sql = getDb();
  const search = searchParams.get('search') || '';
  const tagId = searchParams.get('tag') || '';
  const ownerId = searchParams.get('owner_id') || DEFAULT_OWNER;

  let notes;
  if (tagId) {
    notes = await sql`
      SELECT DISTINCT n.* FROM notes n
      JOIN note_tags nt ON n.id = nt.note_id
      WHERE n.owner_id = ${ownerId}
      AND nt.tag_id = ${tagId}
      ${search ? sql`AND (n.title ILIKE ${'%' + search + '%'})` : sql``}
      ORDER BY n.updated_at DESC
    `;
  } else {
    notes = await sql`
      SELECT * FROM notes
      WHERE owner_id = ${ownerId}
      ${search ? sql`AND (title ILIKE ${'%' + search + '%'})` : sql``}
      ORDER BY updated_at DESC
    `;
  }

  const noteIds = notes.map(n => n.id);
  let noteTags = [];
  if (noteIds.length > 0) {
    noteTags = await sql`
      SELECT nt.note_id, t.* FROM note_tags nt
      JOIN tags t ON nt.tag_id = t.id
      WHERE nt.note_id = ANY(${noteIds})
    `;
  }

  const noteTagMap = {};
  for (const nt of noteTags) {
    if (!noteTagMap[nt.note_id]) noteTagMap[nt.note_id] = [];
    noteTagMap[nt.note_id].push({ id: nt.id, name: nt.name, type: nt.type, color: nt.color });
  }

  const result = notes.map(n => ({
    ...parseNote(n),
    tags: noteTagMap[n.id] || [],
  }));

  return NextResponse.json(result);
}

async function createNote(body) {
  const sql = getDb();
  const { title, content, owner_id } = body;
  const ownerId = owner_id || DEFAULT_OWNER;
  const id = uuidv4();

  const [note] = await sql`
    INSERT INTO notes (id, owner_id, title, content)
    VALUES (${id}, ${ownerId}, ${title || ''}, ${content ? JSON.stringify(content) : null}::jsonb)
    RETURNING *
  `;

  return NextResponse.json(parseNote(note), { status: 201 });
}

async function getNote(id) {
  const sql = getDb();
  const [note] = await sql`SELECT * FROM notes WHERE id = ${id}`;
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  const tags = await sql`
    SELECT t.* FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ${id}
  `;

  return NextResponse.json({ ...parseNote(note), tags });
}

async function updateNote(id, body) {
  const sql = getDb();
  const { title, content, tags: tagIds } = body;

  const [existing] = await sql`SELECT * FROM notes WHERE id = ${id}`;
  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  const existingParsed = parseNote(existing);

  let updatedContent = content;
  if (content) {
    const taskItems = extractTaskItems(content);
    const existingTodos = await sql`SELECT * FROM todos WHERE note_id = ${id} AND archived_at IS NULL`;
    const existingTodoMap = new Map(existingTodos.map(t => [t.id, t]));
    const contentTodoIds = new Set();

    for (let i = 0; i < taskItems.length; i++) {
      const item = taskItems[i];
      const parentTodoId = item.parentItemIndex !== null && item.parentItemIndex < i
        ? taskItems[item.parentItemIndex].todoId
        : null;

      if (item.todoId && existingTodoMap.has(item.todoId)) {
        contentTodoIds.add(item.todoId);
        const existingTodo = existingTodoMap.get(item.todoId);
        const isDoneChanged = item.checked !== existingTodo.is_done;
        await sql`
          UPDATE todos SET
            text = ${item.text},
            is_done = ${item.checked},
            done_at = ${item.checked && isDoneChanged ? new Date() : (item.checked ? existingTodo.done_at : null)},
            parent_todo_id = ${parentTodoId},
            updated_at = NOW()
          WHERE id = ${item.todoId}
        `;
      } else {
        const newId = uuidv4();
        await sql`
          INSERT INTO todos (id, owner_id, note_id, parent_todo_id, text, is_done, done_at, position)
          VALUES (${newId}, ${existing.owner_id}, ${id}, ${parentTodoId}, ${item.text}, ${item.checked}, ${item.checked ? new Date() : null}, ${i})
        `;
        taskItems[i].todoId = newId;
        contentTodoIds.add(newId);
      }
    }

    for (const [todoId, todo] of existingTodoMap) {
      if (!contentTodoIds.has(todoId)) {
        await sql`UPDATE todos SET archived_at = NOW(), updated_at = NOW() WHERE id = ${todoId}`;
      }
    }

    updatedContent = JSON.parse(JSON.stringify(content));
    updateContentTodoIds(updatedContent, taskItems);
  }

  const [note] = await sql`
    UPDATE notes SET
      title = ${title !== undefined ? title : existing.title},
      content = ${updatedContent ? JSON.stringify(updatedContent) : null}::jsonb,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (tagIds !== undefined) {
    await sql`DELETE FROM note_tags WHERE note_id = ${id}`;
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await sql`INSERT INTO note_tags (note_id, tag_id) VALUES (${id}, ${tagId}) ON CONFLICT DO NOTHING`;
      }
    }
  }

  const tags = await sql`SELECT t.* FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id = ${id}`;
  return NextResponse.json({ ...parseNote(note), tags });
}

async function deleteNote(id) {
  const sql = getDb();
  await sql`UPDATE todos SET note_id = NULL WHERE note_id = ${id}`;
  await sql`DELETE FROM notes WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}

// ===== TODOS HANDLERS =====

async function getTodos(searchParams) {
  const sql = getDb();
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'open';
  const tagId = searchParams.get('tag') || '';
  const showArchived = searchParams.get('show_archived') === 'true';
  const ownerId = searchParams.get('owner_id') || DEFAULT_OWNER;

  let todos;
  if (tagId) {
    todos = await sql`
      SELECT DISTINCT t.* FROM todos t
      JOIN todo_tags tt ON t.id = tt.todo_id
      WHERE t.owner_id = ${ownerId}
      AND tt.tag_id = ${tagId}
      ${!showArchived ? sql`AND t.archived_at IS NULL` : sql``}
      ${status === 'open' ? sql`AND t.is_done = FALSE` : sql``}
      ${status === 'done' ? sql`AND t.is_done = TRUE` : sql``}
      ${search ? sql`AND t.text ILIKE ${'%' + search + '%'}` : sql``}
      ORDER BY t.position ASC NULLS LAST, t.created_at DESC
    `;
  } else {
    todos = await sql`
      SELECT * FROM todos
      WHERE owner_id = ${ownerId}
      ${!showArchived ? sql`AND archived_at IS NULL` : sql``}
      ${status === 'open' ? sql`AND is_done = FALSE` : sql``}
      ${status === 'done' ? sql`AND is_done = TRUE` : sql``}
      ${search ? sql`AND text ILIKE ${'%' + search + '%'}` : sql``}
      ORDER BY position ASC NULLS LAST, created_at DESC
    `;
  }

  const todoIds = todos.map(t => t.id);
  let todoTags = [];
  if (todoIds.length > 0) {
    todoTags = await sql`
      SELECT tt.todo_id, tg.* FROM todo_tags tt
      JOIN tags tg ON tt.tag_id = tg.id
      WHERE tt.todo_id = ANY(${todoIds})
    `;
  }

  const todoTagMap = {};
  for (const tt of todoTags) {
    if (!todoTagMap[tt.todo_id]) todoTagMap[tt.todo_id] = [];
    todoTagMap[tt.todo_id].push({ id: tt.id, name: tt.name, type: tt.type, color: tt.color });
  }

  const result = todos.map(t => ({
    ...t,
    tags: todoTagMap[t.id] || [],
  }));

  return NextResponse.json(result);
}

async function createTodo(body) {
  const sql = getDb();
  const { text, note_id, parent_todo_id, owner_id, position } = body;
  const ownerId = owner_id || DEFAULT_OWNER;
  const id = uuidv4();

  const [todo] = await sql`
    INSERT INTO todos (id, owner_id, note_id, parent_todo_id, text, position)
    VALUES (${id}, ${ownerId}, ${note_id || null}, ${parent_todo_id || null}, ${text || ''}, ${position || null})
    RETURNING *
  `;

  if (note_id) {
    const [note] = await sql`SELECT * FROM notes WHERE id = ${note_id}`;
    if (note) {
      const updatedContent = insertTaskItemIntoContent(note.content || { type: 'doc', content: [] }, id, text || '');
      await sql`UPDATE notes SET content = ${JSON.stringify(updatedContent)}::jsonb, updated_at = NOW() WHERE id = ${note_id}`;
    }
  }

  return NextResponse.json(todo, { status: 201 });
}

async function updateTodo(id, body) {
  const sql = getDb();
  const { text, is_done, note_id } = body;

  const [existing] = await sql`SELECT * FROM todos WHERE id = ${id}`;
  if (!existing) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

  const newText = text !== undefined ? text : existing.text;
  const newIsDone = is_done !== undefined ? is_done : existing.is_done;
  const isDoneChanged = is_done !== undefined && is_done !== existing.is_done;
  const doneAt = newIsDone ? (isDoneChanged ? new Date() : existing.done_at) : null;

  const [todo] = await sql`
    UPDATE todos SET
      text = ${newText},
      is_done = ${newIsDone},
      done_at = ${doneAt},
      note_id = ${note_id !== undefined ? note_id : existing.note_id},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (isDoneChanged && newIsDone) {
    const children = await sql`SELECT id FROM todos WHERE parent_todo_id = ${id} AND archived_at IS NULL`;
    for (const child of children) {
      await sql`UPDATE todos SET is_done = TRUE, done_at = NOW(), updated_at = NOW() WHERE id = ${child.id}`;
    }
  }

  if (existing.note_id) {
    const [note] = await sql`SELECT * FROM notes WHERE id = ${existing.note_id}`;
    if (note && note.content) {
      const updatedContent = updateTodoInContent(JSON.parse(JSON.stringify(note.content)), id, newText, newIsDone);
      await sql`UPDATE notes SET content = ${JSON.stringify(updatedContent)}::jsonb, updated_at = NOW() WHERE id = ${existing.note_id}`;
    }
  }

  if (note_id && note_id !== existing.note_id) {
    const [note] = await sql`SELECT * FROM notes WHERE id = ${note_id}`;
    if (note) {
      const updatedContent = insertTaskItemIntoContent(note.content || { type: 'doc', content: [] }, id, newText);
      await sql`UPDATE notes SET content = ${JSON.stringify(updatedContent)}::jsonb, updated_at = NOW() WHERE id = ${note_id}`;
    }
  }

  return NextResponse.json(todo);
}

async function deleteTodo(id) {
  const sql = getDb();
  const [todo] = await sql`SELECT * FROM todos WHERE id = ${id}`;
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await sql`DELETE FROM todos WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}

async function toggleTodo(id, body) {
  const sql = getDb();
  const [existing] = await sql`SELECT * FROM todos WHERE id = ${id}`;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newDone = body?.is_done !== undefined ? body.is_done : !existing.is_done;
  const doneAt = newDone ? new Date() : null;

  const [todo] = await sql`
    UPDATE todos SET is_done = ${newDone}, done_at = ${doneAt}, updated_at = NOW()
    WHERE id = ${id} RETURNING *
  `;

  if (newDone) {
    await sql`UPDATE todos SET is_done = TRUE, done_at = NOW(), updated_at = NOW() WHERE parent_todo_id = ${id} AND archived_at IS NULL`;
  }

  if (existing.note_id) {
    const [note] = await sql`SELECT * FROM notes WHERE id = ${existing.note_id}`;
    if (note && note.content) {
      const updatedContent = updateTodoInContent(JSON.parse(JSON.stringify(note.content)), id, existing.text, newDone);
      await sql`UPDATE notes SET content = ${JSON.stringify(updatedContent)}::jsonb, updated_at = NOW() WHERE id = ${existing.note_id}`;
    }
  }

  return NextResponse.json(todo);
}

async function archiveTodo(id) {
  const sql = getDb();
  const [existing] = await sql`SELECT * FROM todos WHERE id = ${id}`;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isArchived = !!existing.archived_at;
  const [todo] = await sql`
    UPDATE todos SET
      archived_at = ${isArchived ? null : new Date()},
      updated_at = NOW()
    WHERE id = ${id} RETURNING *
  `;

  return NextResponse.json(todo);
}

// ===== TAGS HANDLERS =====

async function getTags(searchParams) {
  const sql = getDb();
  const ownerId = searchParams.get('owner_id') || DEFAULT_OWNER;
  const tags = await sql`SELECT * FROM tags WHERE owner_id = ${ownerId} ORDER BY name`;
  return NextResponse.json(tags);
}

async function createTag(body) {
  const sql = getDb();
  const { name, type, color, owner_id } = body;
  const ownerId = owner_id || DEFAULT_OWNER;
  const id = uuidv4();
  const [tag] = await sql`
    INSERT INTO tags (id, owner_id, name, type, color)
    VALUES (${id}, ${ownerId}, ${name}, ${type || 'project'}, ${color || null})
    RETURNING *
  `;
  return NextResponse.json(tag, { status: 201 });
}

async function updateTag(id, body) {
  const sql = getDb();
  const { name, color } = body;
  const [existing] = await sql`SELECT * FROM tags WHERE id = ${id}`;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [tag] = await sql`
    UPDATE tags SET name = ${name || existing.name}, color = ${color !== undefined ? color : existing.color}
    WHERE id = ${id} RETURNING *
  `;
  return NextResponse.json(tag);
}

async function deleteTag(id) {
  const sql = getDb();
  await sql`DELETE FROM tags WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}

// ===== TAG ASSIGNMENTS =====

async function addNoteTag(body) {
  const sql = getDb();
  const { note_id, tag_id } = body;
  await sql`INSERT INTO note_tags (note_id, tag_id) VALUES (${note_id}, ${tag_id}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ success: true });
}

async function removeNoteTag(noteId, tagId) {
  const sql = getDb();
  await sql`DELETE FROM note_tags WHERE note_id = ${noteId} AND tag_id = ${tagId}`;
  return NextResponse.json({ success: true });
}

async function addTodoTag(body) {
  const sql = getDb();
  const { todo_id, tag_id } = body;
  await sql`INSERT INTO todo_tags (todo_id, tag_id) VALUES (${todo_id}, ${tag_id}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ success: true });
}

async function removeTodoTag(todoId, tagId) {
  const sql = getDb();
  await sql`DELETE FROM todo_tags WHERE todo_id = ${todoId} AND tag_id = ${tagId}`;
  return NextResponse.json({ success: true });
}

// ===== ROUTE HANDLERS =====

export async function GET(request, { params }) {
  try {
    const path = params?.path || [];
    const { searchParams } = new URL(request.url);

    if (path[0] === 'notes' && path[1]) return getNote(path[1]);
    if (path[0] === 'notes') return getNotes(searchParams);
    if (path[0] === 'todos') return getTodos(searchParams);
    if (path[0] === 'tags') return getTags(searchParams);

    return NextResponse.json({ status: 'API running' });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const path = params?.path || [];
    const body = await request.json().catch(() => ({}));

    if (path[0] === 'db' && path[1] === 'setup') return setupDatabase();
    if (path[0] === 'notes') return createNote(body);
    if (path[0] === 'todos') return createTodo(body);
    if (path[0] === 'tags') return createTag(body);
    if (path[0] === 'note-tags') return addNoteTag(body);
    if (path[0] === 'todo-tags') return addTodoTag(body);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const path = params?.path || [];
    const body = await request.json().catch(() => ({}));

    if (path[0] === 'notes' && path[1]) return updateNote(path[1], body);
    if (path[0] === 'todos' && path[1]) return updateTodo(path[1], body);
    if (path[0] === 'tags' && path[1]) return updateTag(path[1], body);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const path = params?.path || [];

    if (path[0] === 'notes' && path[1]) return deleteNote(path[1]);
    if (path[0] === 'todos' && path[1]) return deleteTodo(path[1]);
    if (path[0] === 'tags' && path[1]) return deleteTag(path[1]);
    if (path[0] === 'note-tags' && path[1] && path[2]) return removeNoteTag(path[1], path[2]);
    if (path[0] === 'todo-tags' && path[1] && path[2]) return removeTodoTag(path[1], path[2]);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const path = params?.path || [];
    const body = await request.json().catch(() => ({}));

    if (path[0] === 'todos' && path[1] && path[2] === 'toggle') return toggleTodo(path[1], body);
    if (path[0] === 'todos' && path[1] && path[2] === 'archive') return archiveTodo(path[1]);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
