# OpenAI SDK Migration

This document describes the migration from HTTP fetch to OpenAI SDK and the implementation of vector store functionality.

## Changes Made

### 1. Replaced HTTP Fetch with OpenAI SDK

- **Before**: Used manual HTTP fetch calls to OpenAI's Responses API
- **After**: Uses OpenAI SDK (`openai.chat.completions.create()`) for chat completions

### 2. Vector Store Integration

- Added vector store management functions using `openai.beta.vectorStores`
- Implemented file search functionality through tools in chat completions
- Added REST API endpoints for vector store operations

## New API Endpoints

### Vector Store Management

- `POST /api/vector-stores` - Create a new vector store
- `GET /api/vector-stores` - List all vector stores
- `POST /api/vector-stores/:id/upload` - Upload files to a vector store
- `POST /api/vector-stores/:id/search` - Search a vector store

### Chat with Vector Store

- `POST /api/:siteId/chat` - Chat endpoint now uses OpenAI SDK with vector store tools

## Configuration

Update `apps/backend/src/config.ts`:

```typescript
export const OPENAI_CONFIG = {
  API_KEY: process.env.OPENAI_API_KEY || "your-api-key-here",
  DEFAULT_MODEL: 'gpt-5',
  DEFAULT_TEMPERATURE: 0.1,
  SITE_SPECIFIC_TEMPERATURE: 0.7,
  VECTOR_STORE_ID: 'vs_68b36b2477cc8191b39961595bfa7434',
};
```

## Vector Store Tools

The chat endpoint now includes a `file_search` tool that allows the AI to search through vector stores:

```typescript
tools: [
  {
    type: "function",
    function: {
      name: "file_search",
      description: "Search for relevant files in the vector store",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query"
          }
        },
        required: ["query"]
      }
    }
  }
]
```

## Current Implementation Status

### ✅ Completed
- OpenAI SDK integration for chat completions
- Vector store API endpoints
- Mock vector store functionality
- Tool-based file search integration

### 🔄 TODO (When OpenAI SDK Supports vectorStores.beta)
- Replace mock vector store implementations with real API calls
- Enable actual file uploads to vector stores
- Implement real vector store search functionality

## Usage Example

### Creating a Vector Store
```bash
curl -X POST http://localhost:3000/api/vector-stores \
  -H "Content-Type: application/json" \
  -d '{"name": "My Store", "description": "Store for my documents"}'
```

### Chatting with Vector Store Context
```bash
curl -X POST http://localhost:3000/api/mysite/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Search for information about API documentation"}
    ]
  }'
```

## Benefits of Migration

1. **Better Error Handling**: OpenAI SDK provides better error handling and retry logic
2. **Type Safety**: Full TypeScript support with proper types
3. **Maintainability**: Cleaner, more maintainable code
4. **Vector Store Integration**: Native support for vector store operations
5. **Future-Proof**: Ready for upcoming OpenAI features and improvements

## Troubleshooting

### Common Issues

1. **API Key**: Ensure `OPENAI_API_KEY` is set in environment or config
2. **Model Availability**: Verify the specified model is available in your OpenAI account
3. **Vector Store API**: Current implementation uses mock data until `vectorStores.beta` is available

### Debugging

Enable detailed logging by checking console output for:
- `[Site Chat] Using OpenAI SDK with model: ...`
- `[Site Chat] Vector Store ID: ...`
- `[Site Chat] OpenAI SDK Response: ...`
