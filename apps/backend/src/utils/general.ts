import path from 'path';
import https from 'https';
import http from 'http';
import { getSitesPath } from '../config';

// ===== LOGGING UTILITIES =====
const log = {
  request: (action: string, details?: string) => console.log(`[${action}] ${details || ''}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

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

// Cache for sites path to avoid repeated async calls
let cachedSitesPath: string | null = null;

// Synchronous version for backward compatibility
export function getSiteDir(siteId: string): string {
  // Use cached path if available, otherwise fall back to default
  const sitesPath = cachedSitesPath || "/Users/tamernas/Desktop/LandingAI-sites";
  return path.resolve(sitesPath, siteId);
}

// Async version that loads the actual sites path
export async function getSiteDirAsync(siteId: string): Promise<string> {
  if (!cachedSitesPath) {
    cachedSitesPath = await getSitesPath();
  }
  return path.resolve(cachedSitesPath, siteId);
}

// Note: getGitDir and getSiteDir are the same in this architecture
// Each site directory IS the git repository directory
export const getGitDir = getSiteDir;
export const getGitDirAsync = getSiteDirAsync;

// ===== IMAGE UTILITIES =====

export async function convertImageUrlToBase64(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = imageUrl.startsWith('https:') ? https : http;
    
    protocol.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: ${response.statusCode}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const contentType = response.headers['content-type'] || 'image/png';
        resolve(`data:${contentType};base64,${base64}`);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// ===== MESSAGE UTILITIES =====

export function cleanImageReferencesFromText(content: any): any {
  if (typeof content === 'string') {
    // Remove [Image: ...] patterns from text
    return content.replace(/\[Image: [^\]]+\]/g, '');
  }
  
  if (Array.isArray(content)) {
    return content.map((p: any) => {
      if (p && p.type === 'text' && typeof p.text === 'string') {
        // Clean the text content
        const cleanedText = p.text.replace(/\[Image: [^\]]+\]/g, '');
        return { ...p, text: cleanedText };
      }
      // Keep image_url parts as-is (they contain the actual image data)
      return p;
    });
  }
  
  return content;
}

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
    log.info('OpenAI Messages', `${messages.length} messages${siteId ? ` for site ${siteId}` : ''}`);
    messages.forEach((m: any, idx: number) => {
      const role = m?.role ?? 'unknown';
      const summary = summarizeMessageContentForLog(m?.content);
      log.info('Message', `[${idx}] ${role}: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}`);
    });
  } catch (e) {
    log.error('Message Logging', e);
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

export function preserveMessageContent(content: any): string | Array<{
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}> {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    // Return the content as-is if it's already in the proper format
    return content.map((p: any) => {
      if (p && p.type === 'text' && typeof p.text === 'string') {
        return { type: 'text', text: p.text };
      }
      if (p && p.type === 'image_url') {
        const url = typeof p.image_url === 'string' ? p.image_url : p?.image_url?.url;
        return { type: 'image_url', image_url: { url } };
      }
      return p;
    }).filter(Boolean);
  }
  return '';
}

export async function processMessageWithImages(content: any): Promise<any> {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const processedContent = await Promise.all(content.map(async (p: any) => {
      if (p && p.type === 'text' && typeof p.text === 'string') {
        return { type: 'text', text: p.text };
      }
      if (p && p.type === 'image_url') {
        const url = typeof p.image_url === 'string' ? p.image_url : p?.image_url?.url;
        try {
          // Convert URL to base64
          const base64Data = await convertImageUrlToBase64(url);
          return { type: 'image_url', image_url: { url: base64Data } };
        } catch (error) {
          log.error('Image Conversion', error);
          // Fallback to original URL if conversion fails
          return { type: 'image_url', image_url: { url } };
        }
      }
      return p;
    }));
    return processedContent.filter(Boolean);
  }
  return content;
}

export function appendImageUrlToText(content: any): any {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p: any) => {
      if (p && p.type === 'text' && typeof p.text === 'string') {
        // Find if there's an image_url in the same message
        const imagePart = content.find((part: any) => part.type === 'image_url');
        if (imagePart) {
          const imageUrl = typeof imagePart.image_url === 'string' ? imagePart.image_url : imagePart?.image_url?.url;
          return { type: 'text', text: `${p.text}\n[Image: ${imageUrl}]` };
        }
        return { type: 'text', text: p.text };
      }
      if (p && p.type === 'image_url') {
        // Keep the image_url as is for history storage
        return p;
      }
      return p;
    });
  }
  return content;
}
