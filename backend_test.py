#!/usr/bin/env python3

import requests
import json
import sys
import uuid

# Configuration
BASE_URL = "https://notebook-flow.preview.emergentagent.com/api"
DEFAULT_OWNER = '00000000-0000-0000-0000-000000000001'

def generate_uuid():
    return str(uuid.uuid4())

def print_test_result(test_name, success, message=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}: {message}")
    return success

def test_tag_type_filtering():
    """Test tag type filtering functionality"""
    print("\n=== Testing Tag Type Filtering ===")
    
    # Clean up any existing test tags first
    try:
        response = requests.get(f"{BASE_URL}/tags")
        if response.status_code == 200:
            existing_tags = response.json()
            for tag in existing_tags:
                if tag['name'].startswith('Test'):
                    requests.delete(f"{BASE_URL}/tags/{tag['id']}")
    except:
        pass
    
    # Create test tags of both types
    source_tag_data = {
        "name": "Test Pipeline Meeting",
        "type": "source", 
        "color": "#22c55e",
        "owner_id": DEFAULT_OWNER
    }
    
    project_tag_data = {
        "name": "Test Project B",
        "type": "project",
        "color": "#ec4899", 
        "owner_id": DEFAULT_OWNER
    }
    
    # Create source tag
    response = requests.post(f"{BASE_URL}/tags", json=source_tag_data)
    if not print_test_result("Create source tag", response.status_code == 201, f"Status: {response.status_code}"):
        return False
    
    source_tag = response.json()
    source_tag_id = source_tag['id']
    
    # Create project tag  
    response = requests.post(f"{BASE_URL}/tags", json=project_tag_data)
    if not print_test_result("Create project tag", response.status_code == 201, f"Status: {response.status_code}"):
        return False
        
    project_tag = response.json()
    project_tag_id = project_tag['id']
    
    # Test filtering by type=source
    response = requests.get(f"{BASE_URL}/tags?type=source")
    if not print_test_result("GET tags with type=source", response.status_code == 200, f"Status: {response.status_code}"):
        return False
        
    source_tags = response.json()
    source_test_tags = [t for t in source_tags if t['name'].startswith('Test')]
    if not print_test_result("Source tags filter contains test tag", len(source_test_tags) >= 1 and source_test_tags[0]['type'] == 'source'):
        return False
    
    # Test filtering by type=project  
    response = requests.get(f"{BASE_URL}/tags?type=project")
    if not print_test_result("GET tags with type=project", response.status_code == 200, f"Status: {response.status_code}"):
        return False
        
    project_tags = response.json()
    project_test_tags = [t for t in project_tags if t['name'].startswith('Test')]
    if not print_test_result("Project tags filter contains test tag", len(project_test_tags) >= 1 and project_test_tags[0]['type'] == 'project'):
        return False
    
    # Test getting all tags (no filter)
    response = requests.get(f"{BASE_URL}/tags")
    if not print_test_result("GET all tags", response.status_code == 200, f"Status: {response.status_code}"):
        return False
        
    all_tags = response.json()
    all_test_tags = [t for t in all_tags if t['name'].startswith('Test')]
    if not print_test_result("All tags contains both types", len(all_test_tags) >= 2):
        return False
    
    # Verify both types are present
    tag_types = set(t['type'] for t in all_test_tags)
    if not print_test_result("All tags contains both source and project types", 'source' in tag_types and 'project' in tag_types):
        return False
    
    # Store for cleanup
    return {
        'source_tag_id': source_tag_id,
        'project_tag_id': project_tag_id
    }

def test_todo_creation_with_tag_ids(project_tag_id):
    """Test creating todo with tag_ids parameter"""
    print("\n=== Testing Todo Creation with tag_ids ===")
    
    # Create todo with project tag
    todo_data = {
        "text": "New task for testing tags",
        "tag_ids": [project_tag_id],
        "owner_id": DEFAULT_OWNER
    }
    
    response = requests.post(f"{BASE_URL}/todos", json=todo_data)
    if not print_test_result("Create todo with tag_ids", response.status_code == 201, f"Status: {response.status_code}"):
        return None
    
    todo = response.json()
    todo_id = todo['id']
    
    # Verify the todo has the tag assigned
    if not print_test_result("Todo has tags field", 'tags' in todo):
        return None
        
    if not print_test_result("Todo has correct tag assigned", len(todo['tags']) == 1 and todo['tags'][0]['id'] == project_tag_id):
        return None
    
    # Verify via GET /api/todos?status=all
    response = requests.get(f"{BASE_URL}/todos?status=all")
    if not print_test_result("GET all todos", response.status_code == 200, f"Status: {response.status_code}"):
        return None
        
    todos = response.json()
    test_todo = next((t for t in todos if t['id'] == todo_id), None)
    
    if not print_test_result("Find created todo in list", test_todo is not None):
        return None
        
    if not print_test_result("Todo in list has tag", len(test_todo.get('tags', [])) == 1 and test_todo['tags'][0]['id'] == project_tag_id):
        return None
    
    return todo_id

