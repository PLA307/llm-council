"""
GitHub Storage Adapter for LLM Council.
Allows persisting conversations to a private GitHub repository, overcoming Render's ephemeral filesystem.
"""

import os
import json
import base64
import requests
import time
from typing import Dict, Any, Optional, List
from datetime import datetime

# Configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")  # Format: "username/repo"
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main")
GITHUB_API_BASE = "https://api.github.com"
STORAGE_PATH = "data/conversations"

class GitHubStorage:
    def __init__(self):
        # 添加环境变量开关，默认关闭GitHub同步
        ENABLE_GITHUB_SYNC = os.getenv("ENABLE_GITHUB_SYNC", "false").lower() == "true"
        
        if not ENABLE_GITHUB_SYNC or not GITHUB_TOKEN or not GITHUB_REPO:
            print("GitHub Storage disabled (either ENABLE_GITHUB_SYNC=false, or GITHUB_TOKEN/GITHUB_REPO not set).")
            self.enabled = False
        else:
            self.enabled = True
            self.headers = {
                "Authorization": f"token {GITHUB_TOKEN}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "LLM-Council-Backend"
            }
            print(f"GitHub Storage enabled for repo: {GITHUB_REPO}")

    def _get_file_url(self, filename: str) -> str:
        return f"{GITHUB_API_BASE}/repos/{GITHUB_REPO}/contents/{STORAGE_PATH}/{filename}"

    def get_file(self, filename: str, retries: int = 3) -> Optional[Dict[str, Any]]:
        if not self.enabled:
            return None
            
        url = self._get_file_url(filename)
        for attempt in range(retries):
            try:
                response = requests.get(url, headers=self.headers, params={"ref": GITHUB_BRANCH}, timeout=10)
                if response.status_code == 200:
                    content = response.json()
                    file_content = base64.b64decode(content["content"]).decode("utf-8")
                    return json.loads(file_content)
                elif response.status_code == 404:
                    return None
                elif response.status_code == 403: # Rate limit
                    reset_time = int(response.headers.get("X-RateLimit-Reset", 0))
                    sleep_time = max(1, reset_time - time.time())
                    print(f"Rate limited by GitHub. Retrying in {sleep_time}s...")
                    time.sleep(min(sleep_time, 5)) # Don't wait too long
                else:
                    print(f"Error getting file {filename} from GitHub (Attempt {attempt+1}): {response.status_code} {response.text}")
            except Exception as e:
                print(f"Exception getting file {filename} from GitHub (Attempt {attempt+1}): {e}")
            
            # Exponential backoff
            time.sleep(0.5 * (2 ** attempt))
            
        return None

    def save_file(self, filename: str, content: Dict[str, Any], message: str = "Update conversation", retries: int = 3) -> bool:
        if not self.enabled:
            return False
            
        url = self._get_file_url(filename)
        for attempt in range(retries):
            try:
                # Check if file exists to get SHA (Optimized: only if needed)
                sha = None
                get_response = requests.get(url, headers=self.headers, params={"ref": GITHUB_BRANCH}, timeout=10)
                if get_response.status_code == 200:
                    sha = get_response.json()["sha"]

                # Prepare content
                json_content = json.dumps(content, indent=2)
                b64_content = base64.b64encode(json_content.encode("utf-8")).decode("utf-8")

                data = {
                    "message": message,
                    "content": b64_content,
                    "branch": GITHUB_BRANCH
                }
                if sha:
                    data["sha"] = sha

                put_response = requests.put(url, headers=self.headers, json=data, timeout=10)
                if put_response.status_code in [200, 201]:
                    return True
                elif put_response.status_code == 409: # Conflict
                    print(f"Conflict saving file {filename}. Retrying with latest SHA...")
                    continue # Retry loop will re-fetch SHA
                else:
                    print(f"Error saving file {filename} to GitHub: {put_response.status_code} {put_response.text}")
            except Exception as e:
                print(f"Exception saving file {filename} to GitHub: {e}")
                
            time.sleep(0.5 * (2 ** attempt))
            
        return False

    def list_files(self) -> List[str]:
        if not self.enabled:
            return []
            
        url = f"{GITHUB_API_BASE}/repos/{GITHUB_REPO}/contents/{STORAGE_PATH}"
        try:
            response = requests.get(url, headers=self.headers, params={"ref": GITHUB_BRANCH}, timeout=10)
            if response.status_code == 200:
                files = response.json()
                return [f["name"] for f in files if f["name"].endswith(".json")]
            elif response.status_code == 404:
                return []
            else:
                print(f"Error listing files from GitHub: {response.status_code} {response.text}")
                return []
        except Exception as e:
            print(f"Exception listing files from GitHub: {e}")
            return []

    def delete_file(self, filename: str, message: str = "Delete conversation") -> bool:
        if not self.enabled:
            return False
            
        url = self._get_file_url(filename)
        try:
            # Get SHA first
            get_response = requests.get(url, headers=self.headers, params={"ref": GITHUB_BRANCH}, timeout=10)
            if get_response.status_code != 200:
                return False
            
            sha = get_response.json()["sha"]
            
            data = {
                "message": message,
                "sha": sha,
                "branch": GITHUB_BRANCH
            }
            
            delete_response = requests.delete(url, headers=self.headers, json=data, timeout=10)
            return delete_response.status_code == 200
        except Exception as e:
            print(f"Exception deleting file {filename} from GitHub: {e}")
            return False
