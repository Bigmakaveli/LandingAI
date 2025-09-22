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

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: { url: string };
  }>;
}

export interface OpenAIResponse {
  success: boolean;
  error?: string;
  model?: string;
  timestamp?: string;
  should_code?: boolean;
  prompt_for_code?: string;
  response_for_message?: string;
}

export interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeout?: number;
}

export class OpenAIRunner {
  /**
   * Send messages to OpenAI model
   * @param systemMessage - System message to set context
   * @param messages - Array of conversation messages
   * @param config - OpenAI configuration
   * @returns Promise with OpenAI response
   */
  async sendToOpenAI(systemMessage: string, messages: OpenAIMessage[], config: OpenAIConfig = {}): Promise<OpenAIResponse> {
    try {
      const apiKey = config.apiKey || OPENAI_CONFIG.API_KEY;
      if (!apiKey) {
        throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass it in config.');
      }

      const model = config.model || OPENAI_CONFIG.DEFAULT_MODEL;
      const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
      const timeout = config.timeout || 120000; // 2 minutes

      log.request('OpenAI', `Sending ${messages.length} messages to ${model}`);

      // Prepare the request payload
      const payload = {
        model: model,
        messages: [
          { role: 'system', content: systemMessage },
          ...messages
        ],
      };

      // Debug: Log the payload to see what's being sent
      log.step('OpenAI', 'Sending request');

      // Make the request to OpenAI
      const response = await this.makeOpenAIRequest(payload, apiKey, baseUrl, timeout);
      
      if (response.success) {
        log.result('OpenAI', true, 'Response received');
        
        // Try to extract should_code, prompt_for_code, and response_for_message from the response content
        let shouldCode: boolean | undefined = undefined;
        let promptForCode: string | undefined = undefined;
        let responseForMessage: string | undefined = undefined;
        if (response.content) {
          try {
            let content = response.content;
            
            // Remove markdown code blocks if present
            if (content.includes('```json')) {
              content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            } else if (content.includes('```')) {
              content = content.replace(/```\n?/g, '').trim();
            }
            
            // Try to extract JSON from the content using regex
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              content = jsonMatch[0];
            }
            
            const parsed = JSON.parse(content);
            shouldCode = parsed.should_code;
            promptForCode = parsed.prompt_for_code;
            responseForMessage = parsed.response_for_message;
            log.step('OpenAI', 'Extracted JSON fields');
          } catch (parseError) {
            shouldCode = false;
            promptForCode = "";
            responseForMessage = response.content;
          }
        }
        
        return {
          success: true,
          model: model,
          timestamp: new Date().toISOString(),
          should_code: shouldCode,
          prompt_for_code: promptForCode,
          response_for_message: responseForMessage
        };
      } else {
        throw new Error(response.error || 'Unknown error from OpenAI');
      }

    } catch (error) {
      log.error('OpenAI', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Make a request to OpenAI API
   */
  private async makeOpenAIRequest(payload: any, apiKey: string, baseUrl: string, timeout: number): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        return {
          success: true,
          content: data.choices[0].message.content
        };
      } else {
        return {
          success: false,
          error: 'No content in response'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export a default instance
export const openAIRunner = new OpenAIRunner();

// Export utility functions for easy use
export async function sendToOpenAI(systemMessage: string, messages: OpenAIMessage[], config?: OpenAIConfig): Promise<OpenAIResponse> {
  const runner = new OpenAIRunner();
  return await runner.sendToOpenAI(systemMessage, messages, config);
}
