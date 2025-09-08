import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import cors from 'cors';
import OpenAI from 'openai';
import { OPENAI_CONFIG } from './config';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_CONFIG.API_KEY,
});

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | any[]; // Support both string and complex content with attachments
  timestamp?: string;
};

// ===== UTILITY FUNCTIONS =====

function getHistoryPath(siteId?: string): string {
  // Default: repo root chat history [[memory:7695357]]
  if (!siteId) return path.resolve(process.cwd(), '../../chat_history.json');
  // Per-site history: <repo_root>/<siteId>/chat_history.json
  return path.resolve(process.cwd(), `../../${siteId}/chat_history.json`);
}

function getSiteDir(siteId: string): string {
  return path.resolve(process.cwd(), `../../${siteId}/site`);
}

function summarizeMessageContentForLog(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p: any) => {
        if (p && p.type === 'text' && typeof p.text === 'string') return p.text;
        if (p && p.type === 'image_url') {
          const url = typeof p.image_url === 'string' ? p.image_url : p?.image_url?.url;
          const len = typeof url === 'string' ? url.length : 0;
          return `[image_url len=${len}]`;
        }
        try { return JSON.stringify(p); } catch { return String(p); }
      })
      .join('\n');
  }
  try { return JSON.stringify(content); } catch { return String(content); }
}

function logOutgoingMessages(messages: any[], siteId?: string) {
  try {
    console.log(`\n===== Outgoing OpenAI messages${siteId ? ` (site ${siteId})` : ''} =====`);
    messages.forEach((m: any, idx: number) => {
      const role = m?.role ?? 'unknown';
      const summary = summarizeMessageContentForLog(m?.content);
      console.log(`-- [${idx}] role=${role}`);
      console.log(summary);
      console.log('----------------------------------------');
    });
    console.log('===== End messages =====\n');
  } catch (e) {
    console.warn('Failed to log outgoing messages', e);
  }
}

// ===== NEW PUBLISH LOGIC =====
// 1. Local changes → Commit locally (for undo/redo)
// 2. Undo/Redo → Navigate through local commits  
// 3. Publish → Push local commits to GitHub
// 4. Start Over → Pull fresh from GitHub

