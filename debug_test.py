#!/usr/bin/env python3
"""
Diagnostic test for failing scenarios
"""

import requests
import json
import uuid
import time

BASE_URL = "https://notebook-flow.preview.emergentagent.com/api"

def test_archived_todos():
    """Debug archived todos issue"""
    print("🔍 Debugging Archived Todos...")
    session = requests.Session()
    
    # Create a todo
    create_data = {"text": f"Debug Todo {uuid.uuid4().hex[:8]}"}
    response = session.post(f"{BASE_URL}/todos", json=create_data)
    if response.status_code != 201:
        print(f"❌ Failed to create todo: {response.status_code}")
        return
    
    todo = response.json()
    todo_id = todo['id']
    print(f"✅ Created todo: {todo_id}")
    
    # Archive the todo
    response = session.patch(f"{BASE_URL}/todos/{todo_id}/archive")
    if response.status_code != 200:
        print(f"❌ Failed to archive todo: {response.status_code}")
        return
    
    archived_todo = response.json()
    print(f"✅ Archived todo - archived_at: {archived_todo.get('archived_at')}")
    
    # List todos with different parameters
    test_params = [
        {"show_archived": "true"},
        {"show_archived": "false"},
        {"status": "all", "show_archived": "true"},
        {"status": "all", "show_archived": "false"},
        {}
    ]
    
    for params in test_params:
        response = session.get(f"{BASE_URL}/todos", params=params)
        if response.status_code == 200:
            todos = response.json()
            found = any(t['id'] == todo_id for t in todos)
            print(f"✅ Params {params} - Found: {found}, Total todos: {len(todos)}")
        else:
            print(f"❌ Failed with params {params}: {response.status_code}")
    
    # Cleanup
    session.delete(f"{BASE_URL}/todos/{todo_id}")

def test_bidirectional_sync_debug():
    """Debug bidirectional sync issue"""
    print("\n🔍 Debugging Bidirectional Sync...")
    session = requests.Session()
    
    # Create note with task items directly (not empty first)
    note_data = {
        "title": f"Debug Sync Note {uuid.uuid4().hex[:8]}",
        "content": {
            "type": "doc",
            "content": [
                {
                    "type": "taskList",
                    "content": [
                        {
                            "type": "taskItem",
                            "attrs": {"checked": False},
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "Debug task text"}]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    }
    
    response = session.post(f"{BASE_URL}/notes", json=note_data)
    if response.status_code != 201:
        print(f"❌ Failed to create note: {response.status_code}")
        return
    
    note = response.json()
    note_id = note['id']
    print(f"✅ Created note: {note_id}")
    print(f"Content structure: {json.dumps(note.get('content'), indent=2)}")
    
    # Check if todoId was created during note creation
    content = note.get('content', {})
    
    def find_todo_id(node, path="root"):
        todo_ids = []
        if isinstance(node, dict):
            if node.get('type') == 'taskItem':
                todo_id = node.get('attrs', {}).get('todoId')
                print(f"Found taskItem at {path} - todoId: {todo_id}")
                if todo_id:
                    todo_ids.append(todo_id)
            if 'content' in node and isinstance(node['content'], list):
                for i, child in enumerate(node['content']):
                    todo_ids.extend(find_todo_id(child, f"{path}.content[{i}]"))
        elif isinstance(node, list):
            for i, item in enumerate(node):
                todo_ids.extend(find_todo_id(item, f"{path}[{i}]"))
        return todo_ids
    
    todo_ids = find_todo_id(content)
    print(f"Found todoIds in content: {todo_ids}")
    
    if todo_ids:
        # Try updating the todo
        todo_id = todo_ids[0]
        update_data = {"text": "Updated from debug test", "is_done": True}
        
        response = session.put(f"{BASE_URL}/todos/{todo_id}", json=update_data)
        if response.status_code == 200:
            print(f"✅ Updated todo: {todo_id}")
            
            # Check if note was updated
            time.sleep(0.5)
            response = session.get(f"{BASE_URL}/notes/{note_id}")
            if response.status_code == 200:
                updated_note = response.json()
                print(f"Updated note content: {json.dumps(updated_note.get('content'), indent=2)}")
            else:
                print(f"❌ Failed to get updated note: {response.status_code}")
        else:
            print(f"❌ Failed to update todo: {response.status_code}")
    else:
        print("❌ No todoIds found - need to debug sync creation")
    
    # Cleanup
    session.delete(f"{BASE_URL}/notes/{note_id}")
    for todo_id in todo_ids:
        session.delete(f"{BASE_URL}/todos/{todo_id}")

if __name__ == "__main__":
    test_archived_todos()
    test_bidirectional_sync_debug()