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
import { 
  sendToLLM, 
  getAvailableModels, 
  pullModel, 
  OllamaMessage 
} from '../utils/llm_runner';

// ===== CHAT PROCESSING =====
async function getCodeDiffSummary(codeDiff: string, userRequest: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    console.log(`[Code Diff Summary] Summarizing changes for user request: ${userRequest}`);
    
    const systemMessage = `You are a helpful AI assistant that explains code changes in simple, non-technical language for website users.
          Analyze the code changes and explain what was changed in a user-friendly way. Focus on what the user will see or experience.

          Guidelines:
          - Be concise and direct
          - Use simple language
          - Focus on visual or functional changes the user will notice
          - Avoid technical jargon
          - Keep response under 2 sentences
          - If multiple changes, mention only the main ones

          User's original request: "${userRequest}"

          Code diff to analyze:
          ${codeDiff}`;

    const messages: OllamaMessage[] = [
      { role: 'user', content: 'Summarize the changes briefly.' }
    ];

    const result = await sendToLLM(systemMessage, messages);
    
    if (result.success && result.content) {
      console.log(`[Code Diff Summary] Successfully generated summary: ${result.content.substring(0, 100)}...`);
      return {
        success: true,
        content: result.content
      };
    } else {
      console.error(`[Code Diff Summary] Failed to generate summary:`, result.error);
      return {
        success: false,
        error: result.error || 'Failed to generate summary'
      };
    }
    
  } catch (error) {
    console.error(`[Code Diff Summary] Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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
    if (aiderResult.codeDiff && aiderResult.codeDiff.trim()) {
      console.log(`[Aider Chat] Aider made changes, committing locally for undo/redo`);
      const commitResult = await commitLocalChanges(siteId, `AI change: ${userContent}`);
      
      if (commitResult.success) {
        // Use Ollama to summarize the changes in a user-friendly way
        console.log(`[Aider Chat] Getting code diff summary from Ollama`);
        const summaryResult = await getCodeDiffSummary(aiderResult.codeDiff, userContent);
        
        if (summaryResult.success) {
          assistantContent = `✅ Your changes have been saved!\n\n${summaryResult.content}\n\nYou can now use the undo/redo buttons to navigate through your changes, or click publish to make them live on your website.`;
        } else {
          assistantContent = `✅ Your changes have been saved!\n\nYour requested changes have been applied to the site.\n\nYou can now use the undo/redo buttons to navigate through your changes, or click publish to make them live on your website.`;
        }
      } else {
        assistantContent = `**Changes applied but couldn't be saved** - Please try again.`;
      }
    } else {
      // Aider succeeded but didn't make file changes (e.g., answered a question)
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
    reloadIframe: aiderResult.success && !!(aiderResult.codeDiff && aiderResult.codeDiff.trim()) // Reload only if Aider succeeded and made actual changes
  };
}

async function processGeneralQuestionWithOllama(messages: any[], siteId: string) {
  // Extract the last user message
  const lastUserMessage = [...messages].reverse().find((m: any) => m?.role === 'user' && m?.content);
  
  if (!lastUserMessage) {
    throw new Error('No user message found');
  }
  
  const userContent = extractTextFromMessageContent(lastUserMessage.content);
  console.log(`[General Chat] Processing user question: ${userContent}`);
  
  // Load conversation history for context
  const conversationHistory = await loadHistory(siteId);
  console.log(`[General Chat] Loaded ${conversationHistory.length} conversation history messages`);
  
  // Get site files for context (only HTML files for general questions)
  const allSiteFiles = await readSiteFiles(siteId);
  const siteFiles = allSiteFiles.filter(f => f.path.toLowerCase().endsWith('.html'));
  console.log(`[General Chat] Found ${siteFiles.length} HTML files for context (filtered from ${allSiteFiles.length} total files)`);
  
  // Create system message with site context
  let systemMessage = `
  You are a helpful AI assistant for LandingAI.
  You help users understand their website.
  You have access to the current website files and can answer questions about the website's content,structure, and functionality.
  - Provide concise, helpful responses about the website.
  - If the user asks about specific content, features, or functionality, refer to the actual website files when relevant.
  - Keep responses brief and to the point.
  - Avoid technical jargon.
  Website files:
  ${siteFiles.map(f => `File: ${f.path}\nContent:\n${f.content}\n---\n`).join('\n')}
  `;

  // Prepare messages for Ollama
  const ollamaMessages: OllamaMessage[] = [];
  
  // Add recent conversation history (limit to last 5 messages to avoid token limits)
  const recentHistory = conversationHistory.slice(-5);
  if (recentHistory.length > 0) {
    ollamaMessages.push(...recentHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: extractTextFromMessageContent(msg.content) || ''
    })));
    console.log(`[General Chat] Added ${recentHistory.length} conversation history messages`);
  }
  
  // Add current user message
  ollamaMessages.push({ role: 'user', content: userContent });
  
  console.log(`[General Chat] Sending ${ollamaMessages.length} messages to Ollama`);
  
  try {
    const result = await sendToLLM(systemMessage, ollamaMessages);
    
    if (!result.success) {
      console.error('[General Chat] Failed to get response from Ollama:', result.error);
      throw new Error(result.error || 'Failed to get response from Ollama');
    }
    
    const assistantContent = result.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
    console.log(`[General Chat] Received response from Ollama: ${assistantContent.substring(0, 100)}...`);
    
    // Create assistant message
    const assistantMessage = {
      role: 'assistant' as const,
      content: assistantContent
    };
    
    // Save the assistant response to chat history
    await appendToHistory([assistantMessage], siteId);
    
    return {
      ...assistantMessage,
      reloadIframe: false // General questions don't require iframe reload
    };
    
  } catch (error) {
    console.error('[General Chat] Error processing with Ollama:', error);
    
    // Fallback response
    const fallbackMessage = {
      role: 'assistant' as const,
      content: 'I apologize, but I\'m having trouble processing your question right now. Please try again or rephrase your question.'
    };
    
    await appendToHistory([fallbackMessage], siteId);
    
    return {
      ...fallbackMessage,
      reloadIframe: false
    };
  }
}