async function commitLocalChanges(siteId: string, message: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string }> {
  try {
    const siteDir = getSiteDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitDir = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitDir).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Site directory ${siteDir} is not a git repository`);
    }
    
    console.log(`[Local Commit] Committing changes for site ${siteId}: ${message}`);
    
    // Stage and commit changes
    const commands = [
      { cmd: 'git', args: ['add', '.'], cwd: siteDir },
      { cmd: 'git', args: ['commit', '-m', message], cwd: siteDir }
    ];
    
    let commitHash = '';
    
    for (const { cmd, args, cwd } of commands) {
      console.log(`[Local Commit] Executing: ${cmd} ${args.join(' ')} in ${cwd}`);
      
      const result = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
        const process = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, output: stdout });
          } else {
            resolve({ success: false, output: stdout, error: stderr });
          }
        });
        
        process.on('error', (error) => {
          resolve({ success: false, output: stdout, error: error.message });
        });
      });
      
      if (!result.success) {
        if (result.error?.includes('nothing to commit') || result.output?.includes('nothing to commit')) {
          console.log(`[Local Commit] No changes to commit for site ${siteId}`);
          return {
            success: true,
            message: 'No changes to commit',
            commitHash: ''
          };
        }
        throw new Error(`Git command failed: ${result.error}`);
      }
      
      // Extract commit hash from commit command output
      if (args[0] === 'commit' && result.success) {
        const commitMatch = result.output.match(/\[master\s+([a-f0-9]+)\]/);
        if (commitMatch) {
          commitHash = commitMatch[1];
        }
      }
    }
    
    console.log(`[Local Commit] Successfully committed changes for site ${siteId}`);
    
    return {
      success: true,
      message: `Successfully committed changes`,
      commitHash
    };
    
  } catch (error) {
    console.error(`[Local Commit] Error committing changes for site ${siteId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ===== AIDER INTEGRATION =====

async function callAIder(siteId: string, userMessage: string): Promise<{ success: boolean; output: string; error?: string; fileChanged: boolean }> {
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
    
    // Get the path to the aider_runner.py script (relative to project root)
    const projectRoot = path.resolve(process.cwd(), '../../');
    const aiderScriptPath = path.resolve(projectRoot, 'apps/backend/python/aider_runner.py');
    
    // Check if the Python script exists
    const scriptExists = await fs.stat(aiderScriptPath).then(() => true).catch(() => false);
    if (!scriptExists) {
      throw new Error(`Aider script not found: ${aiderScriptPath}`);
    }
    
    // Use the virtual environment Python (relative to project root)
    const pythonCommand = path.resolve(projectRoot, 'apps/backend/python/venv/bin/python');
    
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
    
    // Spawn the Python process from the project root directory
    return new Promise((resolve, reject) => {
      const projectRoot = path.resolve(process.cwd(), '../../');
      const pythonProcess = spawn(pythonCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: projectRoot, // Run from project root to avoid Git directory confusion
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

// ===== FILE SYSTEM UTILITIES =====

async function walkDirectory(dir: string, base: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    
    if (entry.isDirectory()) {
      out.push(...await walkDirectory(full, base));
    } else if (entry.isFile()) {
      if (/\.(html?|css|js|ts|json|md|markdown|txt)$/i.test(entry.name)) {
        out.push(rel);
      }
    }
  }
  return out;
}

async function readSiteFiles(siteId: string): Promise<Array<{ path: string, content: string }>> {
  try {
    const siteDir = getSiteDir(siteId);
    const exists = await fs.stat(siteDir).then(() => true).catch(() => false);
    
    if (!exists) return [];
    
    const relFiles = await walkDirectory(siteDir, siteDir);
    const files = await Promise.all(relFiles.map(async rel => {
      const abs = path.join(siteDir, rel);
      const content = await fs.readFile(abs, 'utf8');
      return { path: rel.replace(/\\/g, '/'), content };
    }));
    
    console.log(`[Site Chat] Found ${files.length} site files for context`);
    return files;
  } catch (err) {
    console.error('Error reading site files:', err);
    return [];
  }
}

// ===== CHAT HISTORY MANAGEMENT =====

async function loadHistory(siteId?: string): Promise<ChatMessage[]> {
  try {
    const historyPath = getHistoryPath(siteId);
    const data = await fs.readFile(historyPath, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed as ChatMessage[];
    return [];
  } catch (err: any) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      return [];
    }
    console.error('Failed to read chat history:', err);
    return [];
  }
}

async function saveHistory(history: ChatMessage[], siteId?: string): Promise<void> {
  const historyPath = getHistoryPath(siteId);
  const data = JSON.stringify(history, null, 2);
  await fs.writeFile(historyPath, data, 'utf8');
}

async function appendToHistory(newMessages: ChatMessage[], siteId?: string): Promise<void> {
  if (!newMessages.length) return;
  const timestamped = newMessages.map(m => ({ ...m, timestamp: m.timestamp ?? new Date().toISOString() }));
  const existing = await loadHistory(siteId);
  await saveHistory([...existing, ...timestamped], siteId);
}

async function deleteHistory(siteId?: string): Promise<void> {
  const historyPath = getHistoryPath(siteId);
  try {
    await fs.writeFile(historyPath, '[]', 'utf8');
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      // Nothing to delete; ensure file exists as empty
      await fs.writeFile(historyPath, '[]', 'utf8');
      return;
    }
    throw err;
  }
}





// ===== PUBLISH OPERATIONS =====

async function startOverFromGitHub(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    console.log(`[Start Over] Starting pull for site: ${siteId}`);
    
    const siteDir = getSiteDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitDir = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitDir).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Site directory ${siteDir} is not a git repository`);
    }
    
    console.log(`[Start Over] Site directory: ${siteDir}`);
    
    // First, fetch the latest changes from remote
    const fetchResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['fetch', 'origin'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!fetchResult.success) {
      throw new Error(`Failed to fetch from remote: ${fetchResult.error}`);
    }
    
    // First, get the current HEAD commit hash to track what we're resetting from
    const currentHeadResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['rev-parse', 'HEAD'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    const currentHead = currentHeadResult.success ? currentHeadResult.output.trim() : 'unknown';
    
    // Reset to origin/master to get the latest content
    const resetResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['reset', '--hard', 'origin/master'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!resetResult.success) {
      // Check for common git errors and provide user-friendly messages
      if (resetResult.error && resetResult.error.includes('fatal:')) {
        return {
          success: false,
          error: 'Unable to start over',
          message: 'Something went wrong while trying to update your site. Please check your internet connection and try again.'
        };
      }
      
      return {
        success: false,
        error: 'Unable to start over',
        message: 'Unable to update your site. Please try again.'
      };
    }
    
    // Now completely remove the git history by removing .git and reinitializing
    const removeGitResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const fs = require('fs');
      const path = require('path');
      try {
        const gitDir = path.join(siteDir, '.git');
        if (fs.existsSync(gitDir)) {
          fs.rmSync(gitDir, { recursive: true, force: true });
        }
        resolve({ success: true, output: 'Removed .git directory' });
      } catch (error) {
        resolve({ success: false, output: '', error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    if (!removeGitResult.success) {
      throw new Error(`Failed to remove .git directory: ${removeGitResult.error}`);
    }
    
    // Reinitialize git repository
    const initResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['init'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!initResult.success) {
      throw new Error(`Failed to reinitialize git repository: ${initResult.error}`);
    }
    
    // Add remote origin
    const remoteResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['remote', 'add', 'origin', 'https://github.com/Bigmakaveli/keara.git'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!remoteResult.success) {
      console.warn(`Warning: Failed to add remote origin: ${remoteResult.error}`);
    }
    
    // Add all files to the fresh repository
    const addResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['add', '.'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!addResult.success) {
      throw new Error(`Failed to add files: ${addResult.error}`);
    }
    
    // Create initial commit
    const commitResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['commit', '-m', 'Initial commit - fresh start'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!commitResult.success) {
      throw new Error(`Failed to create initial commit: ${commitResult.error}`);
    }
    
    // Get the current commit hash after reset
    const hashResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['rev-parse', 'HEAD'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!hashResult.success) {
      throw new Error(`Failed to get current commit: ${hashResult.error}`);
    }
    
    const currentCommitHash = hashResult.output.trim();
    
    console.log(`[Start Over] Successfully created fresh repository with commit ${currentCommitHash} for site ${siteId}`);
    
    return {
      success: true,
      message: `✅ Successfully started over! Your website has been refreshed with the latest version. All your recent changes have been cleared.`,
      commitHash: currentCommitHash
    };
    
  } catch (error) {
    console.error(`[Start Over] Error starting over for site ${siteId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: error
    };
  }
}

async function undoLastCommit(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    console.log(`[Undo] Starting undo for site: ${siteId}`);
    
    const siteDir = getSiteDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitDir = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitDir).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Site directory ${siteDir} is not a git repository`);
    }
    
    console.log(`[Undo] Site directory: ${siteDir}`);
    
    // Check how many commits exist in the repository
    const commitCountResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['rev-list', '--count', 'HEAD'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!commitCountResult.success) {
      throw new Error(`Failed to get commit count: ${commitCountResult.error}`);
    }
    
    const commitCount = parseInt(commitCountResult.output.trim());
    
    // If there's only one commit (fresh repository), there's nothing to undo
    if (commitCount <= 1) {
      return {
        success: false,
        error: 'No changes to undo',
        message: 'There are no previous changes to undo. Your site is already at the starting point.'
      };
    }
    
    // Get the last commit hash before undoing
    const lastCommitResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['log', '--oneline', '-1'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!lastCommitResult.success) {
      throw new Error(`Failed to get last commit: ${lastCommitResult.error}`);
    }
    
    const lastCommitHash = lastCommitResult.output.trim().split(' ')[0];
    
    // Store the undone commit hash in a file for redo functionality
    const undoFile = path.join(siteDir, '.undo-commit');
    await fs.writeFile(undoFile, lastCommitHash, 'utf8');
    
    // Reset to the previous commit (undo the last commit)
    const resetResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['reset', '--hard', 'HEAD~1'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!resetResult.success) {
      // Check for common git errors and provide user-friendly messages
      if (resetResult.error && resetResult.error.includes('fatal:')) {
        return {
          success: false,
          error: 'Unable to undo changes',
          message: 'Something went wrong while trying to undo your changes. Please try again or start over.'
        };
      }
      
      return {
        success: false,
        error: 'Unable to undo changes',
        message: 'Unable to undo your changes. Please try again.'
      };
    }
    
    console.log(`[Undo] Successfully undone commit ${lastCommitHash} for site ${siteId}`);
    
    return {
      success: true,
      message: `↩️ **Change undone!** You've reverted to the previous version of your website.`,
      commitHash: lastCommitHash
    };
    
  } catch (error) {
    console.error(`[Undo] Error undoing site ${siteId}:`, error);
    return {
      success: false,
      error: `❌ **Couldn't undo changes** - There was an issue reverting your changes. Please try again.`,
      details: error
    };
  }
}

