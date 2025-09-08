import { spawn } from 'child_process';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaResponse {
  success: boolean;
  content?: string;
  error?: string;
  model?: string;
  timestamp?: string;
}

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  timeout?: number;
}

export class OllamaRunner {
  private config: OllamaConfig;

  constructor(config: OllamaConfig = {}) {
    this.config = {
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5:7b-instruct',
      timeout: 30000, // 30 seconds
      ...config
    };
  }

  /**
   * Send messages to Ollama model
   * @param systemMessage - System message to set context
   * @param messages - Array of conversation messages
   * @returns Promise with Ollama response
   */
  async sendToLLM(systemMessage: string, messages: OllamaMessage[]): Promise<OllamaResponse> {
    try {
      console.log(`[Ollama] Sending ${messages.length} messages to model: ${this.config.model}`);
      console.log(`[Ollama] System message: ${systemMessage}`);
      
      // Check if Ollama is running
      const isRunning = await this.checkOllamaStatus();
      if (!isRunning) {
        throw new Error('Ollama is not running. Please start Ollama first.');
      }

      // Prepare the request payload
      const payload = {
        model: this.config.model,
        messages: [
          { role: 'system', content: systemMessage },
          ...messages
        ],
        stream: false
      };

      // Make the request to Ollama
      const response = await this.makeOllamaRequest(payload);
      
      if (response.success) {
        console.log(`[Ollama] Successfully received response from ${this.config.model}`);
        return {
          success: true,
          content: response.content,
          model: this.config.model,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.error || 'Unknown error from Ollama');
      }

    } catch (error) {
      console.error(`[Ollama] Error sending to LLM:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if Ollama is running and accessible
   */
  private async checkOllamaStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      console.log(`[Ollama] Ollama not accessible: ${error}`);
      return false;
    }
  }

  /**
   * Make a request to Ollama API
   */
  private async makeOllamaRequest(payload: any): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.message && data.message.content) {
        return {
          success: true,
          content: data.message.content
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

  /**
   * Get available models from Ollama
   */
  async getAvailableModels(): Promise<{ success: boolean; models?: string[]; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models?.map((model: any) => model.name) || [];
      
      return {
        success: true,
        models
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Pull a model from Ollama
   */
  async pullModel(modelName: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[Ollama] Pulling model: ${modelName}`);
      
      const response = await fetch(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // For pull operations, we need to handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let result = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        result += chunk;
        
        // Log progress
        try {
          const lines = chunk.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const data = JSON.parse(line);
            if (data.status) {
              console.log(`[Ollama] Pull status: ${data.status}`);
            }
          }
        } catch (e) {
          // Ignore JSON parse errors for streaming
        }
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Update the model configuration
   */
  updateConfig(newConfig: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log(`[Ollama] Updated config:`, this.config);
  }
}

// Export a default instance
export const ollamaRunner = new OllamaRunner();

// Export utility functions for easy use
export async function sendToLLM(systemMessage: string, messages: OllamaMessage[], config?: OllamaConfig): Promise<OllamaResponse> {
  const runner = config ? new OllamaRunner(config) : ollamaRunner;
  return runner.sendToLLM(systemMessage, messages);
}

export async function getAvailableModels(config?: OllamaConfig): Promise<{ success: boolean; models?: string[]; error?: string }> {
  const runner = config ? new OllamaRunner(config) : ollamaRunner;
  return runner.getAvailableModels();
}

export async function pullModel(modelName: string, config?: OllamaConfig): Promise<{ success: boolean; error?: string }> {
  const runner = config ? new OllamaRunner(config) : ollamaRunner;
  return runner.pullModel(modelName);
}
