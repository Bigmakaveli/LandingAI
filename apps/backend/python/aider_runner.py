#!/usr/bin/env python3
"""
Aider Runner - Script to run Aider on HTML, JS, and CSS files
"""

import os
import sys
import argparse
import glob
import json
import re
import time
from pathlib import Path
from typing import List

# Import aider
try:
    from aider.main import main as aider_main
except ImportError as e:
    print(f"Error importing aider: {e}")
    print("Make sure aider-chat is installed: pip install aider-chat")
    sys.exit(1)


def find_web_files(folder_path: str) -> List[str]:
    """
    Find all HTML, JS, and CSS files in the given folder
    
    Args:
        folder_path: Path to the folder to search
        
    Returns:
        List of file paths found
    """
    folder = Path(folder_path)
    if not folder.exists():
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    
    # Find all HTML, JS, and CSS files
    patterns = ["*.html", "*.js", "*.css"]
    files = []
    
    for pattern in patterns:
        files.extend(glob.glob(str(folder / pattern)))
        # Also search in subdirectories
        files.extend(glob.glob(str(folder / "**" / pattern), recursive=True))
    
    return files


def get_git_head_commit(folder_path: str) -> str:
    """
    Get the current HEAD commit hash
    
    Args:
        folder_path: Path to the folder containing the Git repository
        
    Returns:
        Commit hash string, or empty string if not a Git repo
    """
    import subprocess
    import os
    
    try:
        # Check if we're in a Git repository
        if not os.path.exists(os.path.join(folder_path, '.git')):
            return ""
        
        # Get the current HEAD commit hash
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=folder_path,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return ""
            
    except Exception as e:
        print(f"Error getting Git HEAD commit: {e}")
        return ""


def analyze_aider_output(folder_path: str, before_commit: str) -> bool:
    """
    Analyze Git commits to determine if files were actually changed
    
    Args:
        folder_path: Path to the folder containing the Git repository
        before_commit: Commit hash before Aider ran
        
    Returns:
        True if files were modified, False otherwise
    """
    import subprocess
    import os
    
    try:
        # Check if we're in a Git repository
        if not os.path.exists(os.path.join(folder_path, '.git')):
            return False
        
        # Get the current HEAD commit hash after Aider ran
        after_commit = get_git_head_commit(folder_path)
        
        if not after_commit:
            return False
        
        # If the commit hash changed, files were modified
        return before_commit != after_commit
        
    except Exception as e:
        print(f"Error analyzing Git commits: {e}")
        return False


def create_user_output(aider_output: str, file_changed: bool) -> str:
    """
    Create a user-friendly output message based on Aider's response
    
    Args:
        aider_output: The raw output from Aider
        file_changed: Whether files were actually modified
        
    Returns:
        User-friendly message
    """
    if file_changed:
        return aider_output
        # Extract the key information from Aider output
        lines = aider_output.split('\n')
        
        # Look for the main response (usually after the "=" separator)
        response_lines = []
        in_response = False
        
        for line in lines:
            if '=' * 20 in line:  # Separator line
                in_response = True
                continue
            if in_response and line.strip():
                # Stop at certain markers
                if any(marker in line for marker in ['Tokens:', 'Commit', 'Applied edit']):
                    break
                response_lines.append(line.strip())
        
        # Clean up the response
        response = '\n'.join(response_lines).strip()
        
        if response:
            return f"✅ Changes applied successfully!\n\n{response}\n\nYour requested changes have been applied to the site."
        else:
            return "✅ Changes applied successfully! Your requested changes have been applied to the site."
    else:
        # Extract the actual LLM response for questions/answers
        lines = aider_output.split('\n')
        
        # Look for the main response (after file additions and before tokens)
        response_lines = []
        in_response = False
        
        for line in lines:
            # Start capturing after we see "Added ... to the chat" lines
            if line.strip().startswith('Added ') and line.strip().endswith(' to the chat.'):
                continue
            elif line.strip() and not line.startswith('─') and not line.startswith('Aider v') and not line.startswith('Main model:') and not line.startswith('Weak model:') and not line.startswith('Git repo:') and not line.startswith('Repo-map:'):
                # Stop at tokens line
                if line.strip().startswith('Tokens:'):
                    break
                response_lines.append(line.strip())
        
        # Clean up the response
        response = '\n'.join(response_lines).strip()
        
        if response:
            return response  # Return the actual LLM response without prefix
        else:
            return "Hello! How can I help you with your landing page today?"


