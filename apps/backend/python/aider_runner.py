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
            "codeDiff": str     # Raw Aider output containing changes made
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
                "codeDiff": ""
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
            ]
            
            # Add all web files to the context
            for file_path in web_files:
                # Convert to relative path from the target folder
                relative_path = os.path.relpath(file_path, target_folder)
                argv.extend(["--file", relative_path])
            
            # Capture Aider output by redirecting stdout
            import io
            import contextlib
            
            output_capture = io.StringIO()
            with contextlib.redirect_stdout(output_capture):
                # Run aider
                aider_main(argv)
            
            # Get the captured output
            aider_output = output_capture.getvalue()
            
            # Return the raw Aider output as codeDiff
            user_output = "Changes have been applied to your website."
            
            return {
                "userOutput": user_output,
                "codeDiff": aider_output
            }
            
        finally:
            # Restore original working directory
            os.chdir(original_cwd)
            
    except Exception as e:
        return {
            "userOutput": f"Error running Aider: {str(e)}",
            "codeDiff": ""
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
