import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getSiteDir } from './general';
import { OPENAI_CONFIG } from '../config';

// ===== AIDER INTEGRATION =====

export async function callAIder(siteId: string, userMessage: string): Promise<{ success: boolean; output: string; error?: string; fileChanged: boolean }> {
  try {
    console.log(`[Aider] Starting Aider execution for site: ${siteId}`);
    console.log(`[Aider] User message: ${userMessage}`);
    
    // Get the site directory path
    const siteDir = getSiteDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Get the path to the aider_runner.py script
    const aiderScriptPath = path.resolve(process.cwd(), 'python/aider_runner.py');
    
    // Check if the Python script exists
    const scriptExists = await fs.stat(aiderScriptPath).then(() => true).catch(() => false);
    if (!scriptExists) {
      throw new Error(`Aider script not found: ${aiderScriptPath}`);
    }
    
    // Use virtual environment Python
    const pythonCommand = path.resolve(process.cwd(), 'python/venv/bin/python');
    
    // Check if Python is available
    try {
      await new Promise((resolve, reject) => {
        const checkProcess = spawn(pythonCommand, ['--version'], { stdio: 'pipe' });
        checkProcess.on('close', (code) => {
          if (code === 0) resolve(true);
          else reject(new Error(`Python not found or not working`));
        });
        checkProcess.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Python not available: ${error}`);
    }
    
    // Check if OPENAI_API_KEY is available
    if (!OPENAI_CONFIG.API_KEY || OPENAI_CONFIG.API_KEY.startsWith('sk-REPLACE')) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    console.log(`[Aider] Site directory: ${siteDir}`);
    console.log(`[Aider] Script path: ${aiderScriptPath}`);
    console.log(`[Aider] Python interpreter: ${pythonCommand}`);
    
    // Prepare the command arguments with formatted message
    const systemMessage = `
    You are an assistance for a non-technical user who is using an AI website builder to create their website.
    - If the user is requesting a site change:
      - do the change.
      - return a very short summary of what you did in a very simple language with no technical details.
    - Otherwise:
      - return the answer in a single line.
    `;
    
    const args = [
      aiderScriptPath,
      siteDir,
      systemMessage,
      userMessage,
      '--api-key',
      OPENAI_CONFIG.API_KEY
    ];
    
    console.log(`[Aider] Executing: ${pythonCommand} ${args.join(' ')}`);
    
    // Spawn the Python process using system Python
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(pythonCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          OPENAI_API_KEY: OPENAI_CONFIG.API_KEY
        }
      });
      
      let stdout = '';
      let stderr = '';
      
      // Collect stdout
      pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[Aider] stdout: ${output.trim()}`);
      });
      
      // Collect stderr
      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(`[Aider] stderr: ${output.trim()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        console.log(`[Aider] Process exited with code: ${code}`);
        
        if (code === 0) {
          try {
            // Try to parse the JSON response from Python
            const jsonResponse = JSON.parse(stdout.trim());
            console.log(`[Aider] Parsed JSON response:`, jsonResponse);
            
            resolve({
              success: true,
              output: jsonResponse.userOutput || stdout.trim(),
              fileChanged: jsonResponse.fileChanged || false,
              error: stderr.trim() || undefined
            });
          } catch (parseError) {
            console.log(`[Aider] Failed to parse JSON, using raw output`);
            resolve({
              success: true,
              output: stdout.trim(),
              fileChanged: false,
              error: stderr.trim() || undefined
            });
          }
        } else {
          resolve({
            success: false,
            output: stdout.trim(),
            fileChanged: false,
            error: stderr.trim() || `Process exited with code ${code}`
          });
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (error) => {
        console.error(`[Aider] Process error:`, error);
        reject({
          success: false,
          output: stdout.trim(),
          error: error.message,
          fileChanged: false
        });
      });
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          output: stdout.trim(),
          error: 'Process timed out after 5 minutes',
          fileChanged: false
        });
      }, 5 * 60 * 1000); // 5 minutes timeout
    });
    
  } catch (error) {
    console.error(`[Aider] Error calling Aider:`, error);
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
      fileChanged: false
    };
  }
}
