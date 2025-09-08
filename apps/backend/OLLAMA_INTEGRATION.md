# Ollama Integration

This backend now includes integration with Ollama for local LLM inference.

## Features

- **Local LLM Support**: Use Ollama models instead of OpenAI for local development
- **Model Management**: Pull, list, and manage Ollama models
- **Chat Interface**: Send messages to Ollama models with system prompts
- **Flexible Configuration**: Configure base URL, model, and timeout settings

## Setup

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Or download from https://ollama.ai
```

### 2. Start Ollama

```bash
ollama serve
```

### 3. Pull a Model

```bash
# Pull a popular model (e.g., llama2)
ollama pull llama2

# Or pull other models
ollama pull codellama
ollama pull mistral
```

## API Endpoints

### Get Available Models
```http
GET /api/ollama/models
```

**Response:**
```json
{
  "success": true,
  "models": ["llama2", "codellama", "mistral"],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test Ollama Connection
```http
POST /api/ollama/test
Content-Type: application/json

{
  "message": "Hello, how are you?",
  "model": "llama2"
}
```

**Response:**
```json
{
  "success": true,
  "response": "Hello! I'm doing well, thank you for asking...",
  "model": "llama2",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Send Chat Messages
```http
POST /api/ollama/chat
Content-Type: application/json

{
  "systemMessage": "You are a helpful assistant.",
  "messages": [
    { "role": "user", "content": "What is TypeScript?" }
  ],
  "model": "llama2",
  "baseUrl": "http://localhost:11434"
}
```

**Response:**
```json
{
  "success": true,
  "content": "TypeScript is a programming language...",
  "model": "llama2",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Pull a Model
```http
POST /api/ollama/pull
Content-Type: application/json

{
  "modelName": "llama2"
}
```

## Usage in Code

### Basic Usage

```typescript
import { sendToLLM, OllamaMessage } from './utils/llm_runner';

const systemMessage = "You are a helpful assistant.";
const messages: OllamaMessage[] = [
  { role: 'user', content: 'Hello!' }
];

const result = await sendToLLM(systemMessage, messages);
if (result.success) {
  console.log('Response:', result.content);
}
```

### Advanced Usage with Configuration

```typescript
import { OllamaRunner } from './utils/llm_runner';

const runner = new OllamaRunner({
  baseUrl: 'http://localhost:11434',
  model: 'codellama',
  timeout: 60000
});

const result = await runner.sendToLLM(systemMessage, messages);
```

## Configuration

The Ollama integration can be configured with:

- **baseUrl**: Ollama server URL (default: `http://localhost:11434`)
- **model**: Default model to use (default: `llama2`)
- **timeout**: Request timeout in milliseconds (default: `30000`)

## Testing

Run the test script to verify Ollama integration:

```bash
# Start the backend server first
npm run dev

# In another terminal, run the test
node test-ollama.js
```

## Error Handling

The integration includes comprehensive error handling:

- **Connection errors**: When Ollama is not running
- **Model errors**: When specified model is not available
- **Timeout errors**: When requests take too long
- **Validation errors**: When message format is invalid

## Integration with Existing Features

The Ollama integration can be used alongside or instead of:

- **OpenAI integration**: Switch between OpenAI and Ollama
- **Aider integration**: Use Ollama for AI-powered code changes
- **Site management**: Generate content using local models

## Troubleshooting

### Ollama not running
```
Error: Ollama is not running. Please start Ollama first.
```
**Solution**: Run `ollama serve` in a terminal

### Model not found
```
Error: Model 'llama2' not found
```
**Solution**: Pull the model with `ollama pull llama2`

### Connection refused
```
Error: fetch failed
```
**Solution**: Check if Ollama is running on the correct port (default: 11434)

## Performance Notes

- **First request**: May be slower as the model loads
- **Memory usage**: Models require significant RAM
- **Response time**: Depends on model size and hardware
- **Concurrent requests**: Ollama handles multiple requests efficiently
