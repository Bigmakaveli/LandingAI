import { promises as fs } from 'fs';
import path from 'path';
import { getSiteDir, ChatMessage, getHistoryPath } from './general';

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

export async function loadHistory(siteId?: string): Promise<ChatMessage[]> {
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

export async function saveHistory(history: ChatMessage[], siteId?: string): Promise<void> {
  const historyPath = getHistoryPath(siteId);
  const data = JSON.stringify(history, null, 2);
  await fs.writeFile(historyPath, data, 'utf8');
}

export async function appendToHistory(newMessages: ChatMessage[], siteId?: string): Promise<void> {
  if (!newMessages.length) return;
  const timestamped = newMessages.map(m => ({ ...m, timestamp: m.timestamp ?? new Date().toISOString() }));
  const existing = await loadHistory(siteId);
  await saveHistory([...existing, ...timestamped], siteId);
}

export async function deleteHistory(siteId?: string): Promise<void> {
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

// ===== FILE APPLICATION =====

export async function applyFilesToSite(siteId: string, files: Array<{ path: string, content: string }>) {
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
