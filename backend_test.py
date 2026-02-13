#!/usr/bin/env python3
"""
Backend Testing Suite for Notebook + Todo API
Tests all CRUD operations, inline todo sync, and bidirectional sync functionality
"""

import requests
import json
import uuid
import time
from typing import Dict, List, Any

# Configuration
BASE_URL = "https://notebook-flow.preview.emergentagent.com/api"
DEFAULT_OWNER = "00000000-0000-0000-0000-000000000001"

class TodoNotebookTester:
    def __init__(self):
        self.session = requests.Session()
        self.created_notes = []
        self.created_todos = []
        self.created_tags = []
        
    def log(self, message: str, success: bool = True):
        status = "✅" if success else "❌"
        print(f"{status} {message}")
        
    def cleanup(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        for note_id in self.created_notes:
            try:
                self.session.delete(f"{BASE_URL}/notes/{note_id}")
            except Exception:
                pass
                
        for todo_id in self.created_todos:
            try:
                self.session.delete(f"{BASE_URL}/todos/{todo_id}")
            except Exception:
                pass
                
        for tag_id in self.created_tags:
            try:
                self.session.delete(f"{BASE_URL}/tags/{tag_id}")
            except Exception:
                pass
        
        self.log("Test data cleaned up")

    def test_database_setup(self) -> bool:
        """Test database setup endpoint"""
        print("\n📊 Testing Database Setup...")
        try:
            response = self.session.post(f"{BASE_URL}/db/setup")
            success = response.status_code == 200
            data = response.json() if response.text else {}
            self.log(f"Database setup - Status: {response.status_code}, Response: {data}", success)
            return success
        except Exception as e:
            self.log(f"Database setup failed: {e}", False)
            return False

    def test_notes_crud(self) -> bool:
        """Test Notes CRUD operations"""
        print("\n📝 Testing Notes CRUD...")
        success = True
        
        try:
            # Test POST /api/notes - Create note
            create_data = {
                "title": f"Test Note {uuid.uuid4().hex[:8]}",
                "content": {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "This is a test note content"}]
                        }
                    ]
                }
            }
            
            response = self.session.post(f"{BASE_URL}/notes", json=create_data)
            if response.status_code != 201:
                self.log(f"Create note failed - Status: {response.status_code}, Response: {response.text}", False)
                return False
                
            note = response.json()
            note_id = note.get('id')
            if not note_id:
                self.log("Create note failed - No ID returned", False)
                return False
                
            self.created_notes.append(note_id)
            self.log(f"Note created successfully - ID: {note_id}")
            
            # Test GET /api/notes - List notes
            response = self.session.get(f"{BASE_URL}/notes")
            if response.status_code != 200:
                self.log(f"List notes failed - Status: {response.status_code}", False)
                success = False
            else:
                notes = response.json()
                found = any(n['id'] == note_id for n in notes)
                self.log(f"List notes successful - Found created note: {found}", found)
                if not found:
                    success = False
            
            # Test GET /api/notes/:id - Get single note
            response = self.session.get(f"{BASE_URL}/notes/{note_id}")
            if response.status_code != 200:
                self.log(f"Get single note failed - Status: {response.status_code}", False)
                success = False
            else:
                retrieved_note = response.json()
                title_matches = retrieved_note.get('title') == create_data['title']
                self.log(f"Get single note successful - Title matches: {title_matches}", title_matches)
                if not title_matches:
                    success = False
            
            # Test PUT /api/notes/:id - Update note
            update_data = {
                "title": f"Updated Note {uuid.uuid4().hex[:8]}",
                "content": {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph", 
                            "content": [{"type": "text", "text": "Updated content"}]
                        }
                    ]
                }
            }
            
            response = self.session.put(f"{BASE_URL}/notes/{note_id}", json=update_data)
            if response.status_code != 200:
                self.log(f"Update note failed - Status: {response.status_code}", False)
                success = False
            else:
                updated_note = response.json()
                title_updated = updated_note.get('title') == update_data['title']
                self.log(f"Note updated successfully - Title updated: {title_updated}", title_updated)
                if not title_updated:
                    success = False
            
            # Test search functionality
            search_query = update_data['title'].split()[0]  # Use first word for search
            response = self.session.get(f"{BASE_URL}/notes", params={"search": search_query})
            if response.status_code != 200:
                self.log(f"Search notes failed - Status: {response.status_code}", False)
                success = False
            else:
                search_results = response.json()
                found_in_search = any(n['id'] == note_id for n in search_results)
                self.log(f"Search notes successful - Found in results: {found_in_search}", found_in_search)
                if not found_in_search:
                    success = False
            
            return success
            
        except Exception as e:
            self.log(f"Notes CRUD test failed: {e}", False)
            return False

    def test_todos_crud(self) -> bool:
        """Test Todos CRUD operations"""
        print("\n✅ Testing Todos CRUD...")
        success = True
        
        try:
            # Test POST /api/todos - Create standalone todo
            create_data = {
                "text": f"Test Todo Item {uuid.uuid4().hex[:8]}",
                "owner_id": DEFAULT_OWNER
            }
            
            response = self.session.post(f"{BASE_URL}/todos", json=create_data)
            if response.status_code != 201:
                self.log(f"Create todo failed - Status: {response.status_code}, Response: {response.text}", False)
                return False
                
            todo = response.json()
            todo_id = todo.get('id')
            if not todo_id:
                self.log("Create todo failed - No ID returned", False)
                return False
                
            self.created_todos.append(todo_id)
            self.log(f"Todo created successfully - ID: {todo_id}")
            
            # Test GET /api/todos - List todos with different statuses
            for status in ['all', 'open', 'done']:
                response = self.session.get(f"{BASE_URL}/todos", params={"status": status})
                if response.status_code != 200:
                    self.log(f"List todos (status={status}) failed - Status: {response.status_code}", False)
                    success = False
                else:
                    todos = response.json()
                    if status in ['all', 'open']:  # New todo should be open
                        found = any(t['id'] == todo_id for t in todos)
                        self.log(f"List todos (status={status}) successful - Found: {found}", found)
                        if not found:
                            success = False
                    else:
                        self.log(f"List todos (status={status}) successful")
            
            # Test PUT /api/todos/:id - Update todo
            update_data = {
                "text": f"Updated Todo {uuid.uuid4().hex[:8]}",
                "is_done": False
            }
            
            response = self.session.put(f"{BASE_URL}/todos/{todo_id}", json=update_data)
            if response.status_code != 200:
                self.log(f"Update todo failed - Status: {response.status_code}", False)
                success = False
            else:
                updated_todo = response.json()
                text_updated = updated_todo.get('text') == update_data['text']
                self.log(f"Todo updated successfully - Text updated: {text_updated}", text_updated)
                if not text_updated:
                    success = False
            
            # Test PATCH /api/todos/:id/toggle - Toggle todo
            response = self.session.patch(f"{BASE_URL}/todos/{todo_id}/toggle")
            if response.status_code != 200:
                self.log(f"Toggle todo failed - Status: {response.status_code}", False)
                success = False
            else:
                toggled_todo = response.json()
                is_done = toggled_todo.get('is_done')
                self.log(f"Todo toggled successfully - Is done: {is_done}", is_done)
                if not is_done:
                    success = False
            
            # Test PATCH /api/todos/:id/archive - Archive todo
            response = self.session.patch(f"{BASE_URL}/todos/{todo_id}/archive")
            if response.status_code != 200:
                self.log(f"Archive todo failed - Status: {response.status_code}", False)
                success = False
            else:
                archived_todo = response.json()
                is_archived = archived_todo.get('archived_at') is not None
                self.log(f"Todo archived successfully - Is archived: {is_archived}", is_archived)
                if not is_archived:
                    success = False
            
            # Test with show_archived=true
            response = self.session.get(f"{BASE_URL}/todos", params={"show_archived": "true"})
            if response.status_code != 200:
                self.log(f"List archived todos failed - Status: {response.status_code}", False)
                success = False
            else:
                archived_todos = response.json()
                found_archived = any(t['id'] == todo_id for t in archived_todos)
                self.log(f"List archived todos successful - Found archived: {found_archived}", found_archived)
                if not found_archived:
                    success = False
            
            # Test search functionality
            search_query = update_data['text'].split()[0]  # Use first word for search
            response = self.session.get(f"{BASE_URL}/todos", params={"search": search_query, "show_archived": "true"})
            if response.status_code != 200:
                self.log(f"Search todos failed - Status: {response.status_code}", False)
                success = False
            else:
                search_results = response.json()
                found_in_search = any(t['id'] == todo_id for t in search_results)
                self.log(f"Search todos successful - Found in results: {found_in_search}", found_in_search)
                if not found_in_search:
                    success = False
            
            return success
            
        except Exception as e:
            self.log(f"Todos CRUD test failed: {e}", False)
            return False

    def test_tags_crud(self) -> bool:
        """Test Tags CRUD operations"""
        print("\n🏷️ Testing Tags CRUD...")
        success = True
        
        try:
            # Test POST /api/tags - Create tag
            create_data = {
                "name": f"Test-Tag-{uuid.uuid4().hex[:8]}",
                "type": "project",
                "color": "#FF5733",
                "owner_id": DEFAULT_OWNER
            }
            
            response = self.session.post(f"{BASE_URL}/tags", json=create_data)
            if response.status_code != 201:
                self.log(f"Create tag failed - Status: {response.status_code}, Response: {response.text}", False)
                return False
                
            tag = response.json()
            tag_id = tag.get('id')
            if not tag_id:
                self.log("Create tag failed - No ID returned", False)
                return False
                
            self.created_tags.append(tag_id)
            self.log(f"Tag created successfully - ID: {tag_id}")
            
            # Test GET /api/tags - List tags
            response = self.session.get(f"{BASE_URL}/tags")
            if response.status_code != 200:
                self.log(f"List tags failed - Status: {response.status_code}", False)
                success = False
            else:
                tags = response.json()
                found = any(t['id'] == tag_id for t in tags)
                self.log(f"List tags successful - Found created tag: {found}", found)
                if not found:
                    success = False
            
            return success
            
        except Exception as e:
            self.log(f"Tags CRUD test failed: {e}", False)
            return False

    def test_inline_todo_sync(self) -> bool:
        """Test the critical inline todo sync functionality"""
        print("\n🔄 Testing Inline Todo Sync (Critical Feature)...")
        success = True
        
        try:
            # Step 1: Create a note
            note_data = {
                "title": f"Sync Test Note {uuid.uuid4().hex[:8]}",
                "content": {
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": "Note with tasks:"}]
                        }
                    ]
                }
            }
            
            response = self.session.post(f"{BASE_URL}/notes", json=note_data)
            if response.status_code != 201:
                self.log(f"Create note for sync test failed - Status: {response.status_code}", False)
                return False
            
            note = response.json()
            note_id = note['id']
            self.created_notes.append(note_id)
            self.log(f"Note created for sync test - ID: {note_id}")
            
            # Step 2: Update note with task items (without todoIds)
            updated_content = {
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": "Note with tasks:"}]
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
                                        "content": [{"type": "text", "text": "First task item"}]
                                    }
                                ]
                            },
                            {
                                "type": "taskItem", 
                                "attrs": {"checked": True},
                                "content": [
                                    {
                                        "type": "paragraph",
                                        "content": [{"type": "text", "text": "Second completed task"}]
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
            
            response = self.session.put(f"{BASE_URL}/notes/{note_id}", json=update_data)
            if response.status_code != 200:
                self.log(f"Update note with tasks failed - Status: {response.status_code}", False)
                return False
            
            updated_note = response.json()
            self.log("Note updated with task items")
            
            # Step 3: Verify the returned content has todoIds
            returned_content = updated_note.get('content')
            if not returned_content:
                self.log("No content returned from note update", False)
                success = False
            else:
                # Check for todoIds in task items
                todo_ids_found = []
                
                def check_for_todo_ids(node):
                    if node.get('type') == 'taskItem' and node.get('attrs', {}).get('todoId'):
                        todo_ids_found.append(node['attrs']['todoId'])
                    if 'content' in node:
                        for child in node['content']:
                            check_for_todo_ids(child)
                
                check_for_todo_ids(returned_content)
                
                has_todo_ids = len(todo_ids_found) >= 2
                self.log(f"Returned content has todoIds - Found {len(todo_ids_found)} todoIds: {has_todo_ids}", has_todo_ids)
                if not has_todo_ids:
                    success = False
                else:
                    # Store the todoIds for cleanup
                    self.created_todos.extend(todo_ids_found)
            
            # Step 4: Verify todo rows were created in DB
            response = self.session.get(f"{BASE_URL}/todos", params={"status": "all"})
            if response.status_code != 200:
                self.log(f"Get todos to verify sync failed - Status: {response.status_code}", False)
                success = False
            else:
                todos = response.json()
                note_todos = [t for t in todos if t.get('note_id') == note_id]
                correct_count = len(note_todos) >= 2
                self.log(f"Todo rows created in DB - Found {len(note_todos)} todos for note: {correct_count}", correct_count)
                
                if correct_count and note_todos:
                    # Check if todo texts match
                    todo_texts = [t['text'] for t in note_todos]
                    has_first_task = "First task item" in todo_texts
                    has_second_task = "Second completed task" in todo_texts
                    texts_match = has_first_task and has_second_task
                    self.log(f"Todo texts match expected - First: {has_first_task}, Second: {has_second_task}: {texts_match}", texts_match)
                    
                    # Check if done status matches
                    completed_todos = [t for t in note_todos if t.get('is_done')]
                    has_completed = len(completed_todos) >= 1
                    self.log(f"Completed todo status correct - Found {len(completed_todos)} completed todos: {has_completed}", has_completed)
                    
                    if not (texts_match and has_completed):
                        success = False
                else:
                    success = False
            
            return success
            
        except Exception as e:
            self.log(f"Inline todo sync test failed: {e}", False)
            return False

    def test_bidirectional_sync(self) -> bool:
        """Test bidirectional sync - todo update syncs back to note content"""
        print("\n🔄 Testing Bidirectional Sync...")
        success = True
        
        try:
            # Step 1: Create a note with a task item
            note_data = {
                "title": f"Bidirectional Test {uuid.uuid4().hex[:8]}",
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
                                            "content": [{"type": "text", "text": "Original task text"}]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            }
            
            response = self.session.post(f"{BASE_URL}/notes", json=note_data)
            if response.status_code != 201:
                self.log(f"Create note for bidirectional test failed - Status: {response.status_code}", False)
                return False
            
            note = response.json()
            note_id = note['id']
            self.created_notes.append(note_id)
            
            # Get the todoId from the response
            content = note.get('content', {})
            todo_id = None
            
            def find_todo_id(node):
                nonlocal todo_id
                if node.get('type') == 'taskItem' and node.get('attrs', {}).get('todoId'):
                    todo_id = node['attrs']['todoId']
                    return True
                if 'content' in node:
                    for child in node['content']:
                        if find_todo_id(child):
                            return True
                return False
            
            find_todo_id(content)
            
            if not todo_id:
                self.log("No todoId found in created note content", False)
                return False
            
            self.created_todos.append(todo_id)
            self.log(f"Found todoId in note content: {todo_id}")
            
            # Step 2: Update the todo from the todo view
            new_text = f"Updated from todo view {uuid.uuid4().hex[:6]}"
            update_data = {
                "text": new_text,
                "is_done": True
            }
            
            response = self.session.put(f"{BASE_URL}/todos/{todo_id}", json=update_data)
            if response.status_code != 200:
                self.log(f"Update todo failed - Status: {response.status_code}", False)
                return False
            
            updated_todo = response.json()
            self.log(f"Todo updated successfully - New text: {updated_todo.get('text')}")
            
            # Step 3: Verify the note content was also updated
            time.sleep(0.5)  # Small delay to ensure sync completes
            
            response = self.session.get(f"{BASE_URL}/notes/{note_id}")
            if response.status_code != 200:
                self.log(f"Get updated note failed - Status: {response.status_code}", False)
                success = False
            else:
                updated_note = response.json()
                updated_content = updated_note.get('content')
                
                if not updated_content:
                    self.log("No content in updated note", False)
                    success = False
                else:
                    # Check if the note content was updated
                    found_updated_text = False
                    found_checked_status = False
                    
                    def check_content_update(node):
                        nonlocal found_updated_text, found_checked_status
                        if (node.get('type') == 'taskItem' and 
                            node.get('attrs', {}).get('todoId') == todo_id):
                            # Check if text was updated
                            if node.get('content'):
                                for child in node['content']:
                                    if child.get('type') == 'paragraph' and child.get('content'):
                                        for text_node in child['content']:
                                            if text_node.get('type') == 'text' and new_text in text_node.get('text', ''):
                                                found_updated_text = True
                            
                            # Check if checked status was updated
                            if node.get('attrs', {}).get('checked') == True:
                                found_checked_status = True
                        
                        if 'content' in node:
                            for child in node['content']:
                                check_content_update(child)
                    
                    check_content_update(updated_content)
                    
                    text_synced = found_updated_text
                    status_synced = found_checked_status
                    
                    self.log(f"Note content updated with new text: {text_synced}", text_synced)
                    self.log(f"Note content updated with checked status: {status_synced}", status_synced)
                    
                    if not (text_synced and status_synced):
                        success = False
            
            return success
            
        except Exception as e:
            self.log(f"Bidirectional sync test failed: {e}", False)
            return False

    def test_tag_assignments(self) -> bool:
        """Test tag assignment endpoints"""
        print("\n🏷️ Testing Tag Assignments...")
        success = True
        
        try:
            # Create test data
            tag_data = {
                "name": f"Assignment-Tag-{uuid.uuid4().hex[:8]}",
                "type": "project",
                "color": "#42A5F5"
            }
            
            response = self.session.post(f"{BASE_URL}/tags", json=tag_data)
            if response.status_code != 201:
                self.log(f"Create tag for assignment test failed", False)
                return False
            
            tag = response.json()
            tag_id = tag['id']
            self.created_tags.append(tag_id)
            
            note_data = {
                "title": f"Tag Test Note {uuid.uuid4().hex[:8]}",
                "content": {"type": "doc", "content": []}
            }
            
            response = self.session.post(f"{BASE_URL}/notes", json=note_data)
            if response.status_code != 201:
                self.log(f"Create note for assignment test failed", False)
                return False
            
            note = response.json()
            note_id = note['id']
            self.created_notes.append(note_id)
            
            todo_data = {"text": f"Tag Test Todo {uuid.uuid4().hex[:8]}"}
            response = self.session.post(f"{BASE_URL}/todos", json=todo_data)
            if response.status_code != 201:
                self.log(f"Create todo for assignment test failed", False)
                return False
            
            todo = response.json()
            todo_id = todo['id']
            self.created_todos.append(todo_id)
            
            # Test note-tag assignment
            response = self.session.post(f"{BASE_URL}/note-tags", json={"note_id": note_id, "tag_id": tag_id})
            if response.status_code != 200:
                self.log(f"Assign tag to note failed - Status: {response.status_code}", False)
                success = False
            else:
                self.log("Tag assigned to note successfully")
                
                # Verify assignment by getting note with tags
                response = self.session.get(f"{BASE_URL}/notes/{note_id}")
                if response.status_code == 200:
                    note_with_tags = response.json()
                    tags = note_with_tags.get('tags', [])
                    tag_found = any(t['id'] == tag_id for t in tags)
                    self.log(f"Note tag assignment verified: {tag_found}", tag_found)
                    if not tag_found:
                        success = False
            
            # Test todo-tag assignment
            response = self.session.post(f"{BASE_URL}/todo-tags", json={"todo_id": todo_id, "tag_id": tag_id})
            if response.status_code != 200:
                self.log(f"Assign tag to todo failed - Status: {response.status_code}", False)
                success = False
            else:
                self.log("Tag assigned to todo successfully")
                
                # Verify assignment by filtering todos by tag
                response = self.session.get(f"{BASE_URL}/todos", params={"tag": tag_id})
                if response.status_code == 200:
                    tagged_todos = response.json()
                    todo_found = any(t['id'] == todo_id for t in tagged_todos)
                    self.log(f"Todo tag assignment verified: {todo_found}", todo_found)
                    if not todo_found:
                        success = False
            
            # Test removing assignments
            response = self.session.delete(f"{BASE_URL}/note-tags/{note_id}/{tag_id}")
            if response.status_code != 200:
                self.log(f"Remove note-tag assignment failed - Status: {response.status_code}", False)
                success = False
            else:
                self.log("Note-tag assignment removed successfully")
            
            response = self.session.delete(f"{BASE_URL}/todo-tags/{todo_id}/{tag_id}")
            if response.status_code != 200:
                self.log(f"Remove todo-tag assignment failed - Status: {response.status_code}", False)
                success = False
            else:
                self.log("Todo-tag assignment removed successfully")
            
            return success
            
        except Exception as e:
            self.log(f"Tag assignments test failed: {e}", False)
            return False

    def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests and return results"""
        print("🚀 Starting Backend API Test Suite for Notebook + Todo")
        print(f"Base URL: {BASE_URL}")
        print("-" * 60)
        
        results = {}
        
        try:
            # Run all tests
            results['database_setup'] = self.test_database_setup()
            results['notes_crud'] = self.test_notes_crud()
            results['todos_crud'] = self.test_todos_crud()
            results['tags_crud'] = self.test_tags_crud()
            results['inline_todo_sync'] = self.test_inline_todo_sync()
            results['bidirectional_sync'] = self.test_bidirectional_sync()
            results['tag_assignments'] = self.test_tag_assignments()
            
        except Exception as e:
            print(f"❌ Test suite failed with error: {e}")
            
        finally:
            # Always cleanup
            self.cleanup()
        
        # Print summary
        print("\n" + "="*60)
        print("📋 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(results)
        passed_tests = sum(1 for success in results.values() if success)
        
        for test_name, success in results.items():
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status} {test_name.replace('_', ' ').title()}")
        
        print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed - see details above")
        
        return results

if __name__ == "__main__":
    tester = TodoNotebookTester()
    results = tester.run_all_tests()