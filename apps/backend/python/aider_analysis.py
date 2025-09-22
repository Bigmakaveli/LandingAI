#!/usr/bin/env python3
"""
Aider Analysis Tool
Tests different AI models with the aider tool and generates comparison reports.
"""

import os
import sys
import json
import subprocess
import time
from datetime import datetime
from pathlib import Path

class AiderAnalysis:
    def __init__(self):
        self.models = [
            "gpt-4o",
            "gpt-4o-mini", 
            "gpt-5"
        ]
        self.test_command = "echo 'Create a simple HTML page with a header and paragraph'"
        self.results = {}
        self.output_dir = Path("aider_test_run_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
        
    def setup_test_environment(self):
        """Setup the test environment"""
        try:
            # Create output directory
            self.output_dir.mkdir(exist_ok=True)
            
            # Create test site directory
            test_site_dir = self.output_dir / "test_site"
            test_site_dir.mkdir(exist_ok=True)
            
            # Create a simple test file
            test_file = test_site_dir / "index.html"
            with open(test_file, 'w') as f:
                f.write("""<!DOCTYPE html>
<html>
<head>
    <title>Test Site</title>
</head>
<body>
    <h1>Test Site</h1>
    <p>This is a test site for aider analysis.</p>
</body>
</html>""")
            
            print(f"✓ Test environment created at {self.output_dir}")
            return True
            
        except Exception as e:
            print(f"✗ Error setting up test environment: {e}")
            return False
    
    def run_aider_test(self, model):
        """Run aider test with specific model"""
        print(f"\n🧪 Testing model: {model}")
        
        try:
            # Set environment variables
            env = os.environ.copy()
            env["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
            
            # Run aider command
            cmd = [
                "aider",
                "--model", model,
                "--temperature", "0.1",
                "--no-git",
                str(self.output_dir / "test_site")
            ]
            
            # Start aider process
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                cwd=str(self.output_dir)
            )
            
            # Send test command
            stdout, stderr = process.communicate(input=self.test_command + "\n", timeout=60)
            
            # Check if process completed successfully
            if process.returncode == 0:
                print(f"✓ {model} test completed successfully")
                return {
                    "success": True,
                    "stdout": stdout,
                    "stderr": stderr,
                    "return_code": process.returncode
                }
            else:
                print(f"✗ {model} test failed with return code {process.returncode}")
                return {
                    "success": False,
                    "stdout": stdout,
                    "stderr": stderr,
                    "return_code": process.returncode
                }
                
        except subprocess.TimeoutExpired:
            print(f"✗ {model} test timed out")
            process.kill()
            return {
                "success": False,
                "stdout": "",
                "stderr": "Test timed out",
                "return_code": -1
            }
        except Exception as e:
            print(f"✗ {model} test error: {e}")
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "return_code": -1
            }
    
    def generate_report(self):
        """Generate analysis report"""
        report = {
            "timestamp": datetime.now().isoformat(),
            "models_tested": list(self.results.keys()),
            "test_command": self.test_command,
            "results": self.results,
            "summary": {
                "total_models": len(self.models),
                "successful_tests": sum(1 for r in self.results.values() if r["success"]),
                "failed_tests": sum(1 for r in self.results.values() if not r["success"])
            }
        }
        
        # Save detailed report
        report_file = self.output_dir / "summary.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        # Generate HTML report
        self.generate_html_report(report)
        
        return report
    
    def generate_html_report(self, report):
        """Generate HTML report for each model"""
        for model, result in self.results.items():
            html_file = self.output_dir / f"test_file_{model.replace('-', '_')}.html"
            
            html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>Aider Test Results - {model}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .success {{ color: green; }}
        .error {{ color: red; }}
        .output {{ background: #f5f5f5; padding: 10px; margin: 10px 0; }}
        pre {{ white-space: pre-wrap; }}
    </style>
</head>
<body>
    <h1>Aider Test Results - {model}</h1>
    <p><strong>Status:</strong> <span class="{'success' if result['success'] else 'error'}">{'SUCCESS' if result['success'] else 'FAILED'}</span></p>
    <p><strong>Return Code:</strong> {result['return_code']}</p>
    
    <h2>Standard Output</h2>
    <div class="output">
        <pre>{result['stdout']}</pre>
    </div>
    
    <h2>Standard Error</h2>
    <div class="output">
        <pre>{result['stderr']}</pre>
    </div>
    
    <h2>Test Command</h2>
    <div class="output">
        <pre>{self.test_command}</pre>
    </div>
</body>
</html>"""
            
            with open(html_file, 'w') as f:
                f.write(html_content)
    
    def run_analysis(self):
        """Run the complete analysis"""
        print("🚀 Starting Aider Analysis")
        print("=" * 50)
        
        # Setup test environment
        if not self.setup_test_environment():
            return
        
        # Check API key
        if not os.getenv("OPENAI_API_KEY"):
            print("✗ Error: OPENAI_API_KEY environment variable not set!")
            print("Please set it with: export OPENAI_API_KEY='your-api-key-here'")
            return
        
        print(f"✓ API key found")
        print(f"✓ Testing {len(self.models)} models: {', '.join(self.models)}")
        print(f"✓ Test command: '{self.test_command}'")
        
        # Test each model
        for model in self.models:
            result = self.run_aider_test(model)
            self.results[model] = result
            time.sleep(2)  # Brief pause between tests
        
        # Generate report
        print("\n📊 Generating report...")
        report = self.generate_report()
        
        # Print summary
        print("\n" + "=" * 50)
        print("📈 ANALYSIS SUMMARY")
        print("=" * 50)
        print(f"Total models tested: {report['summary']['total_models']}")
        print(f"Successful tests: {report['summary']['successful_tests']}")
        print(f"Failed tests: {report['summary']['failed_tests']}")
        print(f"Report saved to: {self.output_dir}")
        
        # Print individual results
        for model, result in self.results.items():
            status = "✓" if result['success'] else "✗"
            print(f"{status} {model}: {'SUCCESS' if result['success'] else 'FAILED'}")

if __name__ == "__main__":
    analyzer = AiderAnalysis()
    analyzer.run_analysis()