// ===== ROUTE HANDLERS =====

export function setupRoutes(app: express.Application) {
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // ===== OLLAMA ENDPOINTS (must come before /api/:siteId routes) =====

  // Test Ollama connection and get available models
  app.get('/api/ollama/models', async (req, res) => {
    try {
      console.log('[Ollama] Getting available models');
      
      const result = await getAvailableModels();
      
      if (result.success) {
        return res.json({
          success: true,
          models: result.models,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to get models',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (err) {
      console.error('[Ollama] Error getting models:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to get Ollama models',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Pull a model from Ollama
  app.post('/api/ollama/pull', async (req, res) => {
    try {
      const { modelName } = req.body;
      
      if (!modelName) {
        return res.status(400).json({ 
          success: false,
          error: 'modelName is required' 
        });
      }
      
      console.log(`[Ollama] Pulling model: ${modelName}`);
      
      const result = await pullModel(modelName);
      
      if (result.success) {
        return res.json({
          success: true,
          message: `Successfully pulled model: ${modelName}`,
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to pull model',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (err) {
      console.error('[Ollama] Error pulling model:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to pull Ollama model',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Send messages to Ollama
  app.post('/api/ollama/chat', async (req, res) => {
    try {
      const { systemMessage, messages, model, baseUrl } = req.body;
      
      if (!systemMessage || !messages || !Array.isArray(messages)) {
        return res.status(400).json({ 
          success: false,
          error: 'systemMessage and messages array are required' 
        });
      }
      
      // Validate message format
      const validMessages: OllamaMessage[] = messages.map((msg: any) => {
        if (!msg.role || !msg.content) {
          throw new Error('Each message must have role and content');
        }
        if (!['system', 'user', 'assistant'].includes(msg.role)) {
          throw new Error('Message role must be system, user, or assistant');
        }
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: String(msg.content)
        };
      });
      
      console.log(`[Ollama] Sending ${validMessages.length} messages to Ollama`);
      
      const config = {
        ...(model && { model }),
        ...(baseUrl && { baseUrl })
      };
      
      const result = await sendToLLM(systemMessage, validMessages, config);
      
      if (result.success) {
        return res.json({
          success: true,
          content: result.content,
          model: result.model,
          timestamp: result.timestamp
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to get response from Ollama',
          timestamp: result.timestamp
        });
      }
      
    } catch (err) {
      console.error('[Ollama] Error in chat:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to process Ollama chat',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Test Ollama with a simple message
  app.post('/api/ollama/test', async (req, res) => {
    try {
      const { message, model } = req.body;
      
      if (!message) {
        return res.status(400).json({ 
          success: false,
          error: 'message is required' 
        });
      }
      
      console.log(`[Ollama] Testing with message: ${message}`);
      
      const systemMessage = "You are a helpful AI assistant. Respond concisely and helpfully.";
      const messages: OllamaMessage[] = [
        { role: 'user', content: String(message) }
      ];
      
      const config = model ? { model } : undefined;
      const result = await sendToLLM(systemMessage, messages, config);
      
      if (result.success) {
        return res.json({
          success: true,
          response: result.content,
          model: result.model,
          timestamp: result.timestamp
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to get response from Ollama',
          timestamp: result.timestamp
        });
      }
      
    } catch (err) {
      console.error('[Ollama] Error in test:', err);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to test Ollama',
        details: err instanceof Error ? err.message : String(err)
      });
    }
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

  // Per-site chat endpoint with Ollama decision layer
  app.post('/api/:siteId/chat', async (req, res) => {
    try {
      const siteId = String(req.params.siteId || '');
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      if (messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required' });
      }

      const lastUser = [...messages].reverse().find((m: any) => m?.role === 'user' && m?.content);
      if (!lastUser) {
        return res.status(400).json({ error: 'No user message found' });
      }

      const userMessage = extractTextFromMessageContent(lastUser.content);
      console.log(`[Site Chat] Processing user message: ${userMessage}`);

      // Save the user message to history
      appendToHistory([{ role: 'user', content: lastUser.content }], siteId).catch(err =>
        console.error('Failed to append user message to history', err)
      );

      // Step 1: Ask Ollama to determine if this is a coding task
      console.log(`[Site Chat] Step 1: Determining if message requires coding work`);
      console.log(`[Site Chat] User message: ${userMessage}`);
      
      const decisionSystemMessage = `You are an AI assistant for LandingAI. Determine if the user's request is a coding task or a general question. 

      You must respond with ONLY a JSON object in this exact format:
      {"shouldCode": true}

      Set shouldCode to true for ANY request that involves:
      - Adding, removing, or modifying elements (buttons, text, images, etc.)
      - Changing colors, styles, or layout
      - Creating new features or functionality
      - Editing HTML, CSS, or JavaScript
      - Making visual changes to the website

      Set shouldCode to false ONLY for:
      - Questions about existing content
      - Asking for explanations
      - General information requests

      Do not include any other text or explanation.`;
                
      const decisionMessages: OllamaMessage[] = [
        { role: 'user', content: userMessage }
      ];

      console.log(`[Site Chat] Calling sendToLLM with system message and user message`);
      const decisionResult = await sendToLLM(decisionSystemMessage, decisionMessages);
      console.log(`[Site Chat] Decision result:`, decisionResult);
      
      if (!decisionResult.success) {
        console.error('[Site Chat] Failed to get decision from Ollama:', decisionResult.error);
        const assistantMessage = { 
          role: 'assistant', 
          content: 'Sorry, I encountered an issue processing your request. Please try again.' 
        };
        return res.json({ message: assistantMessage });
      }

      // Parse the decision
      let shouldCode = false;
      try {
        let content = decisionResult.content || '{}';
        console.log(`[Site Chat] Raw decision content: ${content}`);
        
        // Remove markdown code blocks if present
        if (content.includes('```json')) {
          content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        
        // Try to extract JSON from the content using regex
        const jsonMatch = content.match(/\{[\s\S]*"shouldCode"[\s\S]*\}/);
        if (jsonMatch) {
          content = jsonMatch[0];
        } else {
          // Try a simpler approach - look for any JSON-like structure
          const simpleJsonMatch = content.match(/\{[^}]*"shouldCode"[^}]*\}/);
          if (simpleJsonMatch) {
            content = simpleJsonMatch[0];
          }
        }
        
        // Clean up any extra text around the JSON
        content = content.trim();
        
        console.log(`[Site Chat] Cleaned content for parsing: ${content}`);
        
        const decisionJson = JSON.parse(content);
        shouldCode = decisionJson.shouldCode === true;
        console.log(`[Site Chat] Decision: shouldCode = ${shouldCode} (parsed JSON: ${JSON.stringify(decisionJson)})`);
      } catch (parseError) {
        console.error('[Site Chat] Failed to parse decision JSON:', decisionResult.content);
        console.error('[Site Chat] Parse error:', parseError);
        // Default to coding if we can't parse the decision
        shouldCode = true;
      }

      // Step 2: Route based on decision
      if (shouldCode) {
        console.log(`[Site Chat] Step 2: Routing to Aider for coding work`);
        
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
      } else {
        console.log(`[Site Chat] Step 2: Routing to Ollama for general question`);
        
        try {
          const result = await processGeneralQuestionWithOllama(messages, siteId);
          return res.json({ 
            message: result,
            reloadIframe: result.reloadIframe 
          });
        } catch (err) {
          console.error('General Chat error:', err);
          console.error('Error details:', JSON.stringify(err, null, 2));
          
          // Provide more specific error messages
          let errorMessage = 'I apologize, but I\'m having trouble processing your question right now. Please try again.';
          if (err && typeof err === 'object' && 'message' in err) {
            const errMsg = String(err.message);
            if (errMsg.includes('No user message found')) {
              errorMessage = 'No user message found in the request.';
            } else if (errMsg.includes('Failed to get response from Ollama')) {
              errorMessage = 'The AI service is temporarily unavailable. Please try again shortly.';
            }
          }
          
          const assistantMessage = { role: 'assistant', content: errorMessage };
          return res.json({ message: assistantMessage, error: 'General Chat error', details: err });
        }
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
