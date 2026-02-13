#!/usr/bin/env python3
"""
Corrected test for bidirectional sync
"""

import requests
import json
import uuid
import time

BASE_URL = "https://notebook-flow.preview.emergentagent.com/api"

def test_bidirectional_sync_corrected():
    """Test bidirectional sync with correct flow"""
    print("🔄 Testing Bidirectional Sync (Corrected)...")
    session = requests.Session()
    
    try:
        # Step 1: Create a note without tasks first
        note_data = {
            "title": f"Corrected Sync Test {uuid.uuid4().hex[:8]}",
            "content": {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "Initial content"}]
                    }
                ]
            }
        }
        
        response = session.post(f"{BASE_URL}/notes", json=note_data)
        if response.status_code != 201:
            print(f"❌ Create note failed: {response.status_code}")
            return False
        
        note = response.json()
        note_id = note['id']
        print(f"✅ Created note: {note_id}")
        
        # Step 2: Update the note to add task items (this triggers sync)
        updated_content = {
            "type": "doc",
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "Initial content"}]
                },
                {
                    "type": "taskList",
                    "content": [
                        {
                            "type": "taskItem",
                            "attrs": {"checked": False},
                            "content": [
                                {
                                    "type": "paragraph",
                                    "content": [{"type": "text", "text": "Original bidirectional task"}]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        
        update_data = {
            "title": note_data["title"],
            "content": updated_content
        }
        
        response = session.put(f"{BASE_URL}/notes/{note_id}", json=update_data)
        if response.status_code != 200:
            print(f"❌ Update note with tasks failed: {response.status_code}")
            return False
        
        updated_note = response.json()
        print("✅ Note updated with task items")
        
        # Step 3: Extract the todoId from the updated note
        content = updated_note.get('content', {})
        
        def find_todo_id(node):
            if isinstance(node, dict):
                if node.get('type') == 'taskItem':
                    todo_id = node.get('attrs', {}).get('todoId')
                    if todo_id:
                        return todo_id
                if 'content' in node and isinstance(node['content'], list):
                    for child in node['content']:
                        result = find_todo_id(child)
                        if result:
                            return result
            elif isinstance(node, list):
                for item in node:
                    result = find_todo_id(item)
                    if result:
                        return result
            return None
        
        todo_id = find_todo_id(content)
        
        if not todo_id:
            print("❌ No todoId found in updated note content")
            return False
        
        print(f"✅ Found todoId in updated content: {todo_id}")
        
        # Step 4: Update the todo from todo view
        new_text = f"Updated from todo view {uuid.uuid4().hex[:6]}"
        todo_update_data = {
            "text": new_text,
            "is_done": True
        }
        
        response = session.put(f"{BASE_URL}/todos/{todo_id}", json=todo_update_data)
        if response.status_code != 200:
            print(f"❌ Update todo failed: {response.status_code}")
            return False
        
        updated_todo = response.json()
        print(f"✅ Todo updated - New text: {updated_todo.get('text')}, Done: {updated_todo.get('is_done')}")
        
        # Step 5: Verify note content was synced back
        time.sleep(0.5)  # Small delay for sync
        
        response = session.get(f"{BASE_URL}/notes/{note_id}")
        if response.status_code != 200:
            print(f"❌ Get updated note failed: {response.status_code}")
            return False
        
        final_note = response.json()
        final_content = final_note.get('content')
        
        if not final_content:
            print("❌ No content in final note")
            return False
        
        # Check if bidirectional sync worked
        found_updated_text = False
        found_checked_status = False
        
        def check_sync_result(node):
            nonlocal found_updated_text, found_checked_status
            if isinstance(node, dict):
                if (node.get('type') == 'taskItem' and 
                    node.get('attrs', {}).get('todoId') == todo_id):
                    # Check text update
                    if node.get('content'):
                        for child in node['content']:
                            if child.get('type') == 'paragraph' and child.get('content'):
                                for text_node in child['content']:
                                    if (text_node.get('type') == 'text' and 
                                        new_text in text_node.get('text', '')):
                                        found_updated_text = True
                    
                    # Check done status
                    if node.get('attrs', {}).get('checked') == True:
                        found_checked_status = True
                
                if 'content' in node and isinstance(node['content'], list):
                    for child in node['content']:
                        check_sync_result(child)
            elif isinstance(node, list):
                for item in node:
                    check_sync_result(item)
        
        check_sync_result(final_content)
        
        text_synced = found_updated_text
        status_synced = found_checked_status
        
        print(f"✅ Text synced to note: {text_synced}")
        print(f"✅ Status synced to note: {status_synced}")
        
        success = text_synced and status_synced
        
        # Cleanup
        session.delete(f"{BASE_URL}/notes/{note_id}")
        session.delete(f"{BASE_URL}/todos/{todo_id}")
        
        return success
        
    except Exception as e:
        print(f"❌ Bidirectional sync test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_bidirectional_sync_corrected()
    print(f"\n{'🎉 SUCCESS' if success else '❌ FAILED'}: Bidirectional sync test")