async function redoLastCommit(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    console.log(`[Redo] Starting redo for site: ${siteId}`);
    
    const siteDir = getSiteDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitDir = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitDir).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Site directory ${siteDir} is not a git repository`);
    }
    
    console.log(`[Redo] Site directory: ${siteDir}`);
    
    // Check if there's an undo file with the commit hash to redo
    const undoFile = path.join(siteDir, '.undo-commit');
    const undoFileExists = await fs.stat(undoFile).then(() => true).catch(() => false);
    
    if (!undoFileExists) {
      return {
        success: false,
        error: 'No changes to restore',
        message: 'There are no previous changes to restore. You haven\'t undone anything yet.'
      };
    }
    
    // Read the undone commit hash from the file
    const undoneCommitHash = await fs.readFile(undoFile, 'utf8');
    
    if (!undoneCommitHash || undoneCommitHash.trim() === '') {
      return {
        success: false,
        error: 'No changes to restore',
        message: 'Unable to find the changes to restore. Please try again.'
      };
    }
    
    // Reset to the undone commit (redo)
    const redoResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['reset', '--hard', undoneCommitHash.trim()], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!redoResult.success) {
      // Check for common git errors and provide user-friendly messages
      if (redoResult.error && redoResult.error.includes('unknown revision or path not in the working tree')) {
        return {
          success: false,
          error: 'Unable to restore changes',
          message: 'The changes you\'re trying to restore are no longer available. This might happen if the site was reset or updated.'
        };
      }
      
      if (redoResult.error && redoResult.error.includes('fatal:')) {
        return {
          success: false,
          error: 'Unable to restore changes',
          message: 'Something went wrong while trying to restore your changes. Please try again or start over.'
        };
      }
      
      return {
        success: false,
        error: 'Unable to restore changes',
        message: 'Unable to restore your changes. Please try again.'
      };
    }
    
    // Remove the undo file since we've successfully redone the commit
    await fs.unlink(undoFile).catch(() => {
      // Ignore error if file doesn't exist
    });
    
    console.log(`[Redo] Successfully redone commit ${undoneCommitHash.trim()} for site ${siteId}`);
    
    return {
      success: true,
      message: `↪️ **Change restored!** You've brought back the previous version of your website.`,
      commitHash: undoneCommitHash.trim()
    };
    
  } catch (error) {
    console.error(`[Redo] Error redoing site ${siteId}:`, error);
    return {
      success: false,
      error: `❌ **Couldn't restore changes** - There was an issue bringing back your changes. Please try again.`,
      details: error
    };
  }
}

