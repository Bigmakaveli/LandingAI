import path from 'path';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string | any[]; // Support both string and complex content with attachments
  timestamp?: string;
};

// ===== PATH UTILITIES =====

export function getHistoryPath(siteId?: string): string {
  // Default: repo root chat history
  if (!siteId) return path.resolve(process.cwd(), '../../chat_history.json');
  // Per-site history: <repo_root>/<siteId>/chat_history.json
  return path.resolve(process.cwd(), `../../${siteId}/chat_history.json`);
}

export function getSiteDir(siteId: string): string {
  // For keaara, the website files are in the root directory, not in a site subdirectory
  if (siteId === 'keaara') {
    return path.resolve(process.cwd(), `../../${siteId}`);
  }
  // For other sites, website files are in the site subdirectory
  return path.resolve(process.cwd(), `../../${siteId}/site`);
}

export function getGitDir(siteId: string): string {
  // For keaara, the git repository is at the root level, not in the site subdirectory
  if (siteId === 'keaara') {
    return path.resolve(process.cwd(), `../../${siteId}`);
  }
  // For other sites, git repository is in the site subdirectory
  return path.resolve(process.cwd(), `../../${siteId}/site`);
}

// ===== MESSAGE UTILITIES =====

export function summarizeMessageContentForLog(content: any): string {
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

export function logOutgoingMessages(messages: any[], siteId?: string) {
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

export function extractTextFromMessageContent(content: any): string {
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
