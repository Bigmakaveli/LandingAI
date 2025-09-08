#!/usr/bin/env python3
"""
Example usage of the Aider Runner script
"""

import os
import subprocess
import sys
from pathlib import Path

def run_aider_example():
    """Example of how to use the aider_runner.py script"""
    
    # Example 1: Basic usage
    print("=== Example 1: Basic Usage ===")
    print("Command:")
    print('python aider_runner.py /path/to/website "You are a web developer" "Add a contact form"')
    print()
    
    # Example 2: With API key
    print("=== Example 2: With API Key ===")
    print("Command:")
    print('python aider_runner.py /path/to/website "You are a UI expert" "Make the design more modern" --api-key "your-api-key"')
    print()
    
    # Example 3: Using environment variable
    print("=== Example 3: Using Environment Variable ===")
    print("First set your API key:")
    print('export OPENAI_API_KEY="your-api-key-here"')
    print("Then run:")
    print('python aider_runner.py /path/to/website "You are a web developer" "Add a navigation menu"')
    print()

def test_script_functionality():
    """Test the script functionality without running Aider"""
    
    print("=== Testing Script Functionality ===")
    
    # Test with the test_website folder
    test_folder = "test_website"
    
    if not os.path.exists(test_folder):
        print(f"Test folder {test_folder} not found. Creating it...")
        # Create test files
        os.makedirs(test_folder, exist_ok=True)
        
        # Create a simple HTML file
        html_content = """<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Test Website</h1>
    <script src="script.js"></script>
</body>
</html>"""
        
        with open(f"{test_folder}/index.html", "w") as f:
            f.write(html_content)
        
        # Create a simple CSS file
        css_content = """body { font-family: Arial; }"""
        with open(f"{test_folder}/style.css", "w") as f:
            f.write(css_content)
        
        # Create a simple JS file
        js_content = """console.log('Hello World');"""
        with open(f"{test_folder}/script.js", "w") as f:
            f.write(js_content)
    
    # Test the script with help
    try:
        result = subprocess.run([
            sys.executable, "aider_runner.py", "--help"
        ], capture_output=True, text=True, cwd=os.getcwd())
        
        if result.returncode == 0:
            print("✅ Script help command works correctly")
        else:
            print("❌ Script help command failed")
            print(result.stderr)
            
    except Exception as e:
        print(f"❌ Error testing script: {e}")

def show_usage_examples():
    """Show practical usage examples"""
    
    print("=== Practical Usage Examples ===")
    
    examples = [
        {
            "description": "Add a contact form",
            "command": 'python aider_runner.py ./my-website "You are a web developer" "Add a contact form with name, email, and message fields"'
        },
        {
            "description": "Improve the design",
            "command": 'python aider_runner.py ./my-website "You are a UI/UX expert" "Make the website more modern with better colors, spacing, and typography"'
        },
        {
            "description": "Add JavaScript functionality",
            "command": 'python aider_runner.py ./my-website "You are a JavaScript developer" "Add smooth scrolling navigation and a dark mode toggle"'
        },
        {
            "description": "Make it responsive",
            "command": 'python aider_runner.py ./my-website "You are a responsive web developer" "Make the website mobile-friendly with responsive design"'
        },
        {
            "description": "Add animations",
            "command": 'python aider_runner.py ./my-website "You are a frontend developer" "Add CSS animations and transitions to make the site more engaging"'
        }
    ]
    
    for i, example in enumerate(examples, 1):
        print(f"{i}. {example['description']}")
        print(f"   {example['command']}")
        print()

if __name__ == "__main__":
    print("Aider Runner - Usage Examples")
    print("=" * 50)
    
    run_aider_example()
    test_script_functionality()
    show_usage_examples()
    
    print("=" * 50)
    print("To use the script:")
    print("1. Set your OpenAI API key: export OPENAI_API_KEY='your-key'")
    print("2. Run: python aider_runner.py <folder> <system_message> <user_message>")
    print("3. The script will find all HTML, JS, and CSS files and apply changes using GPT-4o")