def test_tag_assignments(todo_id, source_tag_id, project_tag_id):
    """Test tag assignment endpoints"""
    print("\n=== Testing Tag Assignments ===")
    
    # Test adding project tag to todo
    assignment_data = {
        "todo_id": todo_id,
        "tag_id": project_tag_id
    }
    
    response = requests.post(f"{BASE_URL}/todo-tags", json=assignment_data)
    if not print_test_result("Add project tag to todo", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Test removing tag from todo
    response = requests.delete(f"{BASE_URL}/todo-tags/{todo_id}/{project_tag_id}")
    if not print_test_result("Remove tag from todo", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Create a test note for note-tag testing
    note_data = {
        "title": "Test Note for Tags",
        "content": {"type": "doc", "content": []},
        "owner_id": DEFAULT_OWNER
    }
    
    response = requests.post(f"{BASE_URL}/notes", json=note_data)
    if not print_test_result("Create test note", response.status_code == 201, f"Status: {response.status_code}"):
        return False
        
    note_id = response.json()['id']
    
    # Test adding source tag to note
    note_assignment_data = {
        "note_id": note_id,
        "tag_id": source_tag_id
    }
    
    response = requests.post(f"{BASE_URL}/note-tags", json=note_assignment_data)
    if not print_test_result("Add source tag to note", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Test removing tag from note
    response = requests.delete(f"{BASE_URL}/note-tags/{note_id}/{source_tag_id}")
    if not print_test_result("Remove tag from note", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Cleanup test note
    requests.delete(f"{BASE_URL}/notes/{note_id}")
    
    return True

def test_basic_crud_still_works():
    """Test that basic CRUD operations still work"""
    print("\n=== Testing Basic CRUD Still Works ===")
    
    # Test Notes CRUD
    note_data = {
        "title": "CRUD Test Note",
        "content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Test content"}]}]},
        "owner_id": DEFAULT_OWNER
    }
    
    # Create note
    response = requests.post(f"{BASE_URL}/notes", json=note_data)
    if not print_test_result("Notes CREATE", response.status_code == 201, f"Status: {response.status_code}"):
        return False
    note_id = response.json()['id']
    
    # Read note
    response = requests.get(f"{BASE_URL}/notes/{note_id}")
    if not print_test_result("Notes READ", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Update note
    update_data = {"title": "Updated CRUD Test Note"}
    response = requests.put(f"{BASE_URL}/notes/{note_id}", json=update_data)
    if not print_test_result("Notes UPDATE", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Delete note
    response = requests.delete(f"{BASE_URL}/notes/{note_id}")
    if not print_test_result("Notes DELETE", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Test Todos CRUD
    todo_data = {
        "text": "CRUD Test Todo",
        "owner_id": DEFAULT_OWNER
    }
    
    # Create todo
    response = requests.post(f"{BASE_URL}/todos", json=todo_data)
    if not print_test_result("Todos CREATE", response.status_code == 201, f"Status: {response.status_code}"):
        return False
    todo_id = response.json()['id']
    
    # Read todos
    response = requests.get(f"{BASE_URL}/todos")
    if not print_test_result("Todos READ", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Update todo
    update_data = {"text": "Updated CRUD Test Todo"}
    response = requests.put(f"{BASE_URL}/todos/{todo_id}", json=update_data)
    if not print_test_result("Todos UPDATE", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Toggle todo
    response = requests.patch(f"{BASE_URL}/todos/{todo_id}/toggle")
    if not print_test_result("Todos TOGGLE", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Archive todo
    response = requests.patch(f"{BASE_URL}/todos/{todo_id}/archive")
    if not print_test_result("Todos ARCHIVE", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    # Delete todo
    response = requests.delete(f"{BASE_URL}/todos/{todo_id}")
    if not print_test_result("Todos DELETE", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    return True

def test_inline_todo_sync():
    """Test that inline todo sync still works"""
    print("\n=== Testing Inline Todo Sync Still Works ===")
    
    # Create note with task items
    note_data = {
        "title": "Inline Sync Test Note",
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
                                {"type": "paragraph", "content": [{"type": "text", "text": "Test task from note"}]}
                            ]
                        }
                    ]
                }
            ]
        },
        "owner_id": DEFAULT_OWNER
    }
    
    response = requests.post(f"{BASE_URL}/notes", json=note_data)
    if not print_test_result("Create note with task items", response.status_code == 201, f"Status: {response.status_code}"):
        return False
        
    note_id = response.json()['id']
    
    # Update the note to trigger todo creation
    response = requests.put(f"{BASE_URL}/notes/{note_id}", json={"content": note_data["content"]})
    if not print_test_result("Update note to trigger sync", response.status_code == 200, f"Status: {response.status_code}"):
        return False
    
    updated_note = response.json()
    
    # Check that todoId was assigned to content
    task_items = []
    def extract_task_items(content):
        if isinstance(content, dict):
            if content.get('type') == 'taskItem':
                task_items.append(content)
            elif 'content' in content:
                if isinstance(content['content'], list):
                    for item in content['content']:
                        extract_task_items(item)
    
    extract_task_items(updated_note.get('content', {}))
    
    if not print_test_result("Task item has todoId assigned", len(task_items) > 0 and task_items[0].get('attrs', {}).get('todoId')):
        return False
    
    todo_id = task_items[0]['attrs']['todoId']
    
    # Verify todo was created
    response = requests.get(f"{BASE_URL}/todos?status=all")
    if not print_test_result("GET todos to verify creation", response.status_code == 200, f"Status: {response.status_code}"):
        return False
        
    todos = response.json()
    created_todo = next((t for t in todos if t['id'] == todo_id), None)
    
    if not print_test_result("Todo created from note task item", created_todo is not None and created_todo['note_id'] == note_id):
        return False
    
    # Cleanup
    requests.delete(f"{BASE_URL}/notes/{note_id}")
    
    return True

def cleanup_test_data(tag_ids):
    """Clean up test data"""
    print("\n=== Cleaning Up Test Data ===")
    
    # Clean up test tags
    for tag_id in tag_ids:
        if tag_id:
            response = requests.delete(f"{BASE_URL}/tags/{tag_id}")
            print_test_result(f"Delete tag {tag_id}", response.status_code == 200, f"Status: {response.status_code}")
    
    # Clean up any remaining test todos
    try:
        response = requests.get(f"{BASE_URL}/todos?status=all")
        if response.status_code == 200:
            todos = response.json()
            test_todos = [t for t in todos if 'test' in t.get('text', '').lower()]
            for todo in test_todos:
                requests.delete(f"{BASE_URL}/todos/{todo['id']}")
    except:
        pass

def main():
    print(f"Testing Updated Tag System - Base URL: {BASE_URL}")
    print("=" * 60)
    
    try:
        # Test 1: Tag type filtering
        tag_result = test_tag_type_filtering()
        if not tag_result:
            print("\n❌ CRITICAL FAILURE: Tag type filtering failed")
            return False
            
        source_tag_id = tag_result['source_tag_id']
        project_tag_id = tag_result['project_tag_id']
        
        # Test 2: Todo creation with tag_ids
        todo_id = test_todo_creation_with_tag_ids(project_tag_id)
        if not todo_id:
            print("\n❌ CRITICAL FAILURE: Todo creation with tag_ids failed")
            cleanup_test_data([source_tag_id, project_tag_id])
            return False
        
        # Test 3: Tag assignments
        if not test_tag_assignments(todo_id, source_tag_id, project_tag_id):
            print("\n❌ FAILURE: Tag assignments failed")
            cleanup_test_data([source_tag_id, project_tag_id])
            return False
        
        # Test 4: Basic CRUD still works
        if not test_basic_crud_still_works():
            print("\n❌ FAILURE: Basic CRUD operations failed")
            cleanup_test_data([source_tag_id, project_tag_id])
            return False
        
        # Test 5: Inline todo sync still works
        if not test_inline_todo_sync():
            print("\n❌ FAILURE: Inline todo sync failed")
            cleanup_test_data([source_tag_id, project_tag_id])
            return False
        
        # Cleanup
        cleanup_test_data([source_tag_id, project_tag_id])
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED - Updated Tag System Working Correctly")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ EXCEPTION DURING TESTING: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)