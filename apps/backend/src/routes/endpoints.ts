import express from 'express';
import path from 'path';
import OpenAI from 'openai';
import { OPENAI_CONFIG } from '../config';
import { 
  getSiteDir, 
  getSiteDirAsync,
  logOutgoingMessages, 
  extractTextFromMessageContent,
  preserveMessageContent,
  processMessageWithImages,
  appendImageUrlToText,
  cleanImageReferencesFromText
} from '../utils/general';
import { 
  readSiteFiles, 
  loadHistory, 
  deleteHistory, 
  appendToHistory, 
  applyFilesToSite 
} from '../utils/siteManagement';
import { checkDatabaseConnection } from '../utils/database';
import { promises as fs } from 'fs';
import { callAIder, getAiderProcessStatus, terminateAiderProcess, terminateAllAiderProcesses } from '../utils/aiderUtils';
import { 
  addGiftCard, 
  editGiftCard, 
  removeGiftCard, 
  listGiftCards, 
  getGiftCard 
} from '../utils/giftCardManager';

// ===== SITE STATUS TRACKING =====
type SiteStatus = 'READY' | 'UNDER_DEV';

// Map to track the status of each site
const siteStatusMap = new Map<string, SiteStatus>();

// Helper functions for site status management
function getSiteStatus(siteId: string): SiteStatus {
  return siteStatusMap.get(siteId) || 'READY';
}

function setSiteStatus(siteId: string, status: SiteStatus): void {
  siteStatusMap.set(siteId, status);
  console.log(`[Site Status] ${siteId}: ${status}`);
}