def run_aider_on_folder(folder_path: str, system_message: str, user_message: str) -> dict:
    """
    Run Aider on a folder containing web files
    
    Args:
        folder_path: Path to the folder containing HTML, JS, and CSS files
        system_message: System message to send to Aider
        user_message: User message to send to Aider
        
    Returns:
        Dictionary with structured response:
        {
            "userOutput": str,  # Summary of what Aider did or answered
            "fileChanged": bool  # Whether files were actually modified
        }
    """
    try:
        # Check if there's a 'site' subdirectory (for some site structures)
        site_path = os.path.join(folder_path, 'site')
        if os.path.exists(site_path) and os.path.isdir(site_path):
            # Use the site subdirectory for web files
            target_folder = site_path
        else:
            # Use the main folder for web files (like keaara structure)
            target_folder = folder_path
        
        # Find all web files in the target folder
        web_files = find_web_files(target_folder)
        
        if not web_files:
            return {
                "userOutput": f"No HTML, JS, or CSS files found in {target_folder}",
                "fileChanged": False
            }
        
        # Change to the target folder directory
        original_cwd = os.getcwd()
        os.chdir(target_folder)
        
        try:
            # Build the complete message combining system and user messages
            full_message = f"System: {system_message}\n\nUser: {user_message}"
            
            # Build arguments for aider
            argv = [
                "--model", "gpt-5",
                "--message", full_message,
                "--yes",
                "--no-pretty",
                "--no-detect-urls",
                "--no-git"
            ]
            
            # Add all web files to the context
            for file_path in web_files:
                # Convert to relative path from the target folder
                relative_path = os.path.relpath(file_path, target_folder)
                argv.extend(["--file", relative_path])
            
            # Get the commit hash before running Aider (use parent directory for git operations)
            git_folder = folder_path  # Use the original folder for git operations
            before_commit = get_git_head_commit(git_folder)
            
            # Capture Aider output by redirecting stdout
            import io
            import contextlib
            
            output_capture = io.StringIO()
            with contextlib.redirect_stdout(output_capture):
                # Run aider
                aider_main(argv)
            
            # Get the captured output
            aider_output = output_capture.getvalue()
            
            # Analyze Git commits to determine if files were changed
            file_changed = analyze_aider_output(git_folder, before_commit)
            
            # Create user-friendly output
            user_output = create_user_output(aider_output, file_changed)
            
            return {
                "userOutput": user_output,
                "fileChanged": file_changed
            }
            
        finally:
            # Restore original working directory
            os.chdir(original_cwd)
            
    except Exception as e:
        return {
            "userOutput": f"Error running Aider: {str(e)}",
            "fileChanged": False
        }


def main():
    """Main function to handle command line arguments"""
    parser = argparse.ArgumentParser(
        description="Run Aider on HTML, JS, and CSS files in a folder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python aider_runner.py /path/to/website "You are a web developer" "Add a contact form"
  python aider_runner.py ./my-project "You are a UI expert" "Make the design more modern"
        """
    )
    
    parser.add_argument(
        "folder_path",
        help="Path to the folder containing HTML, JS, and CSS files"
    )
    
    parser.add_argument(
        "system_message",
        help="System message to send to Aider (e.g., 'You are a web developer')"
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
    if not os.getenv("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY not set. Please set it as an environment variable or use --api-key")
        print("You can set it with: export OPENAI_API_KEY='your-api-key-here'")
        return
    
    # Run aider on the folder
    result = run_aider_on_folder(
        args.folder_path,
        args.system_message,
        args.user_message
    )
    
    # Output the result as JSON
    print(json.dumps(result))


if __name__ == "__main__":
    main()