async function pushToGitHub(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; commitMessage?: string; error?: string; details?: any }> {
  try {    
    const siteDir = getSiteDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitDir = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitDir).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Site directory ${siteDir} is not a git repository`);
    }
    
    console.log(`[Publish] Publishing local commits to GitHub for site ${siteId}`);
    
    // First, pull any remote changes and rebase
    console.log(`[Publish] Pulling latest changes from GitHub`);
    const pullResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['pull', 'origin', 'master', '--rebase'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!pullResult.success) {
      console.log(`[Publish] Pull failed, trying to push anyway: ${pullResult.error}`);
    }
    
    // Now push local commits to GitHub
    console.log(`[Publish] Pushing local commits to GitHub`);
    const pushResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['push', 'origin', 'master'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    if (!pushResult.success) {
      throw new Error(`Failed to push to GitHub: ${pushResult.error}`);
    }
    
    // Get the latest commit info
    const commitResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['log', '-1', '--pretty=format:%H|%s'], { cwd: siteDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout });
        } else {
          resolve({ success: false, output: stdout, error: stderr });
        }
      });
      
      process.on('error', (error) => {
        resolve({ success: false, output: stdout, error: error.message });
      });
    });
    
    let commitHash = '';
    let commitMessage = '';
    
    if (commitResult.success) {
      const [hash, message] = commitResult.output.split('|');
      commitHash = hash;
      commitMessage = message;
    }
    
    console.log(`[Publish] Successfully published site ${siteId} to GitHub`);
    
    return {
      success: true,
      message: `🎉 **Your website has been published!** Your changes are now live and visible to visitors.`,
      commitHash,
      commitMessage
    };
    
  } catch (error) {
    console.error(`[Publish] Error publishing site ${siteId}:`, error);
    return {
      success: false,
      error: `❌ **Publishing failed** - There was an issue publishing your website. Please try again or contact support if the problem continues.`,
      details: error
    };
  }
}

// ===== FILE APPLICATION =====

async function applyFilesToSite(siteId: string, files: Array<{ path: string, content: string }>) {
  try {
    const siteDir = getSiteDir(siteId);
    console.log(`Applying ${files.length} files to site ${siteId}`);

    // Apply the file changes
    for (const f of files) {
      const rel = String(f?.path || '').replace(/^\/+/, '');
      const content = String(f?.content ?? '');
      if (!rel) continue;
      const abs = path.join(siteDir, rel);
      const dir = path.dirname(abs);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(abs, content, 'utf8');
      console.log(`Applied file: ${rel}`);
    }

    return { 
      ok: true, 
      updated: files.length
    };
  } catch (err) {
    console.error('apply-files error', err);
    throw new Error('Failed to apply files');
  }
}

// ===== CHAT PROCESSING =====

function extractTextFromMessageContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((p: any) => {
        if (p && p.type === 'text' && typeof p.text === 'string') return p.text;
        if (p && p.type === 'image_url') {
          const url = typeof p.image_url === 'string' ? p.image_url : p?.image_url?.url;
          return `[Image: ${url}]`;
        }
        return '';
      })
      .filter(Boolean);
    return parts.join('\n');
  }
  return '';
}

async function processChatCompletion(messages: any[], siteId: string) {
  // Load conversation history for context
  const conversationHistory = await loadHistory(siteId);
  console.log(`[Site Chat] Loaded ${conversationHistory.length} conversation history messages`);
  
  // Create enhanced messages with conversation history and site context
  let enhancedMessages: any[] = [];
  
  // Always get site files for context
  const siteFiles = await readSiteFiles(siteId);
  if (siteFiles.length > 0) {
    const siteContext = {
      role: 'system' as const,
      content: `Files : \n\n${siteFiles.map(f => `File: ${f.path}\nContent:\n${f.content}\n---\n`).join('\n')}\n`
    };
    enhancedMessages.push(siteContext);
    console.log(`[Site Chat] Added site context with ${siteFiles.length} files`);
  }
  
  // Add conversation history (limit to last 10 messages to avoid token limits)
  const recentHistory = conversationHistory.slice(-10);
  if (recentHistory.length > 0) {
    enhancedMessages.push(...recentHistory);
    console.log(`[Site Chat] Added ${recentHistory.length} conversation history messages`);
  }
  
  // Add current user message
  enhancedMessages.push(...messages);
  console.log(`[Site Chat] Total messages sent to AI: ${enhancedMessages.length}`);

  const completion = await openai.chat.completions.create({
    model: OPENAI_CONFIG.DEFAULT_MODEL,
    messages: enhancedMessages,
    verbosity: "low"
  });

  console.log(`[Site Chat] OpenAI SDK Response:`, JSON.stringify(completion, null, 2));
  
  // Extract the assistant message from the completion
  const assistantMessage = completion.choices[0]?.message;
  
  if (assistantMessage && assistantMessage.content) {
    console.log(`[Site Chat] Extracted assistant message:`, JSON.stringify(assistantMessage, null, 2));
    const summarized = extractTextFromMessageContent(assistantMessage.content);
    if (summarized) {
      appendToHistory([{ role: assistantMessage.role || 'assistant', content: String(summarized) }], siteId).catch(err =>
        console.error('Failed to append assistant message to history', err)
      );
    }
  }
  
  return assistantMessage;
}

async function processChatWithAider(messages: any[], siteId: string) {
  // Extract the last user message
  const lastUserMessage = [...messages].reverse().find((m: any) => m?.role === 'user' && m?.content);
  
  if (!lastUserMessage) {
    throw new Error('No user message found');
  }
  
  const userContent = extractTextFromMessageContent(lastUserMessage.content);
  console.log(`[Aider Chat] Processing user message: ${userContent}`);
  
  // Call Aider to make changes to the site
  const aiderResult = await callAIder(siteId, userContent);
  
  // Create assistant response based on Aider result
  let assistantContent: string;
  
  if (aiderResult.success) {
    // If Aider made changes, commit them locally for undo/redo functionality
    if (aiderResult.fileChanged) {
      console.log(`[Aider Chat] Aider made changes, committing locally for undo/redo`);
      const commitResult = await commitLocalChanges(siteId, `AI change: ${userContent}`);
      
      if (commitResult.success) {
        assistantContent = `✅ Your changes have been saved! \n\n You can now use the undo/redo buttons to navigate through your changes, or click publish to make them live on your website.`;
      } else {
        assistantContent = `**Changes applied but couldn't be saved** - Please try again.`;
      }
    } else {
      assistantContent = aiderResult.output;
    }
  } else {
    assistantContent = `❌ **Sorry, I couldn't make those changes**\n\nPlease try rephrasing your request or contact support if the issue continues.`;
  }
  
  // Create assistant message
  const assistantMessage = {
    role: 'assistant' as const,
    content: assistantContent
  };
  
  // Save the assistant response to chat history
  await appendToHistory([assistantMessage], siteId);
  
  return {
    ...assistantMessage,
    reloadIframe: aiderResult.success && aiderResult.fileChanged // Only reload if files were actually changed
  };
}

