import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getSiteDir, getGitDir } from './general';

// ===== GIT OPERATIONS =====

export async function commitLocalChanges(siteId: string, message: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string }> {
  try {
    const siteDir = getSiteDir(siteId);
    const gitDir = getGitDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(gitDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${gitDir} is not a git repository`);
    }
    
    console.log(`[Local Commit] Committing changes for site ${siteId}: ${message}`);
    
    // Stage and commit changes
    const commands = [
      { cmd: 'git', args: ['add', '.'], cwd: gitDir },
      { cmd: 'git', args: ['commit', '-m', message], cwd: gitDir }
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

export async function startOverFromGitHub(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    console.log(`[Start Over] Starting pull for site: ${siteId}`);
    
    const siteDir = getSiteDir(siteId);
    const gitDir = getGitDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(gitDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${gitDir} is not a git repository`);
    }
    
    console.log(`[Start Over] Site directory: ${siteDir}`);
    
    // First, fetch the latest changes from remote
    const fetchResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['fetch', 'origin'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      // Check if the error is due to repository not existing
      if (fetchResult.error?.includes('Repository not found') || fetchResult.error?.includes('does not appear to be a git repository')) {
        throw new Error(`❌ **GitHub repository not found** - The remote repository doesn't exist yet. Please create the repository on GitHub first or contact support to set it up.`);
      }
      throw new Error(`Failed to fetch from remote: ${fetchResult.error}`);
    }
    
    // First, get the current HEAD commit hash to track what we're resetting from
    const currentHeadResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['rev-parse', 'HEAD'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['reset', '--hard', 'origin/master'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['init'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['remote', 'add', 'origin', 'https://github.com/Bigmakaveli/keara.git'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['add', '.'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['commit', '-m', 'Initial commit - fresh start'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['rev-parse', 'HEAD'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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

export async function undoLastCommit(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    console.log(`[Undo] Starting undo for site: ${siteId}`);
    
    const siteDir = getSiteDir(siteId);
    const gitDir = getGitDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(gitDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${gitDir} is not a git repository`);
    }
    
    console.log(`[Undo] Site directory: ${siteDir}`);
    
    // Check how many commits exist in the repository
    const commitCountResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['rev-list', '--count', 'HEAD'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['log', '--oneline', '-1'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      const process = spawn('git', ['reset', '--hard', 'HEAD~1'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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

export async function redoLastCommit(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    console.log(`[Redo] Starting redo for site: ${siteId}`);
    
    const siteDir = getSiteDir(siteId);
    const gitDir = getGitDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(gitDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${gitDir} is not a git repository`);
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
      const process = spawn('git', ['reset', '--hard', undoneCommitHash.trim()], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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

export async function pushToGitHub(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; commitMessage?: string; error?: string; details?: any }> {
  try {    
    const siteDir = getSiteDir(siteId);
    const gitDir = getGitDir(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(gitDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${gitDir} is not a git repository`);
    }
    
    console.log(`[Publish] Publishing local commits to GitHub for site ${siteId}`);
    
    // First, pull any remote changes and rebase
    console.log(`[Publish] Pulling latest changes from GitHub`);
    const pullResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['pull', 'origin', 'master', '--rebase'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      // Check if the error is due to repository not existing
      if (pullResult.error?.includes('Repository not found') || pullResult.error?.includes('does not appear to be a git repository')) {
        throw new Error(`❌ **GitHub repository not found** - The remote repository doesn't exist yet. Please create the repository on GitHub first or contact support to set it up.`);
      }
      console.log(`[Publish] Pull failed, trying to push anyway: ${pullResult.error}`);
    }
    
    // Now push local commits to GitHub
    console.log(`[Publish] Pushing local commits to GitHub`);
    const pushResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['push', 'origin', 'master'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
      // Check if the error is due to repository not existing
      if (pushResult.error?.includes('Repository not found') || pushResult.error?.includes('does not appear to be a git repository')) {
        throw new Error(`❌ **GitHub repository not found** - The remote repository doesn't exist yet. Please create the repository on GitHub first or contact support to set it up.`);
      }
      throw new Error(`Failed to push to GitHub: ${pushResult.error}`);
    }
    
    // Get the latest commit info
    const commitResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
      const process = spawn('git', ['log', '-1', '--pretty=format:%H|%s'], { cwd: gitDir, stdio: ['pipe', 'pipe', 'pipe'] });
      
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
