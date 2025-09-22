import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getSiteDir, getSiteDirAsync } from './general';
import { OPENAI_CONFIG } from '../config';

// ===== LOGGING UTILITIES =====
const log = {
  request: (action: string, details?: string) => console.log(`[${action}] ${details || ''}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

interface AiderProcess {
  process: ChildProcess | null;
  siteId: string;
  isReady: boolean;
  lastUsed: number;
}

export class AiderProcessManager {
  private processes: Map<string, AiderProcess> = new Map();
  private readonly maxIdleTime = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  private startCleanupInterval() {
    // Clean up idle processes every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleProcesses();
    }, 5 * 60 * 1000);
  }

  private cleanupIdleProcesses() {
    const now = Date.now();
    for (const [siteId, aiderProcess] of this.processes.entries()) {
      if (now - aiderProcess.lastUsed > this.maxIdleTime) {
        log.info('AiderProcessManager', `Cleaning up idle process for site ${siteId}`);
        this.terminateProcess(siteId);
      }
    }
  }

  private async createProcess(siteId: string): Promise<AiderProcess> {
    log.request('AiderProcessManager', `Creating new process for site ${siteId}`);
    
    // Get the site directory path
    const siteDir = await getSiteDirAsync(siteId);
    
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

    // Read system message from file
    const systemMessagePath = path.resolve(process.cwd(), 'system_message.txt');
    const systemMessage = await fs.readFile(systemMessagePath, 'utf8');

    // For now, we'll create a simple process that can be reused
    // The actual "persistence" will be achieved by keeping the process alive
    // and reusing it for multiple requests
    const aiderProcess: AiderProcess = {
      process: null, // Will be created per request
      siteId,
      isReady: true, // Always ready since we create per request
      lastUsed: Date.now()
    };

    this.processes.set(siteId, aiderProcess);
    return aiderProcess;
  }


  async sendMessage(siteId: string, userMessage: string): Promise<{ success: boolean; output: string; error?: string; codeDiff: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        let aiderProcess = this.processes.get(siteId);

        // Create process if it doesn't exist
        if (!aiderProcess) {
          aiderProcess = await this.createProcess(siteId);
        }

        // Update last used time
        aiderProcess.lastUsed = Date.now();

        // For now, we'll use the existing aider_runner.py approach
        // but keep the process entry for tracking
        const result = await this.runAiderForSite(siteId, userMessage);
        resolve(result);

      } catch (error) {
        reject({
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          codeDiff: ''
        });
      }
    });
  }

  private async runAiderForSite(siteId: string, userMessage: string): Promise<{ success: boolean; output: string; error?: string; codeDiff: string }> {
    // Get the site directory path
    const siteDir = await getSiteDirAsync(siteId);
    
    // Get the path to the aider_runner.py script
    const aiderScriptPath = path.resolve(process.cwd(), 'python/aider_runner.py');
    
    // Use virtual environment Python
    const pythonCommand = path.resolve(process.cwd(), 'python/venv/bin/python');
    
    // Read system message from file
    const systemMessagePath = path.resolve(process.cwd(), 'system_message.txt');
    const systemMessage = await fs.readFile(systemMessagePath, 'utf8');
    
    const args = [
      aiderScriptPath,
      siteDir,
      systemMessage,
      userMessage,
      '--api-key',
      OPENAI_CONFIG.API_KEY
    ];
    
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
        log.info('AiderProcessManager', `stdout: ${output.trim()}`);
      });
      
      // Collect stderr
      pythonProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        log.error('AiderProcessManager', `stderr: ${output.trim()}`);
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        log.result('AiderProcessManager', code === 0, `Exit code: ${code}`);
        
        if (code === 0) {
          try {
            // Try to parse the JSON response from Python
            const jsonResponse = JSON.parse(stdout.trim());
            log.step('AiderProcessManager', 'Parsed JSON response');
            
            resolve({
              success: true,
              output: jsonResponse.userOutput || stdout.trim(),
              codeDiff: jsonResponse.codeDiff || "",
              error: stderr.trim() || undefined
            });
          } catch (parseError) {
            log.step('AiderProcessManager', 'Using raw output (JSON parse failed)');
            resolve({
              success: true,
              output: stdout.trim(),
              codeDiff: "",
              error: stderr.trim() || undefined
            });
          }
        } else {
          resolve({
            success: false,
            output: stdout.trim(),
            codeDiff: "",
            error: stderr.trim() || `Process exited with code ${code}`
          });
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (error) => {
        log.error('AiderProcessManager', error);
        reject({
          success: false,
          output: stdout.trim(),
          error: error.message,
          codeDiff: ""
        });
      });
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          output: stdout.trim(),
          error: 'Process timed out after 15 minutes',
          codeDiff: ""
        });
      }, 15 * 60 * 1000); // 15 minutes timeout
    });
  }

  terminateProcess(siteId: string) {
    const aiderProcess = this.processes.get(siteId);
    if (aiderProcess) {
      log.info('AiderProcessManager', `Terminating process for site ${siteId}`);
      
      // Kill the process if it exists
      if (aiderProcess.process) {
        aiderProcess.process.kill();
      }
      
      this.processes.delete(siteId);
    }
  }

  terminateAllProcesses() {
    log.info('AiderProcessManager', 'Terminating all processes');
    for (const siteId of this.processes.keys()) {
      this.terminateProcess(siteId);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getProcessCount(): number {
    return this.processes.size;
  }

  getProcessInfo(siteId: string): { isActive: boolean; lastUsed: number } | null {
    const aiderProcess = this.processes.get(siteId);
    if (!aiderProcess) return null;
    
    return {
      isActive: aiderProcess.isReady,
      lastUsed: aiderProcess.lastUsed
    };
  }
}

// Singleton instance
export const aiderProcessManager = new AiderProcessManager();

// Graceful shutdown
process.on('SIGINT', () => {
  aiderProcessManager.terminateAllProcesses();
  process.exit(0);
});

process.on('SIGTERM', () => {
  aiderProcessManager.terminateAllProcesses();
  process.exit(0);
});
