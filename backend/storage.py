"""JSON-based storage for conversations with GitHub persistence support."""

import json
import os
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from .config import DATA_DIR

try:
    from .github_storage import GitHubStorage
    # Initialize GitHub Storage Adapter
    github_storage = GitHubStorage()
except ImportError:
    print("WARNING: GitHub storage dependencies not found. GitHub storage disabled.")
    # Create a mock GitHubStorage with enabled=False
    class MockGitHubStorage:
        def __init__(self):
            self.enabled = False
        def save_file(self, *args, **kwargs):
            return False
        def get_file(self, *args, **kwargs):
            return None
        def list_files(self, *args, **kwargs):
            return []
        def delete_file(self, *args, **kwargs):
            return False
    github_storage = MockGitHubStorage()

def ensure_data_dir():
    """Ensure the data directory exists."""
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)


def get_conversation_path(conversation_id: str) -> str:
    """Get the file path for a conversation."""
    return os.path.join(DATA_DIR, f"{conversation_id}.json")


def _sync_to_github_background(filename: str, content: Dict[str, Any], message: str):
    """Background task to sync file to GitHub."""
    try:
        github_storage.save_file(filename, content, message)
    except Exception as e:
        print(f"Error syncing to GitHub in background: {e}")


def create_conversation(conversation_id: str, client_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a new conversation.
    
    Args:
        conversation_id: Unique identifier for the conversation
        client_id: Optional client identifier for data isolation
        
    Returns:
        New conversation dict
    """
    ensure_data_dir()

    conversation = {
        "id": conversation_id,
        "created_at": datetime.utcnow().isoformat(),
        "title": "New Conversation",
        "messages": [],
        "client_id": client_id
    }

    # Save to local file
    path = get_conversation_path(conversation_id)
    with open(path, 'w') as f:
        json.dump(conversation, f, indent=2)

    # Sync to GitHub (Async)
    if github_storage.enabled:
        thread = threading.Thread(
            target=_sync_to_github_background,
            args=(f"{conversation_id}.json", conversation, f"Create conversation {conversation_id}")
        )
        thread.start()

    return conversation


def _sync_remote_conversation_background(conversation_id: str):
    """
    Background task to sync a single conversation from GitHub.
    If found, caches it locally for future use.
    """
    if not github_storage.enabled:
        return
    
    try:
        filename = f"{conversation_id}.json"
        conversation = github_storage.get_file(filename)
        # If found in GitHub, cache locally
        if conversation:
            ensure_data_dir()
            path = get_conversation_path(conversation_id)
            with open(path, 'w') as f:
                json.dump(conversation, f, indent=2)
    except Exception as e:
        print(f"Error syncing remote conversation {conversation_id} in background: {e}")


def get_conversation(conversation_id: str, client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.
    Tries local first, and returns None if not found locally (syncs from GitHub in background).
    
    Args:
        conversation_id: Unique identifier for the conversation
        client_id: Optional client identifier for verification
        
    Returns:
        Conversation dict or None if not found locally or unauthorized
    """
    path = get_conversation_path(conversation_id)
    conversation = None

    # Try local storage first for fast response
    if os.path.exists(path):
        with open(path, 'r') as f:
            conversation = json.load(f)
    else:
        # If not found locally, sync from GitHub in background
        if github_storage.enabled:
            print(f"Conversation {conversation_id} not found locally, syncing from GitHub in background...")
            thread = threading.Thread(
                target=_sync_remote_conversation_background,
                args=(conversation_id,)
            )
            thread.start()
        # Return None immediately, don't block waiting for GitHub
        return None

    # Check ownership if client_id is provided and conversation has an owner
    if client_id and conversation.get("client_id") and conversation.get("client_id") != client_id:
        return None
        
    return conversation


def save_conversation(conversation: Dict[str, Any]):
    """
    Save a conversation to storage.
    Writes to local disk immediately and GitHub asynchronously.
    
    Args:
        conversation: Conversation dict to save
    """
    ensure_data_dir()
    conversation_id = conversation['id']

    # Save locally
    path = get_conversation_path(conversation_id)
    with open(path, 'w') as f:
        json.dump(conversation, f, indent=2)
        
    # Sync to GitHub (Async background task)
    if github_storage.enabled:
        # Determine message type based on last message
        msg = f"Update conversation {conversation_id}"
        if conversation.get("messages"):
            last_msg = conversation["messages"][-1]
            if last_msg.get("role") == "user":
                msg = f"User message in {conversation_id}"
            elif last_msg.get("role") == "assistant":
                msg = f"Assistant response in {conversation_id}"
        
        # Run in a separate thread to avoid blocking the response
        thread = threading.Thread(
            target=_sync_to_github_background,
            args=(f"{conversation_id}.json", conversation, msg)
        )
        thread.start()


def _sync_remote_conversations_background():
    """Background task to sync remote conversations from GitHub."""
    if not github_storage.enabled:
        return
    
    try:
        remote_files = github_storage.list_files()
        for filename in remote_files:
            conv_id = filename.replace(".json", "")
            local_path = os.path.join(DATA_DIR, filename)
            # Only fetch if local file doesn't exist or is older than a certain time
            if not os.path.exists(local_path):
                # Fetch full content and cache locally
                data = github_storage.get_file(filename)
                if data:
                    with open(local_path, 'w') as f:
                        json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error syncing remote conversations in background: {e}")


def list_conversations(client_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List all conversations (metadata only).
    Uses only local files for fast response, syncs with GitHub in background.
    
    Args:
        client_id: Optional client identifier to filter conversations

    Returns:
        List of conversation metadata dicts
    """
    ensure_data_dir()
    
    # Use a dict to store conversations
    conversations_map = {}

    # 1. Read only local files for fast response
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.json'):
            path = os.path.join(DATA_DIR, filename)
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                    conversations_map[data["id"]] = data
            except Exception as e:
                print(f"Error reading local conversation {filename}: {e}")
                continue
                
    # 2. Sync with GitHub in background (non-blocking)
    if github_storage.enabled:
        thread = threading.Thread(target=_sync_remote_conversations_background)
        thread.start()

    # 3. Filter and Format
    results = []
    for data in conversations_map.values():
        # Filter by client_id
        if client_id:
            if data.get("client_id") != client_id:
                continue
                
        results.append({
            "id": data["id"],
            "created_at": data["created_at"],
            "title": data.get("title", "New Conversation"),
            "message_count": len(data["messages"])
        })

    # Sort by creation time, newest first
    results.sort(key=lambda x: x["created_at"], reverse=True)

    return results


def add_user_message(conversation_id: str, content: str, quoted_items: Optional[List[Dict[str, Any]]] = None, files: Optional[List[Dict[str, Any]]] = None):
    """
    Add a user message to a conversation.
    """
    # ... implementation remains same, calls get_conversation and save_conversation ...
    conversation = get_conversation(conversation_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    user_message = {
        "role": "user",
        "content": content
    }
    
    # Add quoted items if available
    if quoted_items:
        user_message["quoted_items"] = quoted_items
    
    # Add files if available (only save name, not full content for storage efficiency)
    if files:
        user_message["files"] = [{"name": f["name"]} for f in files]

    conversation["messages"].append(user_message)

    save_conversation(conversation)


def add_assistant_message(
    conversation_id: str,
    stage1: List[Dict[str, Any]],
    stage2: List[Dict[str, Any]],
    stage3: Dict[str, Any]
):
    """
    Add an assistant message with all 3 stages to a conversation.
    """
    conversation = get_conversation(conversation_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["messages"].append({
        "role": "assistant",
        "stage1": stage1,
        "stage2": stage2,
        "stage3": stage3
    })

    save_conversation(conversation)


def update_conversation_title(conversation_id: str, title: str):
    """
    Update the title of a conversation.
    """
    conversation = get_conversation(conversation_id)
    if conversation is None:
        raise ValueError(f"Conversation {conversation_id} not found")

    conversation["title"] = title
    save_conversation(conversation)


def _delete_remote_conversation_background(conversation_id: str):
    """Background task to delete conversation from GitHub."""
    if not github_storage.enabled:
        return
    
    try:
        github_storage.delete_file(f"{conversation_id}.json")
    except Exception as e:
        print(f"Error deleting remote conversation in background: {e}")


def delete_conversation(conversation_id: str) -> bool:
    """
    Delete a conversation from storage.
    Deletes locally immediately, deletes from GitHub in background.
    """
    path = get_conversation_path(conversation_id)
    local_deleted = False
    
    if os.path.exists(path):
        os.remove(path)
        local_deleted = True
        
    # Delete from GitHub in background (non-blocking)
    if github_storage.enabled:
        thread = threading.Thread(
            target=_delete_remote_conversation_background,
            args=(conversation_id,)
        )
        thread.start()
        
    return local_deleted
