import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { calculateNextDueDate } from '@/lib/recurrence';

export const maxDuration = 60; // Vercel Hobby plan — prevent 10s timeout on complex DB operations

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
      dueDate: node.attrs?.dueDate || null,
      projectTagId: node.attrs?.projectTagId || null,
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

function now() {
  return new Date().toISOString();
}

async function getUser(supabase) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ===== NOTES HANDLERS =====

async function getNotes(supabase, searchParams, ownerId) {
  const search = searchParams.get('search') || '';
  const tagId = searchParams.get('tag') || '';
  const limit = parseInt(searchParams.get('limit')) || 50;
  const offset = parseInt(searchParams.get('offset')) || 0;
  const statusFilter = searchParams.get('status');
  const hasTranscript = searchParams.get('has_transcript') === 'true';

  // Build base query
  let query = supabase.from('notes').select('*, note_tags(tag_id, tags(*))', { count: 'exact' })
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (hasTranscript) {
    query = query.not('transcript', 'is', null);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,content::text.ilike.%${search}%`);
  }

  const { data: notes, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Post-process: flatten tags, apply tag filters client-side
  let result = notes.map(n => {
    const tags = (n.note_tags || []).map(nt => nt.tags).filter(Boolean);
    const { note_tags, ...rest } = n;
    return { ...rest, tags };
  });

  // Tag filtering (post-query due to complexity)
  if (tagId) {
    const filterTags = tagId.split(',');
    const hasUntagged = filterTags.includes('untagged');
    const realTags = filterTags.filter(t => t !== 'untagged');

    result = result.filter(note => {
      const sourceTags = note.tags.filter(t => t.type === 'source');
      const noteTagIds = sourceTags.map(t => t.id);

      if (hasUntagged && realTags.length === 0) {
        return sourceTags.length === 0;
      } else if (hasUntagged && realTags.length > 0) {
        return sourceTags.length === 0 || realTags.some(rt => noteTagIds.includes(rt));
      } else {
        return realTags.some(rt => noteTagIds.includes(rt));
      }
    });
  }

  // Status filtering requires checking todos for each note
  if (statusFilter) {
    const statuses = statusFilter.split(',');
    const noteIds = result.map(n => n.id);

    if (noteIds.length > 0) {
      const { data: allTodos } = await supabase.from('todos')
        .select('id, note_id, is_done, archived_at')
        .in('note_id', noteIds)
        .is('archived_at', null);

      const todosByNote = {};
      for (const t of (allTodos || [])) {
        if (!todosByNote[t.note_id]) todosByNote[t.note_id] = [];
        todosByNote[t.note_id].push(t);
      }

      result = result.filter(note => {
        const todos = todosByNote[note.id] || [];
        const hasOpen = todos.some(t => !t.is_done);
        const hasTodos = todos.length > 0;
        const allDone = hasTodos && !hasOpen;

        return statuses.some(s => {
          if (s === 'open') return hasOpen;
          if (s === 'closed') return allDone;
          if (s === 'no_action') return !hasTodos;
          return false;
        });
      });
    }
  }

  return NextResponse.json({ data: result, total: count || result.length });
}

async function createNote(supabase, body, ownerId) {
  const { title, content } = body;
  const id = uuidv4();
  const date = new Date(now());
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  date.setMinutes(roundedMinutes, 0, 0);
  const timestamp = date.toISOString();

  const { data, error } = await supabase.from('notes').insert({
    id, owner_id: ownerId, title: title || '', content: content || null,
    created_at: timestamp, updated_at: timestamp
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

async function getNote(supabase, id) {
  const { data: note, error } = await supabase.from('notes').select('*').eq('id', id).single();
  if (error || !note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  const { data: noteTags } = await supabase.from('note_tags')
    .select('tags(*)').eq('note_id', id);
  const tags = (noteTags || []).map(nt => nt.tags).filter(Boolean);

  return NextResponse.json({ ...note, tags });
}

async function updateNote(supabase, id, body, ownerId) {
  const { title, content, tags: tagIds, created_at, transcript, transcript_status, summary, ai_action_items } = body;

  const { data: existing, error: fetchErr } = await supabase.from('notes').select('*').eq('id', id).single();
  if (fetchErr || !existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  let updatedContent = content;
  if (content) {
    const taskItems = extractTaskItems(content);

    const { data: existingTodos } = await supabase.from('todos')
      .select('*').eq('note_id', id).is('archived_at', null);
    const existingTodoMap = new Map((existingTodos || []).map(t => [t.id, t]));
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

        await supabase.from('todos').update({
          text: item.text,
          is_done: item.checked,
          done_at: item.checked && isDoneChanged ? now() : (item.checked ? existingTodo.done_at : null),
          parent_todo_id: parentTodoId,
          due_date: item.dueDate,
          updated_at: now()
        }).eq('id', item.todoId);

        // Sync projectTagId
        await supabase.from('todo_tags').delete().eq('todo_id', item.todoId);
        if (item.projectTagId) {
          await supabase.from('todo_tags').upsert({ todo_id: item.todoId, tag_id: item.projectTagId });
        }
      } else {
        const newId = uuidv4();
        await supabase.from('todos').insert({
          id: newId, owner_id: ownerId, note_id: id, parent_todo_id: parentTodoId,
          text: item.text, is_done: item.checked, done_at: item.checked ? now() : null,
          position: i, due_date: item.dueDate, created_at: now(), updated_at: now()
        });

        if (item.projectTagId) {
          await supabase.from('todo_tags').upsert({ todo_id: newId, tag_id: item.projectTagId });
        }

        taskItems[i].todoId = newId;
        contentTodoIds.add(newId);
      }
    }

    // Build a set of todo_ids that belong to AI-claimed action items — these live outside
    // the editor content and must never be archived by the content-sync sweep.
    const aiItems = existing.ai_action_items || [];
    const aiTodoIds = new Set(aiItems.filter(i => i.claimed && i.todo_id).map(i => i.todo_id));

    // Archive removed todos (skip AI-claimed ones).
    // Use skip_content_update as the primary race-free guard — it's set at todo creation time.
    // aiTodoIds is kept as a secondary belt-and-suspenders check.
    for (const [todoId, todo] of existingTodoMap) {
      if (!contentTodoIds.has(todoId) && !aiTodoIds.has(todoId) && !todo.skip_content_update) {
        await supabase.from('todos').update({ archived_at: now(), updated_at: now() }).eq('id', todoId);
      }
    }

    updatedContent = JSON.parse(JSON.stringify(content));
    updateContentTodoIds(updatedContent, taskItems);
  }

  const { error: updateError } = await supabase.from('notes').update({
    title: title !== undefined ? title : existing.title,
    content: updatedContent !== undefined ? updatedContent : existing.content,
    updated_at: now(),
    created_at: created_at !== undefined ? created_at : existing.created_at,
    ...(transcript !== undefined && { transcript }),
    ...(transcript_status !== undefined && { transcript_status }),
    ...(summary !== undefined && { summary }),
    ...(ai_action_items !== undefined && { ai_action_items }),
  }).eq('id', id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (tagIds !== undefined) {
    await supabase.from('note_tags').delete().eq('note_id', id);
    if (tagIds && tagIds.length > 0) {
      await supabase.from('note_tags').insert(tagIds.map(tagId => ({ note_id: id, tag_id: tagId })));
    }
  }

  const { data: note } = await supabase.from('notes').select('*').eq('id', id).single();
  const { data: noteTags } = await supabase.from('note_tags').select('tags(*)').eq('note_id', id);
  const tags = (noteTags || []).map(nt => nt.tags).filter(Boolean);
  return NextResponse.json({ ...note, tags });
}

async function deleteNote(supabase, id) {
  await supabase.from('todos').update({ note_id: null }).eq('note_id', id);
  await supabase.from('notes').delete().eq('id', id);
  return NextResponse.json({ success: true });
}

// ===== TODOS HANDLERS =====

async function getTodos(supabase, searchParams, ownerId) {
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';
  const tagId = searchParams.get('tag') || '';
  const projectId = searchParams.get('project_id') || '';
  const dateFrom = searchParams.get('date_from') || '';
  const dateTo = searchParams.get('date_to') || '';
  const limit = parseInt(searchParams.get('limit')) || 50;
  const offset = parseInt(searchParams.get('offset')) || 0;
  const sort = searchParams.get('sort') || 'created_at';

  let query = supabase.from('todos').select('*, todo_tags(tag_id, tags(*))', { count: 'exact' })
    .eq('owner_id', ownerId);

  if (status && status !== 'all') {
    const statuses = status.split(',');
    const orConditions = [];
    if (statuses.includes('open')) orConditions.push('and(is_done.eq.false,archived_at.is.null)');
    if (statuses.includes('done')) orConditions.push('and(is_done.eq.true,archived_at.is.null)');
    if (statuses.includes('archived')) orConditions.push('archived_at.not.is.null');
    if (orConditions.length > 0) {
      query = query.or(orConditions.join(','));
    }
  }

  if (search) {
    query = query.ilike('text', `%${search}%`);
  }
  if (dateFrom) {
    query = query.gte('due_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('due_date', dateTo);
  }

  if (sort === 'position') {
    query = query.order('position', { ascending: true }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false }).order('position', { ascending: true });
  }

  query = query.range(offset, offset + limit - 1);

  const { data: todos, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten tags
  let result = todos.map(t => {
    const tags = (t.todo_tags || []).map(tt => tt.tags).filter(Boolean);
    const { todo_tags, ...rest } = t;
    return { ...rest, tags };
  });

  // Tag filtering (post-query)
  if (tagId) {
    const filterTags = tagId.split(',');
    result = result.filter(todo => todo.tags.some(t => filterTags.includes(t.id)));
  }

  // Project filtering (post-query)
  if (projectId) {
    const pIds = projectId.split(',');
    const wantsUntagged = pIds.includes('__untagged');
    const validTags = pIds.filter(id => id !== '__untagged');

    result = result.filter(todo => {
      const projectTags = todo.tags.filter(t => t.type === 'project');
      if (wantsUntagged && projectTags.length === 0) return true;
      if (validTags.length > 0 && projectTags.some(t => validTags.includes(t.id))) return true;
      return false;
    });
  }

  return NextResponse.json({ data: result, total: count || result.length });
}

async function createTodo(supabase, body, ownerId) {
  const { text, content, note_id, parent_todo_id, position, tag_ids, due_date, skip_content_update } = body;
  const id = uuidv4();
  const timestamp = now();

  const { error } = await supabase.from('todos').insert({
    id, owner_id: ownerId, note_id: note_id || null, parent_todo_id: parent_todo_id || null,
    text: text || '', content: content || null, position: position || null,
    due_date: due_date || null, created_at: timestamp, updated_at: timestamp
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (tag_ids && tag_ids.length > 0) {
    await supabase.from('todo_tags').insert(tag_ids.map(tagId => ({ todo_id: id, tag_id: tagId })));
  }

  // skip_content_update: used for AI-claimed todos which are tracked in ai_action_items,
  // not in the editor content. Inserting into content would cause saveNote to archive the
  // todo when it syncs back the old editor state (which doesn't know about the new checkbox).
  if (note_id && !skip_content_update) {
    const { data: note } = await supabase.from('notes').select('*').eq('id', note_id).single();
    if (note) {
      const updatedContent = insertTaskItemIntoContent(note.content || { type: 'doc', content: [] }, id, text || '');
      await supabase.from('notes').update({ content: updatedContent, updated_at: now() }).eq('id', note_id);
    }
  }

  const { data: todo } = await supabase.from('todos').select('*').eq('id', id).single();
  const { data: todoTags } = await supabase.from('todo_tags').select('tags(*)').eq('todo_id', id);
  const tags = (todoTags || []).map(tt => tt.tags).filter(Boolean);
  return NextResponse.json({ ...todo, tags }, { status: 201 });
}

async function updateTodo(supabase, id, body) {
  const { text, content, is_done, note_id, tags, due_date, recurrence } = body;

  const { data: existing } = await supabase.from('todos').select('*').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

  const newText = text !== undefined ? text : existing.text;
  const newContent = content !== undefined ? content : existing.content;
  const newDueDate = due_date !== undefined ? due_date : existing.due_date;
  const newRecurrence = recurrence !== undefined ? (recurrence || null) : existing.recurrence;
  const newIsDone = is_done !== undefined ? is_done : existing.is_done;
  const isDoneChanged = is_done !== undefined && is_done !== existing.is_done;
  const doneAt = newIsDone ? (isDoneChanged ? now() : existing.done_at) : null;

  await supabase.from('todos').update({
    text: newText, content: newContent, is_done: newIsDone, done_at: doneAt,
    note_id: note_id !== undefined ? note_id : existing.note_id,
    due_date: newDueDate, recurrence: newRecurrence, updated_at: now()
  }).eq('id', id);

  if (isDoneChanged && newIsDone) {
    // Complete children
    await supabase.from('todos').update({ is_done: true, done_at: now(), updated_at: now() })
      .eq('parent_todo_id', id).is('archived_at', null);

    // Handle recurring todos
    if (newRecurrence && (newDueDate || existing.due_date)) {
      const nextDueDate = calculateNextDueDate(newDueDate || existing.due_date, newRecurrence);
      if (nextDueDate) {
        const newTodoId = uuidv4();
        await supabase.from('todos').insert({
          id: newTodoId, owner_id: existing.owner_id, note_id: existing.note_id,
          parent_todo_id: existing.parent_todo_id, text: newText, content: newContent,
          is_done: false, done_at: null, due_date: nextDueDate, recurrence: newRecurrence,
          position: existing.position, created_at: now(), updated_at: now()
        });

        // Copy tags
        const { data: existingTags } = await supabase.from('todo_tags').select('tag_id').eq('todo_id', id);
        if (existingTags && existingTags.length > 0) {
          await supabase.from('todo_tags').insert(existingTags.map(t => ({ todo_id: newTodoId, tag_id: t.tag_id })));
        }
      }
    }
  }

  // Sync todo text back to note content
  if (existing.note_id) {
    const { data: note } = await supabase.from('notes').select('*').eq('id', existing.note_id).single();
    if (note && note.content) {
      const updatedContent = updateTodoInContent(JSON.parse(JSON.stringify(note.content)), id, newText, newIsDone);
      await supabase.from('notes').update({ content: updatedContent, updated_at: now() }).eq('id', existing.note_id);
    }
  }

  if (note_id && note_id !== existing.note_id) {
    const { data: note } = await supabase.from('notes').select('*').eq('id', note_id).single();
    if (note) {
      const updatedContent = insertTaskItemIntoContent(note.content || { type: 'doc', content: [] }, id, newText);
      await supabase.from('notes').update({ content: updatedContent, updated_at: now() }).eq('id', note_id);
    }
  }

  if (tags !== undefined && Array.isArray(tags)) {
    await supabase.from('todo_tags').delete().eq('todo_id', id);
    if (tags.length > 0) {
      await supabase.from('todo_tags').insert(tags.map(tagId => ({ todo_id: id, tag_id: tagId })));
    }
  }

  const { data: todo } = await supabase.from('todos').select('*').eq('id', id).single();
  const { data: todoTags } = await supabase.from('todo_tags').select('tags(*)').eq('todo_id', id);
  const resultTags = (todoTags || []).map(tt => tt.tags).filter(Boolean);
  return NextResponse.json({ ...todo, tags: resultTags });
}

async function deleteTodo(supabase, id) {
  const { data: todo } = await supabase.from('todos').select('*').eq('id', id).single();
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await supabase.from('todos').delete().eq('id', id);
  return NextResponse.json({ success: true });
}

async function toggleTodo(supabase, id, body) {
  const { data: existing } = await supabase.from('todos').select('*').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newDone = body?.is_done !== undefined ? body.is_done : !existing.is_done;
  const doneAt = newDone ? now() : null;
  const isDoneChanged = newDone !== existing.is_done;

  await supabase.from('todos').update({ is_done: newDone, done_at: doneAt, updated_at: now() }).eq('id', id);

  if (newDone) {
    await supabase.from('todos').update({ is_done: true, done_at: now(), updated_at: now() })
      .eq('parent_todo_id', id).is('archived_at', null);

    // Handle recurring todos
    if (isDoneChanged) {
      const recurrencePattern = existing.recurrence;
      if (recurrencePattern && existing.due_date) {
        const nextDueDate = calculateNextDueDate(existing.due_date, recurrencePattern);
        if (nextDueDate) {
          const newTodoId = uuidv4();
          await supabase.from('todos').insert({
            id: newTodoId, owner_id: existing.owner_id, note_id: existing.note_id,
            parent_todo_id: existing.parent_todo_id, text: existing.text, content: existing.content,
            is_done: false, done_at: null, due_date: nextDueDate, recurrence: existing.recurrence,
            position: existing.position, created_at: now(), updated_at: now()
          });

          const { data: existingTags } = await supabase.from('todo_tags').select('tag_id').eq('todo_id', id);
          if (existingTags && existingTags.length > 0) {
            await supabase.from('todo_tags').insert(existingTags.map(t => ({ todo_id: newTodoId, tag_id: t.tag_id })));
          }
        }
      }
    }
  }

  if (existing.note_id) {
    const { data: note } = await supabase.from('notes').select('*').eq('id', existing.note_id).single();
    if (note && note.content) {
      const updatedContent = updateTodoInContent(JSON.parse(JSON.stringify(note.content)), id, existing.text, newDone);
      await supabase.from('notes').update({ content: updatedContent, updated_at: now() }).eq('id', existing.note_id);
    }
  }

  const { data: todo } = await supabase.from('todos').select('*').eq('id', id).single();
  return NextResponse.json(todo);
}

async function archiveTodo(supabase, id) {
  const { data: existing } = await supabase.from('todos').select('*').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isArchived = !!existing.archived_at;
  await supabase.from('todos').update({
    archived_at: isArchived ? null : now(), updated_at: now()
  }).eq('id', id);

  const { data: todo } = await supabase.from('todos').select('*').eq('id', id).single();
  return NextResponse.json(todo);
}

async function reorderTodo(supabase, body) {
  const { todoId, newPosition, oldProjectTagId, newProjectTagId } = body;

  const { data: existing } = await supabase.from('todos').select('*').eq('id', todoId).single();
  if (!existing) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

  await supabase.from('todos').update({ position: newPosition, updated_at: now() }).eq('id', todoId);

  if (oldProjectTagId !== newProjectTagId) {
    if (oldProjectTagId) {
      await supabase.from('todo_tags').delete().eq('todo_id', todoId).eq('tag_id', oldProjectTagId);
    }
    if (newProjectTagId) {
      await supabase.from('todo_tags').upsert({ todo_id: todoId, tag_id: newProjectTagId });
    }
  }

  const { data: todo } = await supabase.from('todos').select('*').eq('id', todoId).single();
  const { data: todoTags } = await supabase.from('todo_tags').select('tags(*)').eq('todo_id', todoId);
  const tags = (todoTags || []).map(tt => tt.tags).filter(Boolean);
  return NextResponse.json({ ...todo, tags });
}

async function batchReorderTodos(supabase, body) {
  const { orderedIds } = body;
  if (!orderedIds || !Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 });
  }
  const ts = now();
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('todos').update({ position: i, updated_at: ts }).eq('id', orderedIds[i]);
  }
  return NextResponse.json({ success: true });
}

// ===== TAGS HANDLERS =====

async function getTags(supabase, searchParams, ownerId) {
  const type = searchParams.get('type') || '';
  const includeArchived = searchParams.get('include_archived') === 'true';

  let query = supabase.from('tags').select('*').eq('owner_id', ownerId);

  if (includeArchived) {
    query = query.not('archived_at', 'is', null);
  } else {
    query = query.is('archived_at', null);
  }

  if (type) {
    query = query.eq('type', type);
  }

  query = query.order('type').order('position', { ascending: true }).order('name');

  const { data: tags, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(tags);
}

async function createTag(supabase, body, ownerId) {
  const { name, type, color } = body;
  const id = uuidv4();

  // Get max position for this type
  const { data: maxPosRows } = await supabase.from('tags')
    .select('position').eq('owner_id', ownerId).eq('type', type || 'project')
    .order('position', { ascending: false }).limit(1);
  const position = (maxPosRows && maxPosRows.length > 0 && maxPosRows[0].position !== null) ? maxPosRows[0].position + 1 : 0;

  const { data: tag, error } = await supabase.from('tags').insert({
    id, owner_id: ownerId, name, type: type || 'project', color: color || null, position
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(tag, { status: 201 });
}

async function batchReorderTags(supabase, body) {
  const { orderedIds } = body;
  if (!orderedIds || !Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 });
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('tags').update({ position: i }).eq('id', orderedIds[i]);
  }
  return NextResponse.json({ success: true });
}

async function updateTag(supabase, id, body) {
  const { name, color, archived } = body;
  const { data: existing } = await supabase.from('tags').select('*').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates = {};
  if (archived === true) updates.archived_at = now();
  else if (archived === false) updates.archived_at = null;
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;

  if (Object.keys(updates).length > 0) {
    await supabase.from('tags').update(updates).eq('id', id);
  }

  const { data: tag } = await supabase.from('tags').select('*').eq('id', id).single();
  return NextResponse.json(tag);
}

async function deleteTag(supabase, id) {
  await supabase.from('note_tags').delete().eq('tag_id', id);
  await supabase.from('todo_tags').delete().eq('tag_id', id);
  await supabase.from('tags').delete().eq('id', id);
  return NextResponse.json({ success: true });
}

// ===== TAG ASSIGNMENTS =====

async function addNoteTag(supabase, body) {
  const { note_id, tag_id } = body;
  await supabase.from('note_tags').upsert({ note_id, tag_id });
  return NextResponse.json({ success: true });
}

async function removeNoteTag(supabase, noteId, tagId) {
  await supabase.from('note_tags').delete().eq('note_id', noteId).eq('tag_id', tagId);
  return NextResponse.json({ success: true });
}

async function addTodoTag(supabase, body) {
  const { todo_id, tag_id } = body;
  await supabase.from('todo_tags').upsert({ todo_id, tag_id });
  return NextResponse.json({ success: true });
}

async function removeTodoTag(supabase, todoId, tagId) {
  await supabase.from('todo_tags').delete().eq('todo_id', todoId).eq('tag_id', tagId);
  return NextResponse.json({ success: true });
}

// ===== PREFERENCES =====

async function getPreferences(supabase, ownerId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('key, value')
    .eq('owner_id', ownerId);
  if (error) throw error;
  const prefs = {};
  for (const row of (data || [])) {
    prefs[row.key] = row.value;
  }
  return NextResponse.json(prefs);
}

async function upsertPreference(supabase, ownerId, key, value) {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      { owner_id: ownerId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'owner_id,key' }
    )
    .select()
    .single();
  if (error) throw error;
  return NextResponse.json(data);
}

// ===== ROUTE HANDLERS =====

export async function GET(request, { params }) {
  try {
    const supabase = createClient();
    const user = await getUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const path = params?.path || [];
    const { searchParams } = new URL(request.url);

    if (path[0] === 'preferences') return getPreferences(supabase, user.id);
    if (path[0] === 'notes' && path[1]) return getNote(supabase, path[1]);
    if (path[0] === 'notes') return getNotes(supabase, searchParams, user.id);
    if (path[0] === 'todos') return getTodos(supabase, searchParams, user.id);
    if (path[0] === 'tags') return getTags(supabase, searchParams, user.id);

    return NextResponse.json({ status: 'API running' });
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const supabase = createClient();
    const user = await getUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const path = params?.path || [];
    const body = await request.json().catch(() => ({}));

    if (path[0] === 'notes') return createNote(supabase, body, user.id);
    if (path[0] === 'todos' && path[1] === 'reorder') return reorderTodo(supabase, body);
    if (path[0] === 'todos' && path[1] === 'batch-reorder') return batchReorderTodos(supabase, body);
    if (path[0] === 'todos') return createTodo(supabase, body, user.id);
    if (path[0] === 'tags' && path[1] === 'batch-reorder') return batchReorderTags(supabase, body);
    if (path[0] === 'tags') return createTag(supabase, body, user.id);
    if (path[0] === 'note-tags') return addNoteTag(supabase, body);
    if (path[0] === 'todo-tags') return addTodoTag(supabase, body);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const supabase = createClient();
    const user = await getUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const path = params?.path || [];
    const body = await request.json().catch(() => ({}));

    if (path[0] === 'preferences' && path[1]) return upsertPreference(supabase, user.id, path[1], body.value);
    if (path[0] === 'notes' && path[1]) return updateNote(supabase, path[1], body, user.id);
    if (path[0] === 'todos' && path[1]) return updateTodo(supabase, path[1], body);
    if (path[0] === 'tags' && path[1]) return updateTag(supabase, path[1], body);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = createClient();
    const user = await getUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const path = params?.path || [];

    if (path[0] === 'notes' && path[1]) return deleteNote(supabase, path[1]);
    if (path[0] === 'todos' && path[1]) return deleteTodo(supabase, path[1]);
    if (path[0] === 'tags' && path[1]) return deleteTag(supabase, path[1]);
    if (path[0] === 'note-tags' && path[1] && path[2]) return removeNoteTag(supabase, path[1], path[2]);
    if (path[0] === 'todo-tags' && path[1] && path[2]) return removeTodoTag(supabase, path[1], path[2]);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = createClient();
    const user = await getUser(supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const path = params?.path || [];
    const body = await request.json().catch(() => ({}));

    if (path[0] === 'todos' && path[1] && path[2] === 'toggle') return toggleTodo(supabase, path[1], body);
    if (path[0] === 'todos' && path[1] && path[2] === 'archive') return archiveTodo(supabase, path[1]);

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