// ===== EXPRESS APP SETUP =====

const app = express();

// Configure CORS to allow mobile apps to access static files
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'Last-Modified', 'ETag']
}));

// Increase body limit to allow base64 images in messages
app.use(express.json({ limit: '15mb' }));
const port = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve the example_page folder statically (legacy example)
const examplePageDir = path.resolve(process.cwd(), '../../example_page');
app.use('/sites/example', (req, res, next) => {
  // Add CORS headers for static files
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Last-Modified, ETag');
  next();
}, express.static(examplePageDir, { index: 'index.html' }));

// Dynamically serve per-site static content from <repo_root>/<siteId>/site
app.use('/sites/:siteId', (req, res, next) => {
  const siteId = String(req.params.siteId || '');
  if (!siteId || siteId === 'example') return next();
  
  // Add CORS headers for static files
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Last-Modified, ETag');
  
  const siteDir = getSiteDir(siteId);
  return express.static(siteDir, { index: 'index.html' })(req, res, next);
});

// ===== API ROUTES =====

// Return text-based files for a site (used to send source files to AI)
app.get('/api/:siteId/site-files', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    
    const files = await readSiteFiles(siteId);
    return res.json({ files });
  } catch (err) {
    console.error('site-files error', err);
    return res.status(500).json({ error: 'Failed to read site files' });
  }
});

