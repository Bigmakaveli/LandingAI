// Cloud Ollama service integration
// This provides an alternative when local Ollama is not available

export interface CloudOllamaConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class CloudOllamaService {
  private config: CloudOllamaConfig;

  constructor(config: CloudOllamaConfig = {}) {
    this.config = {
      baseUrl: process.env.CLOUD_OLLAMA_URL || 'https://api.ollama.ai/v1',
      model: process.env.CLOUD_OLLAMA_MODEL || 'gpt-oss:20b',
      ...config
    };
  }

  async sendToLLM(systemMessage: string, messages: any[]): Promise<any> {
    try {
      console.log(`[Cloud Ollama] Sending ${messages.length} messages to cloud service`);
      
      const response = await fetch(`${this.config.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemMessage },
            ...messages
          ],
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Cloud Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.message?.content || data.choices?.[0]?.message?.content || 'No response generated',
        model: this.config.model,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[Cloud Ollama] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export a default instance
export const cloudOllamaService = new CloudOllamaService();
