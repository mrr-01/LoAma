# Ollama API Reference

## Available Endpoints (relevant to us)

### GET /api/tags
Returns list of installed models
Response: {"models": [{"name": "mistral:latest", ...}, ...]}

### POST /api/generate
Sends prompt to model, gets response
Body: {
  "model": "mistral:latest",
  "prompt": "Your prompt",
  "stream": false,
  "temperature": 0.7
}
Response (stream=false): {
  "response": "The full response text",
  "context": [token ids],
  "done": true
}

## Key Learning
- Ollama is synchronous (waits for full response if stream=false)
- We should support streaming for better UX
- Context contains token history (for conversation continuation)

## Error Handling
- Connection refused → Ollama not running
- 404 model not found → need to `ollama pull mistral` first
