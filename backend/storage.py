"""JSON-based storage for conversations with GitHub persistence support."""

import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from .config import DATA_DIR
from .github_storage import GitHubStorage

# Initialize GitHub Storage Adapter
github_storage = GitHubStorage()

def ensure_data_dir():
    """Ensure the data directory exists."""
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)


def get_conversation_path(conversation_id: str) -> str:
    """Get the file path for a conversation."""
    return os.path.join(DATA_DIR, f"{conversation_id}.json")


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

    # Sync to GitHub
    if github_storage.enabled:
        github_storage.save_file(f"{conversation_id}.json", conversation, f"Create conversation {conversation_id}")

    return conversation


def get_conversation(conversation_id: str, client_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Load a conversation from storage.
    Tries local first, then GitHub if not found locally (and syncs back).

    Args:
        conversation_id: Unique identifier for the conversation
        client_id: Optional client identifier for verification

    Returns:
        Conversation dict or None if not found or unauthorized
    """
    path = get_conversation_path(conversation_id)
    conversation = None

    # Try local storage first
    if os.path.exists(path):
        with open(path, 'r') as f:
            conversation = json.load(f)
    
    # If not found locally, try GitHub
    if conversation is None and github_storage.enabled:
        print(f"Conversation {conversation_id} not found locally, checking GitHub...")
        conversation = github_storage.get_file(f"{conversation_id}.json")
        # If found in GitHub, cache locally
        if conversation:
            ensure_data_dir()
            with open(path, 'w') as f:
                json.dump(conversation, f, indent=2)

    if conversation is None:
        return None
        
    # Check ownership if client_id is provided and conversation has an owner
    if client_id and conversation.get("client_id") and conversation.get("client_id") != client_id:
        return None
        
    return conversation


def save_conversation(conversation: Dict[str, Any]):
    """
    Save a conversation to storage.
    Writes to both local disk and GitHub.

    Args:
        conversation: Conversation dict to save
    """
    ensure_data_dir()
    conversation_id = conversation['id']

    # Save locally
    path = get_conversation_path(conversation_id)
    with open(path, 'w') as f:
        json.dump(conversation, f, indent=2)
        
    # Sync to GitHub (background task ideal, but synchronous for now for safety)
    if github_storage.enabled:
        # Determine message type based on last message
        msg = f"Update conversation {conversation_id}"
        if conversation.get("messages"):
            last_msg = conversation["messages"][-1]
            if last_msg.get("role") == "user":
                msg = f"User message in {conversation_id}"
            elif last_msg.get("role") == "assistant":
                msg = f"Assistant response in {conversation_id}"
                
        github_storage.save_file(f"{conversation_id}.json", conversation, msg)


def list_conversations(client_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List all conversations (metadata only).
    Merges local files with GitHub files.
    
    Args:
        client_id: Optional client identifier to filter conversations

    Returns:
        List of conversation metadata dicts
    """
    ensure_data_dir()
    
    # Use a dict to merge local and remote conversations by ID
    conversations_map = {}

    # 1. Read local files
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
                
    # 2. List remote files (if enabled)
    # Note: This is an expensive operation, in a real production app we'd use a database.
    # For this hackathon project, we'll try to rely on local cache + occasional sync
    # Or optimize by listing files from GitHub API
    if github_storage.enabled:
        try:
            remote_files = github_storage.list_files()
            for filename in remote_files:
                conv_id = filename.replace(".json", "")
                # If not in local, fetch it (lazy loading metadata would be better but requires refactoring)
                # Optimization: For list view, we might need to fetch content if we don't have metadata index
                if conv_id not in conversations_map:
                    # Fetch full content to get metadata (slow but correct)
                    data = github_storage.get_file(filename)
                    if data:
                        conversations_map[conv_id] = data
                        # Cache locally
                        with open(os.path.join(DATA_DIR, filename), 'w') as f:
                            json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error listing remote conversations: {e}")

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


def delete_conversation(conversation_id: str) -> bool:
    """
    Delete a conversation from storage.
    """
    path = get_conversation_path(conversation_id)
    local_deleted = False
    
    if os.path.exists(path):
        os.remove(path)
        local_deleted = True
        
    remote_deleted = False
    if github_storage.enabled:
        remote_deleted = github_storage.delete_file(f"{conversation_id}.json")
        
    return local_deleted or remote_deleted
