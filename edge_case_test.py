#!/usr/bin/env python3
"""
Additional edge case tests
"""

import requests
import json
import uuid

BASE_URL = "https://notebook-flow.preview.emergentagent.com/api"

def test_error_cases():
    """Test error handling"""
    print("⚠️ Testing Error Cases...")
    session = requests.Session()
    
    success_count = 0
    total_tests = 0
    
    # Test 1: Get non-existent note
    total_tests += 1
    fake_id = str(uuid.uuid4())
    response = session.get(f"{BASE_URL}/notes/{fake_id}")
    if response.status_code == 404:
        print("✅ Non-existent note returns 404")
        success_count += 1
    else:
        print(f"❌ Non-existent note returned: {response.status_code}")
    
    # Test 2: Get non-existent todo
    total_tests += 1
    response = session.get(f"{BASE_URL}/todos/{fake_id}")
    if response.status_code == 404:
        print("✅ Non-existent todo returns 404")
        success_count += 1
    else:
        print(f"❌ Non-existent todo returned: {response.status_code}")
    
    # Test 3: Update non-existent note
    total_tests += 1
    response = session.put(f"{BASE_URL}/notes/{fake_id}", json={"title": "Test"})
    if response.status_code == 404:
        print("✅ Update non-existent note returns 404")
        success_count += 1
    else:
        print(f"❌ Update non-existent note returned: {response.status_code}")
    
    # Test 4: Update non-existent todo
    total_tests += 1
    response = session.put(f"{BASE_URL}/todos/{fake_id}", json={"text": "Test"})
    if response.status_code == 404:
        print("✅ Update non-existent todo returns 404")
        success_count += 1
    else:
        print(f"❌ Update non-existent todo returned: {response.status_code}")
    
    # Test 5: Invalid endpoint
    total_tests += 1
    response = session.get(f"{BASE_URL}/invalid-endpoint")
    if response.status_code in [404, 405]:
        print("✅ Invalid endpoint returns appropriate error")
        success_count += 1
    else:
        print(f"❌ Invalid endpoint returned: {response.status_code}")
    
    print(f"Error handling: {success_count}/{total_tests} tests passed")
    return success_count == total_tests

def test_nested_todos():
    """Test parent-child todo relationships"""
    print("\n👪 Testing Nested Todos...")
    session = requests.Session()
    
    try:
        # Create parent todo
        parent_data = {"text": "Parent task"}
        response = session.post(f"{BASE_URL}/todos", json=parent_data)
        if response.status_code != 201:
            print("❌ Failed to create parent todo")
            return False
        
        parent_todo = response.json()
        parent_id = parent_todo['id']
        print(f"✅ Created parent todo: {parent_id}")
        
        # Create child todo
        child_data = {"text": "Child task", "parent_todo_id": parent_id}
        response = session.post(f"{BASE_URL}/todos", json=child_data)
        if response.status_code != 201:
            print("❌ Failed to create child todo")
            return False
        
        child_todo = response.json()
        child_id = child_todo['id']
        print(f"✅ Created child todo: {child_id}")
        
        # Mark parent as done (should cascade to child)
        response = session.patch(f"{BASE_URL}/todos/{parent_id}/toggle")
        if response.status_code != 200:
            print("❌ Failed to toggle parent todo")
            return False
        
        print("✅ Marked parent as done")
        
        # Check if child was also marked as done
        response = session.get(f"{BASE_URL}/todos", params={"status": "done"})
        if response.status_code == 200:
            done_todos = response.json()
            parent_done = any(t['id'] == parent_id for t in done_todos)
            child_done = any(t['id'] == child_id for t in done_todos)
            
            cascade_worked = parent_done and child_done
            print(f"✅ Cascade toggle worked - Parent done: {parent_done}, Child done: {child_done}")
            
            # Cleanup
            session.delete(f"{BASE_URL}/todos/{parent_id}")
            session.delete(f"{BASE_URL}/todos/{child_id}")
            
            return cascade_worked
        else:
            print("❌ Failed to get done todos")
            return False
            
    except Exception as e:
        print(f"❌ Nested todos test failed: {e}")
        return False

if __name__ == "__main__":
    error_success = test_error_cases()
    nested_success = test_nested_todos()
    
    print(f"\n📋 EDGE CASE SUMMARY:")
    print(f"{'✅' if error_success else '❌'} Error Handling")
    print(f"{'✅' if nested_success else '❌'} Nested Todos")