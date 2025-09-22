import { promises as fs } from 'fs';
import path from 'path';
import { getSiteDir, getSiteDirAsync, ChatMessage, getHistoryPath } from './general';
import { loadHistory as dbLoadHistory, saveHistory as dbSaveHistory, appendToHistory as dbAppendToHistory, deleteHistory as dbDeleteHistory } from './database';

// ===== LOGGING UTILITIES =====
const log = {
  request: (action: string, details?: string) => console.log(`[${action}] ${details || ''}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

// ===== FILE SYSTEM UTILITIES =====

export async function walkDirectory(dir: string, base: string): Promise<string[]> {
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

export async function readSiteFiles(siteId: string): Promise<Array<{ path: string, content: string }>> {
  try {
    const siteDir = await getSiteDirAsync(siteId);
    const exists = await fs.stat(siteDir).then(() => true).catch(() => false);
    
    if (!exists) return [];
    
    const relFiles = await walkDirectory(siteDir, siteDir);
    const files = await Promise.all(relFiles.map(async rel => {
      const abs = path.join(siteDir, rel);
      const content = await fs.readFile(abs, 'utf8');
      return { path: rel.replace(/\\/g, '/'), content };
    }));
    
    log.info('Site Files', `Found ${files.length} files`);
    return files;
  } catch (err) {
    log.error('Site Files', err);
    return [];
  }
}

// ===== CHAT HISTORY MANAGEMENT =====

export async function loadHistory(siteId?: string): Promise<ChatMessage[]> {
  try {
    // Use database for chat history
    return await dbLoadHistory(siteId);
  } catch (err: any) {
    log.error('Chat History', err);
    // Fallback to file system if database fails
    try {
      const historyPath = getHistoryPath(siteId);
      const data = await fs.readFile(historyPath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed as ChatMessage[];
      return [];
    } catch (fileErr: any) {
      if (fileErr && (fileErr.code === 'ENOENT' || fileErr.code === 'ENOTDIR')) {
        return [];
      }
      log.error('Chat History Fallback', fileErr);
      return [];
    }
  }
}

export async function saveHistory(history: ChatMessage[], siteId?: string): Promise<void> {
  try {
    // Use database for chat history
    await dbSaveHistory(history, siteId);
  } catch (err: any) {
    log.error('Save History', err);
    // Fallback to file system if database fails
    const historyPath = getHistoryPath(siteId);
    const data = JSON.stringify(history, null, 2);
    await fs.writeFile(historyPath, data, 'utf8');
  }
}

export async function appendToHistory(newMessages: ChatMessage[], siteId?: string): Promise<void> {
  if (!newMessages.length) return;
  
  try {
    // Use database for chat history
    const timestamped = newMessages.map(m => ({ ...m, timestamp: m.timestamp ?? new Date().toISOString() }));
    await dbAppendToHistory(timestamped, siteId);
  } catch (err: any) {
    log.error('Append History', err);
    // Fallback to file system if database fails
    const timestamped = newMessages.map(m => ({ ...m, timestamp: m.timestamp ?? new Date().toISOString() }));
    const existing = await loadHistory(siteId);
    await saveHistory([...existing, ...timestamped], siteId);
  }
}

export async function deleteHistory(siteId?: string): Promise<void> {
  try {
    // Use database for chat history
    await dbDeleteHistory(siteId);
  } catch (err: any) {
    log.error('Delete History', err);
    // Fallback to file system if database fails
    const historyPath = getHistoryPath(siteId);
    try {
      await fs.writeFile(historyPath, '[]', 'utf8');
    } catch (fileErr: any) {
      if (fileErr && fileErr.code === 'ENOENT') {
        // Nothing to delete; ensure file exists as empty
        await fs.writeFile(historyPath, '[]', 'utf8');
        return;
      }
      throw fileErr;
    }
  }
}

// ===== FILE APPLICATION =====

export async function applyFilesToSite(siteId: string, files: Array<{ path: string, content: string }>) {
  try {
    const siteDir = await getSiteDirAsync(siteId);
    log.request('Apply Files', `${files.length} files to ${siteId}`);

    // Apply the file changes
    for (const f of files) {
      const rel = String(f?.path || '').replace(/^\/+/, '');
      const content = String(f?.content ?? '');
      if (!rel) continue;
      const abs = path.join(siteDir, rel);
      const dir = path.dirname(abs);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(abs, content, 'utf8');
      log.step('Apply Files', `Applied ${rel}`);
    }

    return { 
      ok: true, 
      updated: files.length
    };
  } catch (err) {
    log.error('Apply Files', err);
    throw new Error('Failed to apply files');
  }
}
