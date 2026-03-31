import { createServiceClient } from '@/lib/supabase/service';
import { searchNotes, getNote, listTodos, listTags, createNote, createTodo } from '@/lib/mcp/tools';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ===== AUTH =====

function isAuthorized(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return !!token && token === process.env.MCP_API_KEY;
}

// ===== TOOL SCHEMAS =====

const TOOLS = [
  {
    name: 'search_notes',
    description: 'Search notes by text query and/or tag name. Returns a list of matching notes with title, tags, and a short snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for in note titles and content' },
        tag:   { type: 'string', description: 'Tag name to filter by (exact or case-insensitive match)' },
        limit: { type: 'number', description: 'Maximum number of results to return (1–50, default 20)' },
      },
    },
  },
  {
    name: 'get_note',
    description: 'Get the full content of a single note as plain text, including tags, summary and action items.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'UUID of the note' },
      },
    },
  },
  {
    name: 'list_todos',
    description: 'List todos with optional filters. By default returns open (not done, not archived) todos.',
    inputSchema: {
      type: 'object',
      properties: {
        status:     { type: 'string', enum: ['open', 'done', 'all'], description: 'Filter by status (default: open)' },
        search:     { type: 'string', description: 'Text to search for in todo text' },
        tag:        { type: 'string', description: 'Tag name to filter by' },
        due_before: { type: 'string', description: 'Only todos due on or before this date (YYYY-MM-DD)' },
        due_after:  { type: 'string', description: 'Only todos due on or after this date (YYYY-MM-DD)' },
        limit:      { type: 'number', description: 'Maximum number of results (1–100, default 50)' },
      },
    },
  },
  {
    name: 'list_tags',
    description: 'List all active tags. Tags have two types: "project" (for todos) and "source" (for meeting notes).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['project', 'source', 'all'], description: 'Filter by tag type (default: all)' },
      },
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note with a title and optional plain text content.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', description: 'Title of the note' },
        text:  { type: 'string', description: 'Plain text content (optional). Use newlines to separate paragraphs.' },
      },
    },
  },
  {
    name: 'create_todo',
    description: 'Create a new standalone todo item.',
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text:     { type: 'string', description: 'The todo text' },
        due_date: { type: 'string', description: 'Optional due date in YYYY-MM-DD format' },
      },
    },
  },
];

// ===== TOOL DISPATCHER =====

async function callTool(name, args) {
  const supabase = createServiceClient();
  const ownerId = process.env.MCP_OWNER_ID;

  switch (name) {
    case 'search_notes': return await searchNotes(supabase, ownerId, args);
    case 'get_note':     return await getNote(supabase, ownerId, args);
    case 'list_todos':   return await listTodos(supabase, ownerId, args);
    case 'list_tags':    return await listTags(supabase, ownerId, args);
    case 'create_note':  return await createNote(supabase, ownerId, args);
    case 'create_todo':  return await createTodo(supabase, ownerId, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ===== JSON-RPC HELPERS =====

function jsonRpcResult(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result });
}

function jsonRpcError(id, code, message) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } });
}

// ===== ROUTE HANDLER =====

export async function POST(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error');
  }

  // JSON-RPC notifications have no id — must return 200 with empty body, never an error
  if (body.id === undefined || body.id === null) {
    return new Response(null, { status: 200 });
  }

  const { id, method, params } = body;

  try {
    switch (method) {
      case 'initialize':
        return jsonRpcResult(id, {
          protocolVersion: params?.protocolVersion || '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'noteflow', version: '1.0.0' },
        });

      case 'ping':
        return jsonRpcResult(id, {});

      case 'tools/list':
        return jsonRpcResult(id, { tools: TOOLS });

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          const text = await callTool(toolName, toolArgs);
          return jsonRpcResult(id, {
            content: [{ type: 'text', text }],
          });
        } catch (toolErr) {
          // Tool-level errors use isError:true — not a JSON-RPC protocol error
          return jsonRpcResult(id, {
            content: [{ type: 'text', text: toolErr.message }],
            isError: true,
          });
        }
      }

      default:
        return jsonRpcError(id, -32601, 'Method not found');
    }
  } catch (err) {
    return jsonRpcError(id, -32603, 'Internal error');
  }
}
