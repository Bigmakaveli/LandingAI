import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getSiteDir, getSiteDirAsync } from './general';

// ===== LOGGING UTILITIES =====
const log = {
  request: (action: string, details?: string) => console.log(`[${action}] ${details || ''}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

// ===== GIT OPERATIONS =====

export async function commitLocalChanges(siteId: string, message: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string }> {
  try {
    const siteDir = await getSiteDirAsync(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${siteDir} is not a git repository`);
    }
    
    log.request('Local Commit', `Committing changes for site ${siteId}`);
    
    // Stage and commit changes
    const commands = [
      { cmd: 'git', args: ['add', '.'], cwd: siteDir },
      { cmd: 'git', args: ['commit', '-m', message], cwd: siteDir }
    ];
    
    let commitHash = '';
    
    for (const { cmd, args, cwd } of commands) {
      log.step('Local Commit', `Executing ${cmd}`);
      
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
          log.info('Local Commit', `No changes to commit for site ${siteId}`);
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
    
    log.result('Local Commit', true, `Committed changes for site ${siteId}`);
    
    return {
      success: true,
      message: `Successfully committed changes`,
      commitHash
    };
    
  } catch (error) {
    log.error('Local Commit', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function startOverFromGitHub(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    log.request('Start Over', `Starting pull for site ${siteId}`);
    
    const siteDir = await getSiteDirAsync(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${siteDir} is not a git repository`);
    }
    
    log.step('Start Over', 'Validating site directory');
    
    // First fetch the latest changes
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
    
    // Force reset to origin/master to discard local changes
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
      throw new Error(`Failed to reset to origin/master: ${resetResult.error}`);
    }
    
    
    // Get the current commit hash
    const commitResult = await new Promise<{ success: boolean; output: string; error?: string }>((resolve) => {
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
    
    const commitHash = commitResult.success ? commitResult.output.trim() : 'unknown';
    
    log.result('Start Over', true, `Pulled latest changes for site ${siteId}`);
    
    return {
      success: true,
      message: `✅ Successfully started over! Your website has been refreshed with the latest version. All your recent changes have been cleared.`,
      commitHash: commitHash
    };
    
  } catch (error) {
    log.error('Start Over', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error
    };
  }
}

export async function undoLastCommit(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    log.request('Undo', `Starting undo for site ${siteId}`);
    
    const siteDir = await getSiteDirAsync(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${siteDir} is not a git repository`);
    }
    
    log.step('Undo', 'Validating site directory');
    
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
    
    log.result('Undo', true, `Undone commit for site ${siteId}`);
    
    return {
      success: true,
      message: `↩️ **Change undone!** You've reverted to the previous version of your website.`,
      commitHash: lastCommitHash
    };
    
  } catch (error) {
    log.error('Undo', error);
    return {
      success: false,
      error: `❌ **Couldn't undo changes** - There was an issue reverting your changes. Please try again.`,
      details: error
    };
  }
}

export async function redoLastCommit(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; error?: string; details?: any }> {
  try {
    log.request('Redo', `Starting redo for site ${siteId}`);
    
    const siteDir = await getSiteDirAsync(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${siteDir} is not a git repository`);
    }
    
    log.step('Redo', 'Validating site directory');
    
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
    
    log.result('Redo', true, `Redone commit for site ${siteId}`);
    
    return {
      success: true,
      message: `↪️ **Change restored!** You've brought back the previous version of your website.`,
      commitHash: undoneCommitHash.trim()
    };
    
  } catch (error) {
    log.error('Redo', error);
    return {
      success: false,
      error: `❌ **Couldn't restore changes** - There was an issue bringing back your changes. Please try again.`,
      details: error
    };
  }
}

export async function pushToGitHub(siteId: string): Promise<{ success: boolean; message?: string; commitHash?: string; commitMessage?: string; error?: string; details?: any }> {
  try {    
    const siteDir = await getSiteDirAsync(siteId);
    
    // Check if site directory exists
    const siteExists = await fs.stat(siteDir).then(() => true).catch(() => false);
    if (!siteExists) {
      throw new Error(`Site directory does not exist: ${siteDir}`);
    }
    
    // Check if it's a git repository
    const gitRepoPath = path.join(siteDir, '.git');
    const isGitRepo = await fs.stat(gitRepoPath).then(() => true).catch(() => false);
    
    if (!isGitRepo) {
      throw new Error(`Git directory ${siteDir} is not a git repository`);
    }
    
    log.request('Publish', `Publishing local commits to GitHub for site ${siteId}`);
    
    // First, fetch any remote changes
    log.step('Publish', 'Fetching latest changes from GitHub');
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
      // Check if the error is due to repository not existing
      if (fetchResult.error?.includes('Repository not found') || fetchResult.error?.includes('does not appear to be a git repository')) {
        throw new Error(`❌ **GitHub repository not found** - The remote repository doesn't exist yet. Please create the repository on GitHub first or contact support to set it up.`);
      }
      log.info('Publish', 'Fetch failed, trying to push anyway');
    }
    
    // Now push local commits to GitHub
    log.step('Publish', 'Pushing local commits to GitHub');
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
      // Check if the error is due to repository not existing
      if (pushResult.error?.includes('Repository not found') || pushResult.error?.includes('does not appear to be a git repository')) {
        throw new Error(`❌ **GitHub repository not found** - The remote repository doesn't exist yet. Please create the repository on GitHub first or contact support to set it up.`);
      }
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
    
    log.result('Publish', true, `Published site ${siteId} to GitHub`);
    
    return {
      success: true,
      message: `🎉 **Your website has been published!** Your changes are now live and visible to visitors.`,
      commitHash,
      commitMessage
    };
    
  } catch (error) {
    log.error('Publish', error);
    return {
      success: false,
      error: `❌ **Publishing failed** - There was an issue publishing your website. Please try again or contact support if the problem continues.`,
      details: error
    };
  }
}