// ===== LOGGING UTILITIES =====
const log = {
  request: (siteId: string, action: string) => console.log(`[${action}] ${siteId}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

// Helper function to read site description
async function readSiteDescription(siteId: string): Promise<string> {
  try {
    const siteDir = await getSiteDirAsync(siteId);
    const descriptionPath = `${siteDir}/site_description.txt`;
    const content = await fs.readFile(descriptionPath, 'utf8');
    return content.trim();
  } catch (error) {
    log.info('Site Description', `No description found for ${siteId}, using default`);
    return 'No specific site description available. This is a general website.';
  }
}
import { 
  commitLocalChanges, 
  startOverFromGitHub, 
  undoLastCommit, 
  redoLastCommit, 
  pushToGitHub 
} from '../utils/githubUtils';
import { 
  sendToOpenAI, 
  OpenAIMessage 
} from '../utils/llm_runner';

// ===== CHAT PROCESSING =====
async function getCodeDiffSummary(userRequest: string, codeDiff?: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    log.step('Code Diff Summary', 'Generating summary');
    
    // Read system message from file
    const systemMessagePath = path.resolve(process.cwd(), 'code_diff_system_message.txt');
    let systemMessage = await fs.readFile(systemMessagePath, 'utf8');
    systemMessage = systemMessage.replace('${userRequest}', userRequest);
    log.step('Code Diff Summary', 'Loaded system message from file :' + systemMessage);
    
    let messages: OpenAIMessage[];
    if(codeDiff) {
      messages = [
        { role: 'user', content: 'Summarize those code changes briefly : ' + codeDiff }
      ];
    } else {
      messages = [
        { role: 'user', content: 'Write a summary of the following user request (assume the coding is done) : ' + userRequest }
      ];
    }

    const result = await sendToOpenAI(systemMessage, messages);
    log.result('Code Diff Summary', result.success);
    return {
      success: result.success,
      content: result.response_for_message ?? "✅ Your changes have been saved!"
    };
  } catch (error) {
    log.error('Code Diff Summary', error);
    return {
      success: false,
      content: "Error generating summary"
    };
  }
}

async function processChatWithAider(messages: any[], siteId: string, promptForCode?: string) {
  const lastUserMessage = [...messages].reverse().find((m: any) => m?.role === 'user' && m?.content);
  // Use the provided prompt_for_code if available, otherwise extract from messages
  let prompt: string;
  let originalUserMessage: string = extractTextFromMessageContent(lastUserMessage.content);
  
  if (promptForCode) {
    prompt = promptForCode;
    log.step('Aider Chat', 'Using prompt_for_code');
  } else {
    prompt = originalUserMessage;
    log.step('Aider Chat', 'Using fallback user message');
  }
  
  // Call Aider to make changes to the site
  const aiderResult = await callAIder(siteId, prompt);
  log.result('Aider Chat', aiderResult.success);
  // Create assistant response based on Aider result
  let assistantContent: string;
  
  if (aiderResult.success) {
    // If Aider made changes, commit them locally for undo/redo functionality
    if (aiderResult.codeDiff && aiderResult.codeDiff.trim()) {      
      // Use OpenAI to summarize the changes in a user-friendly way
      log.step('Aider Chat', 'Getting summary from code diff');
      const summaryResult = await getCodeDiffSummary(originalUserMessage, aiderResult.codeDiff);
      assistantContent = summaryResult.content ?? "Error generating summary";
    } else {
      log.step('Aider Chat', 'Getting summary from original user request');
      const summaryResult = await getCodeDiffSummary(originalUserMessage);
      assistantContent = summaryResult.content ?? "Error generating summary";
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
    reloadIframe: aiderResult.success
  };
}


// ===== ROUTE HANDLERS =====

export function setupRoutes(app: express.Application) {
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Database health check
  app.get('/health/database', async (req, res) => {
    try {
      const dbConnected = await checkDatabaseConnection();
      res.json({ 
        status: dbConnected ? 'ok' : 'error',
        database: dbConnected ? 'connected' : 'disconnected'
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'error',
        database: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Site status endpoint
  app.get('/api/:siteId/site-status', (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      if (!siteId) {
        return res.status(400).json({ error: 'siteId is required' });
      }

      const status = getSiteStatus(siteId);
      return res.json({ 
        siteId,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      log.error('Site Status', err);
      return res.status(500).json({ error: 'Failed to get site status' });
    }
  });


  // Dynamically serve per-site static content from the configured sites directory
  app.use('/sites/:siteId', async (req, res, next) => {
    const siteId = String(req.params.siteId || '');
    if (!siteId) return next();
    
    // Add CORS headers for static files
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Last-Modified, ETag');
    
    try {
      // Serve directly from the siteId directory in the configured sites path
      const siteDir = await getSiteDirAsync(siteId);
      return express.static(siteDir, { index: 'index.html' })(req, res, next);
    } catch (error) {
      log.error('Static File Serving', error);
      return res.status(500).json({ error: 'Failed to serve static files' });
    }
  });

  // Return text-based files for a site (used to send source files to AI)
  app.get('/api/:siteId/site-files', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      if (!siteId) return res.status(400).json({ error: 'siteId required' });
      
      const files = await readSiteFiles(siteId);
      return res.json({ files });
    } catch (err) {
      log.error('Site Files', err);
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
      log.error('Apply Files', err);
      return res.status(500).json({ error: 'Failed to apply files' });
    }
  });

  // Per-site history endpoint
  app.get('/api/:siteId/chat/history', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      const history = await loadHistory(siteId);
      
      // Clean [Image: ...] references from text messages while keeping image data
      const cleanedHistory = history.map((message: any) => ({
        ...message,
        content: cleanImageReferencesFromText(message.content)
      }));
      
      res.json({ history: cleanedHistory });
    } catch (err) {
      log.error('History Route', err);
      res.status(500).json({ error: 'Failed to load history' });
    }
  });

  app.delete('/api/:siteId/chat/history', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      await deleteHistory(siteId);
      res.json({ ok: true });
    } catch (err) {
      log.error('Delete History', err);
      res.status(500).json({ error: 'Failed to delete history' });
    }
  });

  // Per-site chat endpoint with OpenAI decision layer
  app.post('/api/:siteId/chat', async (req, res) => {
    const siteId = String(req.params.siteId || '');
    log.request(siteId, 'Chat Request');
    
    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      log.info('Site Chat', `${messages.length} messages`);
      
      if (messages.length === 0) {
        log.error('Site Chat', 'No messages provided');
        setSiteStatus(siteId, 'READY');
        return res.status(400).json({ error: 'messages array is required' });
      }

      // Mark site as UNDER_DEV when chat request starts
      setSiteStatus(siteId, 'UNDER_DEV');

      const lastUser = [...messages].reverse().find((m: any) => m?.role === 'user' && m?.content);
      if (!lastUser) {
        setSiteStatus(siteId, 'READY');
        return res.status(400).json({ error: 'No user message found' });
      }

      log.step('Site Chat', 'Processing user message');
      
      // Append image URL to text for history storage (keep URLs in history)
      const contentForHistory = appendImageUrlToText(lastUser.content);
      lastUser.content = contentForHistory;

      // Save the user message to history
      appendToHistory([{ role: 'user', content: lastUser.content }], siteId).catch(err =>
        log.error('Append History', err)
      );

      // Step 1: Ask OpenAI to determine if this is a coding task
      log.step('Site Chat', 'Determining if coding required');
      
      // Read decision system message from file
      const decisionSystemMessagePath = path.resolve(process.cwd(), 'decision_system_message.txt');
      let decisionSystemMessage = await fs.readFile(decisionSystemMessagePath, 'utf8');
      
      // Replace SITE_ID_PLACEHOLDER with actual site ID
      decisionSystemMessage = decisionSystemMessage.replace(/SITE_ID_PLACEHOLDER/g, siteId);
      
      log.step('Site Chat', 'Loaded decision system message from file');
                
      // Load chat history and combine with current messages for full context
      const chatHistory = await loadHistory(siteId);
      log.info('Site Chat', `Loaded ${chatHistory.length} history messages`);
      
      // Combine historical messages with current messages
      const allMessages = [...chatHistory, ...messages];
      log.info('Site Chat', `Combined ${chatHistory.length + messages.length} total messages`);
      // Convert all messages to OpenAI message format for context
      const decisionMessages: OpenAIMessage[] = await Promise.all(allMessages.map(async (msg: any) => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : await processMessageWithImages(msg.content)
      })));

      log.step('Site Chat', 'Calling OpenAI for decision');
      const decisionResult = await sendToOpenAI(decisionSystemMessage, decisionMessages);
      log.result('Site Chat', decisionResult.success, 'OpenAI decision');
      
      if (!decisionResult.success) {
        log.error('Site Chat', 'OpenAI decision failed');
        const assistantMessage = { 
          role: 'assistant', 
          content: 'Sorry, I encountered an issue processing your request. Please try again.' 
        };
        setSiteStatus(siteId, 'READY');
        return res.json({ message: assistantMessage });
      }

      // Use the should_code field from the response
      let shouldCode = false;
      if (decisionResult.should_code !== undefined) {
        shouldCode = decisionResult.should_code;
        log.info('Site Chat', `Decision: ${shouldCode ? 'coding' : 'general'}`);
      }

      // Step 2: Route based on decision
      if (shouldCode) {
        log.step('Site Chat', 'Routing to Aider');
        if (decisionResult.prompt_for_code) {
          log.step('Site Chat', 'Using prompt_for_code');
        }
        
        try {
          const result = await processChatWithAider(messages, siteId, decisionResult.prompt_for_code);
          setSiteStatus(siteId, 'READY');
          return res.json({ 
            message: result,
            reloadIframe: result.reloadIframe 
          });
        } catch (err) {
          log.error('Aider Chat', err);
          
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
          setSiteStatus(siteId, 'READY');
          return res.json({ message: assistantMessage, error: 'Aider Chat error', details: err });
        }
      } else {
        log.step('Site Chat', 'Returning direct response');
        
        // Return the response_for_message directly to the user
        const assistantMessage = { 
          role: 'assistant' as const, 
          content: decisionResult.response_for_message || 'I apologize, but I couldn\'t process your request. Please try again.'
        };
        
        // Save the assistant response to chat history
        await appendToHistory([assistantMessage], siteId);
        
        setSiteStatus(siteId, 'READY');
        return res.json({ 
          message: assistantMessage,
          reloadIframe: false // General questions don't require iframe reload
        });
      }

    } catch (err) {
      log.error('Chat Route', err);
      const assistantMessage = { role: 'assistant', content: 'The AI service is temporarily unavailable. Please try again shortly.' };
      setSiteStatus(siteId, 'READY');
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

      log.request(siteId, 'Undo');
      
      // Kill the aider process for this site before undoing
      terminateAiderProcess(siteId);
      log.info('Undo', `Terminated aider process for site ${siteId}`);
      
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
      log.error('Undo', err);
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

      // Kill the aider process for this site before starting over
      terminateAiderProcess(siteId);
      log.info('Start Over', `Terminated aider process for site ${siteId}`);       

      log.request(siteId, 'Start Over');  
      const result = await startOverFromGitHub(siteId);
      
      if (result.success) {
        // Delete chat history for the site
        await deleteHistory(siteId);
        log.info('Start Over', `Deleted chat history for site ${siteId}`);

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
      log.error('Start Over', err);
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

      log.request(siteId, 'Redo');
      
      // Kill the aider process for this site before redoing
      terminateAiderProcess(siteId);
      log.info('Redo', `Terminated aider process for site ${siteId}`);
      
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
      log.error('Redo', err);
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

      log.request(siteId, 'Publish');
      
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
      log.error('Publish', err);
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
      
      log.request(siteId, 'Test Aider');
      
      const result = await callAIder(siteId, userMessage);
      
      return res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      log.error('Test Aider', err);
      return res.status(500).json({ 
        error: 'Failed to test Aider',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // ===== AIDER PROCESS MONITORING =====
  
  // Get aider process status
  app.get('/api/aider/status', (req, res) => {
    try {
      const siteId = req.query.siteId as string;
      const status = getAiderProcessStatus(siteId);
      
      return res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      log.error('Get Aider Status', err);
      return res.status(500).json({ 
        error: 'Failed to get aider status',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Terminate aider process for a specific site
  app.post('/api/aider/terminate/:siteId', (req, res) => {
    try {
      const { siteId } = req.params;
      
      if (!siteId) {
        return res.status(400).json({ 
          error: 'Site ID is required' 
        });
      }
      
      terminateAiderProcess(siteId);
      
      return res.json({
        success: true,
        message: `Aider process terminated for site ${siteId}`,
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      log.error('Terminate Aider Process', err);
      return res.status(500).json({ 
        error: 'Failed to terminate aider process',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Terminate all aider processes
  app.post('/api/aider/terminate-all', (req, res) => {
    try {
      terminateAllAiderProcesses();
      
      return res.json({
        success: true,
        message: 'All aider processes terminated',
        timestamp: new Date().toISOString()
      });
      
    } catch (err) {
      log.error('Terminate All Aider Processes', err);
      return res.status(500).json({ 
        error: 'Failed to terminate all aider processes',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // ===== GIFT CARD ENDPOINTS =====

  // Get all gift cards for a site
  app.get('/api/:siteId/gift-cards', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      if (!siteId) {
        return res.status(400).json({
          success: false,
          error: 'siteId is required'
        });
      }

      const result = await listGiftCards(siteId);
      
      if (result.success) {
        return res.json({
          success: true,
          data: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (err) {
      log.error('Get All Gift Cards', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to retrieve gift cards',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Get gift card by ID for a site
  app.get('/api/:siteId/gift-cards/:id', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      const id = parseInt(req.params.id);
      
      if (!siteId) {
        return res.status(400).json({
          success: false,
          error: 'siteId is required'
        });
      }
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid gift card ID'
        });
      }
      
      const result = await getGiftCard(siteId, id);
      
      if (result.success) {
        return res.json({
          success: true,
          data: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (err) {
      log.error('Get Gift Card', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to retrieve gift card',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Create gift card for a site
  app.post('/api/:siteId/gift-cards', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      const { name, description, price } = req.body;
      
      if (!siteId) {
        return res.status(400).json({
          success: false,
          error: 'siteId is required'
        });
      }
      
      if (!name || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Name and price are required'
        });
      }
      
      const result = await addGiftCard(siteId, { name, description, price });
      
      if (result.success) {
        return res.status(201).json({
          success: true,
          data: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (err) {
      log.error('Create Gift Card', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create gift card',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Update gift card for a site
  app.put('/api/:siteId/gift-cards/:id', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      const id = parseInt(req.params.id);
      const { name, description, price } = req.body;
      
      if (!siteId) {
        return res.status(400).json({
          success: false,
          error: 'siteId is required'
        });
      }
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid gift card ID'
        });
      }
      
      if (!name || price === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Name and price are required'
        });
      }
      
      const result = await editGiftCard(siteId, { id, name, description, price });
      
      if (result.success) {
        return res.json({
          success: true,
          data: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (err) {
      log.error('Update Gift Card', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update gift card',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Delete gift card for a site
  app.delete('/api/:siteId/gift-cards/:id', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      const id = parseInt(req.params.id);
      
      if (!siteId) {
        return res.status(400).json({
          success: false,
          error: 'siteId is required'
        });
      }
      
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid gift card ID'
        });
      }
      
      const result = await removeGiftCard(siteId, id);
      
      if (result.success) {
        return res.json({
          success: true,
          message: 'Gift card deleted successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (err) {
      log.error('Delete Gift Card', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to delete gift card',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });


}
