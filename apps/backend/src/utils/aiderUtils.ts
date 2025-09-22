import { aiderProcessManager } from './aiderProcessManager';

// ===== LOGGING UTILITIES =====
const log = {
  request: (action: string, details?: string) => console.log(`[${action}] ${details || ''}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

// ===== AIDER INTEGRATION =====

export async function callAIder(siteId: string, userMessage: string): Promise<{ success: boolean; output: string; error?: string; codeDiff: string }> {
  try {
    log.request('Aider', `Starting execution for site ${siteId}`);
    
    // Use the persistent process manager
    const result = await aiderProcessManager.sendMessage(siteId, userMessage);
    
    log.result('Aider', result.success, `Process count: ${aiderProcessManager.getProcessCount()}`);
    
    return result;
    
  } catch (error) {
    log.error('Aider', error);
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
      codeDiff: ""
    };
  }
}

// ===== PROCESS MANAGEMENT UTILITIES =====

export function getAiderProcessStatus(siteId?: string) {
  if (siteId) {
    return aiderProcessManager.getProcessInfo(siteId);
  }
  return {
    totalProcesses: aiderProcessManager.getProcessCount(),
    processes: Array.from(aiderProcessManager['processes'].keys()).map(siteId => ({
      siteId,
      ...aiderProcessManager.getProcessInfo(siteId)
    }))
  };
}

export function terminateAiderProcess(siteId: string) {
  aiderProcessManager.terminateProcess(siteId);
}

export function terminateAllAiderProcesses() {
  aiderProcessManager.terminateAllProcesses();
}
