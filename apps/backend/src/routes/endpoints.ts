import express from 'express';
import path from 'path';
import OpenAI from 'openai';
import { OPENAI_CONFIG } from '../config';
import { 
  getSiteDir, 
  logOutgoingMessages, 
  extractTextFromMessageContent 
} from '../utils/general';
import { 
  readSiteFiles, 
  loadHistory, 
  deleteHistory, 
  appendToHistory, 
  applyFilesToSite 
} from '../utils/siteManagement';
import { callAIder } from '../utils/aiderUtils';
import { 
  commitLocalChanges, 
  startOverFromGitHub, 
  undoLastCommit, 
  redoLastCommit, 
  pushToGitHub 
} from '../utils/githubUtils';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_CONFIG.API_KEY,
});

// ===== CHAT PROCESSING =====

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

// ===== ROUTE HANDLERS =====

export function setupRoutes(app: express.Application) {
  // Health check
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
}