// Apply edited files to a site
app.post('/api/:siteId/apply-files', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) return res.status(400).json({ error: 'files[] required' });

    const result = await applyFilesToSite(siteId, files);
    return res.json(result);
  } catch (err) {
    console.error('apply-files error', err);
    return res.status(500).json({ error: 'Failed to apply files' });
  }
});

// Simple chat proxy to OpenAI
app.get('/api/chat/history', async (_req, res) => {
  try {
    const history = await loadHistory();
    res.json({ history });
  } catch (err) {
    console.error('History route error', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

app.delete('/api/chat/history', async (_req, res) => {
  try {
    await deleteHistory();
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete history error', err);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});

// Per-site history endpoint
app.get('/api/:siteId/chat/history', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    const history = await loadHistory(siteId);
    res.json({ history });
  } catch (err) {
    console.error('History route error', err);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

app.delete('/api/:siteId/chat/history', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    await deleteHistory(siteId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete site history error', err);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});


// Per-site chat endpoint using OpenAI SDK
app.post('/api/:siteId/chat', async (req, res) => {
  try {
    if (!OPENAI_CONFIG.API_KEY || OPENAI_CONFIG.API_KEY.startsWith('sk-REPLACE')) {
      return res.status(400).json({ error: 'OPENAI_API_KEY missing. Edit apps/backend/src/config.ts and set OPENAI_API_KEY.' });
    }

    const siteId = String(req.params.siteId || '');
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const lastUser = [...messages].reverse().find((m: any) => m?.role === 'user' && m?.content);
    if (lastUser) {
      // Save the original message structure to preserve attachments
      appendToHistory([{ role: 'user', content: lastUser.content }], siteId).catch(err =>
        console.error('Failed to append user message to history', err)
      );
    }

    // Log outgoing messages
    logOutgoingMessages(messages, siteId);

    // Use Aider for making changes to the site
    console.log(`[Site Chat] Using Aider for site modifications`);
    
    try {
      const result = await processChatWithAider(messages, siteId);
      return res.json({ 
        message: result,
        reloadIframe: result.reloadIframe 
      });
    } catch (err) {
      console.error('Aider Chat error:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      
      // Provide more specific error messages
      let errorMessage = 'The AI service is temporarily unavailable. Please try again shortly.';
      if (err && typeof err === 'object' && 'message' in err) {
        const errMsg = String(err.message);
        if (errMsg.includes('No user message found')) {
          errorMessage = 'No user message found in the request.';
        } else if (errMsg.includes('Site directory')) {
          errorMessage = 'Site directory not found. Please check the site ID.';
        } else if (errMsg.includes('Aider script')) {
          errorMessage = 'Aider script not found. Please check the installation.';
        }
      }
      
      const assistantMessage = { role: 'assistant', content: errorMessage };
      return res.json({ message: assistantMessage, error: 'Aider Chat error', details: err });
    }
  } catch (err) {
    console.error('Chat route error:', err);
    const assistantMessage = { role: 'assistant', content: 'The AI service is temporarily unavailable. Please try again shortly.' };
    return res.json({ message: assistantMessage, error: 'Internal server error' });
  }
});



// Undo endpoint
app.post('/api/:siteId/undo', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    if (!siteId) {
      return res.status(400).json({ 
        success: false,
        error: 'siteId is required' 
      });
    }

    console.log(`[Undo] Starting undo for site: ${siteId}`);
    
    const result = await undoLastCommit(siteId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        commitHash: result.commitHash,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
    
  } catch (err) {
    console.error('[Undo] Error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to undo changes',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

// Start Over endpoint
app.post('/api/:siteId/start-over', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    if (!siteId) {
      return res.status(400).json({ 
        success: false,
        error: 'siteId is required' 
      });
    }

    console.log(`[Start Over] Starting pull for site: ${siteId}`);
    
    const result = await startOverFromGitHub(siteId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        commitHash: result.commitHash,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
    
  } catch (err) {
    console.error('[Start Over] Error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to start over',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

// Redo endpoint
app.post('/api/:siteId/redo', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    if (!siteId) {
      return res.status(400).json({ 
        success: false,
        error: 'siteId is required' 
      });
    }

    console.log(`[Redo] Starting redo for site: ${siteId}`);
    
    const result = await redoLastCommit(siteId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        commitHash: result.commitHash,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
    
  } catch (err) {
    console.error('[Redo] Error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to redo changes',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

// Publish endpoint (GitHub push)
app.post('/api/:siteId/github/push', async (req, res) => {
  try {
    const siteId = String(req.params.siteId || '');
    if (!siteId) {
      return res.status(400).json({ 
        success: false,
        error: 'siteId is required' 
      });
    }

    console.log(`[Publish] Starting publish for site: ${siteId}`);
    
    const result = await pushToGitHub(siteId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        commitHash: result.commitHash,
        commitMessage: result.commitMessage,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
    
  } catch (err) {
    console.error('[Publish] Error:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to publish changes',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

// Test endpoint for Aider integration
app.post('/api/test-aider', async (req, res) => {
  try {
    const { siteId, userMessage } = req.body;
    
    if (!siteId || !userMessage) {
      return res.status(400).json({ 
        error: 'Both siteId and userMessage are required' 
      });
    }
    
    console.log(`[Test Aider] Testing with siteId: ${siteId}, message: ${userMessage}`);
    
    const result = await callAIder(siteId, userMessage);
    
    return res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('[Test Aider] Error:', err);
    return res.status(500).json({ 
      error: 'Failed to test Aider',
      details: err instanceof Error ? err.message : String(err)
    });
  }
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});


