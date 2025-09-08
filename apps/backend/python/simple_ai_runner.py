#!/usr/bin/env python3
"""
Simple AI Runner - Simplified version that uses OpenAI API directly
"""

import os
import sys
import argparse
import json
import requests
from pathlib import Path

def call_openai_api(api_key: str, messages: list) -> str:
    """
    Call OpenAI API directly
    
    Args:
        api_key: OpenAI API key
        messages: List of messages for the conversation
        
    Returns:
        AI response as string
    """
    url = "https://api.openai.com/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "gpt-4",
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2000
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        return f"Error calling OpenAI API: {str(e)}"

def run_ai_on_folder(folder_path: str, system_message: str, user_message: str, api_key: str) -> dict:
    """
    Run AI on a folder containing web files
    
    Args:
        folder_path: Path to the folder containing HTML, JS, and CSS files
        system_message: System message to send to AI
        user_message: User message to send to AI
        api_key: OpenAI API key
        
    Returns:
        Dictionary with structured response
    """
    try:
        # Check if folder exists
        folder = Path(folder_path)
        if not folder.exists():
            return {
                "userOutput": f"Folder not found: {folder_path}",
                "fileChanged": False
            }
        
        # Find web files
        web_files = []
        for pattern in ["*.html", "*.js", "*.css"]:
            web_files.extend(folder.glob(pattern))
            web_files.extend(folder.glob(f"**/{pattern}"))
        
        if not web_files:
            return {
                "userOutput": f"No HTML, JS, or CSS files found in {folder_path}",
                "fileChanged": False
            }
        
        # Read file contents
        file_contents = []
        for file_path in web_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    file_contents.append(f"File: {file_path.name}\n{content}\n")
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
        
        # Prepare messages for OpenAI
        files_context = "\n".join(file_contents)
        
        messages = [
            {
                "role": "system",
                "content": f"{system_message}\n\nHere are the current files:\n{files_context}"
            },
            {
                "role": "user", 
                "content": user_message
            }
        ]
        
        # Call OpenAI API
        ai_response = call_openai_api(api_key, messages)
        
        return {
            "userOutput": ai_response,
            "fileChanged": False  # For now, we're not actually modifying files
        }
        
    except Exception as e:
        return {
            "userOutput": f"Error running AI: {str(e)}",
            "fileChanged": False
        }

def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(
        description="Run AI on HTML, JS, and CSS files in a folder",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "folder_path",
        help="Path to the folder containing HTML, JS, and CSS files"
    )
    
    parser.add_argument(
        "system_message",
        help="System message to send to AI"
    )
    
    parser.add_argument(
        "user_message",
        help="User message describing what changes to make"
    )
    
    parser.add_argument(
        "--api-key",
        help="OpenAI API key (or set OPENAI_API_KEY environment variable)"
    )
    
    args = parser.parse_args()
    
    # Set API key if provided
    if args.api_key:
        os.environ["OPENAI_API_KEY"] = args.api_key
    
    # Check if API key is set
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY not set. Please set it as an environment variable or use --api-key")
        return
    
    # Run AI on the folder
    result = run_ai_on_folder(
        args.folder_path,
        args.system_message,
        args.user_message,
        api_key
    )
    
    # Output the result as JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()
