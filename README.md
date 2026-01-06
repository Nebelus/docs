# Nebelus docs & Tutorials

This directory contains example applications and tutorials for working with Nebelus.

> **Last Updated:** 2026-01-06

## 🌐 Live Demos

Visit our GitHub Pages site to try the docs online:
👉 **[https://nebelus.github.io/docs/](https://nebelus.github.io/docs/)**

## Quick Start

Use the Makefile to quickly test any example locally:

```bash
# Show all available commands
make help

# Test vanilla JS translation app
make vanilla-js

# Test Vue translation app
make vue-html

# Check all docs
make test
```

## Directory Structure

```
docs/
├── vanillajs/                      # Vanilla JavaScript translation app example
│   ├── index.html                  # Main HTML file
│   ├── app.js                      # Application logic
│   └── readme.md                   # App-specific documentation
│
├── websocket-chat/                 # WebSocket chat example
│   ├── index.html                  # Main HTML file
│   └── app.js                      # WebSocket client implementation
│
├── sse-chat/                       # SSE (Server-Sent Events) chat example
│   ├── index.html                  # Main HTML file
│   └── app.js                      # SSE streaming implementation
│
└── vue/                            # Vue.js component docs
    └── TranslationApp.vue          # Real-time translation component
```

## docs

### 1. Vanilla JS Translation App
A complete translation application built with vanilla JavaScript.

**Location:** `vanillajs/`

**Features:**
- Pure JavaScript implementation
- No framework dependencies
- Translation functionality
- Ready to use standalone

**Usage:**

Using the Makefile (recommended):
```bash
make vanilla-js
# Opens http://localhost:8080
```

Or manually:
```bash
cd vanillajs
# Open index.html in your browser or serve with:
python3 -m http.server 8080
```

See [vanillajs/readme.md](./vanillajs/readme.md) for detailed documentation.

### 2. WebSocket Chat Example
A complete chat application demonstrating the WebSocket API for real-time bidirectional communication with AI agents.

**Location:** `websocket-chat/`

**Features:**
- Pure WebSocket implementation (no SSE fallback)
- Real-time streaming responses
- Cancel generation support
- Human approval workflow handling
- Tool use and tool result display
- Token usage statistics
- Debug event logging
- Keep-alive ping/pong

**Usage:**

Using the Makefile (recommended):
```bash
make ws-chat
# Opens http://localhost:8082
```

Or manually:
```bash
cd websocket-chat
python3 -m http.server 8082
```

**Configuration:**
1. Enter your WebSocket URL (e.g., `wss://api.nebelus.ai`)
2. Enter your Agent ID (UUID)
3. Enter your API key
4. Optionally enter a Thread ID to continue an existing conversation
5. Click "Connect" to start chatting

### 3. SSE Chat Example
A chat application using Server-Sent Events (SSE) for streaming AI responses. This is a simpler alternative to WebSocket for request/response patterns.

**Location:** `sse-chat/`

**Features:**
- HTTP POST + SSE streaming (simpler than WebSocket)
- Works through proxies and firewalls
- Token-based authentication via Authorization header
- Real-time streaming responses
- Cancel request support
- Token usage statistics
- Debug event logging

**Usage:**

Using the Makefile (recommended):
```bash
make sse-chat
# Opens http://localhost:8083
```

Or manually:
```bash
cd sse-chat
python3 -m http.server 8083
```

**Configuration:**
1. Enter your API URL (e.g., `https://api.nebelus.ai`)
2. Enter your Agent ID (UUID)
3. Enter your API key
4. Optionally enter a Thread ID to continue an existing conversation
5. Start chatting!

**SSE vs WebSocket:**

| Feature | SSE Chat | WebSocket Chat |
|---------|----------|----------------|
| Protocol | HTTP POST + SSE | WebSocket |
| Connection | Per-request | Persistent bidirectional |
| Auth | `Authorization: Bearer` header | `?api_key=` query param |
| Complexity | Simpler | More complex |
| Use case | Request/response chat | Real-time push, voice |

### 4. Vue Component docs
Vue.js component docs demonstrating Nebelus integration.

**Location:** `vue/`

**Components:**

#### TranslationApp.vue
Real-time bidirectional voice translation component using WebSocket API.

**Features:**
- Real-time audio streaming (16-bit PCM @ 16kHz)
- Bidirectional translation with speaker diarization
- Text-to-Speech (TTS) playback
- Language pair configuration
- Session management
- Translation history display
- Debug event logging

**Usage:**
```vue
<template>
  <TranslationApp default-api-url="wss://api.nebelus.ai" />
</template>

<script setup>
import TranslationApp from '@/docs/vue/TranslationApp.vue'
</script>
```

**Props:**
- `defaultApiUrl` (String, optional) - Default WebSocket URL (default: `wss://api.nebelus.ai`)

**Requirements:**
- Microphone access (browser will prompt user)
- HTTPS or localhost (required for getUserMedia)
- Valid Nebelus API key

## WebSocket API Usage

The Nebelus WebSocket API provides real-time bidirectional communication with AI agents. Below are docs showing how to connect and interact with agents via WebSocket.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `ws/agents/<agent_id>/chat/` | Create new thread and start chatting |
| `ws/agents/<agent_id>/threads/<thread_id>/` | Continue existing thread |
| `ws/agents/<agent_id>/threads/<thread_id>/completions/` | Stream completions on thread |

### Authentication

**Option 1: Headers (Recommended for Python/Node.js)**
```python
# Python (websockets library)
async with websockets.connect(
    uri,
    additional_headers={"Authorization": f"{api_key}"}
) as ws:
    ...
```

**Option 2: Query Parameters (Required for Browser WebSocket)**
```
wss://api.nebelus.ai/ws/agents/{agent_id}/chat/?api_key={api_key}
```

### Python Example

```python
import asyncio
import json
import websockets


async def chat_with_agent():
    uri = "wss://api.nebelus.ai/ws/agents/<agent_id>/threads/<thread_id>/"
    api_key = "sk-ns-org-..."

    async with websockets.connect(
        uri,
        additional_headers={"Authorization": f"{api_key}"}
    ) as wss:
        # Wait for connection event
        msg = json.loads(await wss.recv())
        if msg["event"] == "connection":
            print(f"Connected! Thread: {msg['data']['thread_id']}")

        # Send message
        await wss.send(json.dumps({
            "type": "chat",
            "content": "Hello, how can you help me?"
        }))

        # Receive streaming response
        async for message in wss:
            msg = json.loads(message)

            if msg["event"] == "content_block":
                if msg["data"]["state"] == "delta":
                    print(msg["data"]["data"]["text"], end="", flush=True)

            elif msg["event"] == "message_stop":
                print("\nResponse complete")
                break

            elif msg["event"] == "error":
                print(f"Error: {msg['data']['message']}")
                break


asyncio.run(chat_with_agent())
```

### JavaScript Example (Browser)
```javascript
const apiKey = 'your-api-key';
const agentId = 'agent-uuid';

// Connect to create a new thread
const ws = new WebSocket(
  `wss://api.nebelus.ai/ws/agents/${agentId}/chat/?api_key=${apiKey}`
);

ws.onopen = () => {
  console.log('Connected to agent');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.event) {
    case 'connection':
      console.log('Thread ID:', message.data.thread_id);
      // Send first message after connection
      ws.send(JSON.stringify({
        type: 'chat',
        content: 'Hello!'
      }));
      break;

    case 'message_start':
      console.log('Assistant is responding...');
      break;

    case 'content_block':
      if (message.data.content_type === 'text' && message.data.state === 'delta') {
        // Stream text as it arrives
        process.stdout.write(message.data.data.text);
      }
      break;

    case 'message_stop':
      console.log('\n--- Response complete ---');
      break;

    case 'error':
      console.error('Error:', message.data.message);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Disconnected:', event.code);
};
```

### Client Messages

**Send a chat message:**
```javascript
ws.send(JSON.stringify({
  type: 'chat',
  content: 'What is the weather like today?',
  metadata: {
    attachments: [] // optional file attachments
  }
}));
```

**Cancel ongoing generation:**
```javascript
ws.send(JSON.stringify({
  type: 'cancel'
}));
```

**Keep-alive ping:**
```javascript
// Send ping every 30 seconds to maintain connection
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

**Resume after human approval interrupt:**
```javascript
ws.send(JSON.stringify({
  type: 'interrupt_resume',
  decisions: [
    { type: 'approve' }  // or 'reject' or { type: 'edit', modified_args: {...} }
  ]
}));
```

### Server Events

| Event | Description |
|-------|-------------|
| `connection` | Connection established, contains `thread_id` |
| `message_start` | Assistant response beginning |
| `content_block` | Streaming content (text, tool_use, tool_result, etc.) |
| `message_stop` | Response complete |
| `usage_metadata` | Token usage statistics |
| `human_approval` | Workflow paused for user decision |
| `cancel_acknowledged` | Cancel request received |
| `pong` | Response to ping |
| `error` | Error notification |

### Content Block States

Content blocks stream through three states:

1. **start** - Block initialized with type and index
2. **delta** - Incremental content updates (for text/thinking)
3. **complete** - Block finished

```javascript
// Example: Accumulating streamed text
let responseText = '';

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.event === 'content_block') {
    const { content_type, state, data } = msg.data;

    if (content_type === 'text') {
      if (state === 'delta') {
        responseText += data.text;
        updateUI(responseText);
      } else if (state === 'complete') {
        console.log('Text block complete');
      }
    }
  }
};
```

### React Hook Example

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAgentChat(agentId: string, apiKey: string) {
  const ws = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const streamBuffer = useRef('');

  useEffect(() => {
    const socket = new WebSocket(
      `wss://api.nebelus.ai/ws/agents/${agentId}/chat/?api_key=${apiKey}`
    );

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.event) {
        case 'connection':
          setThreadId(msg.data.thread_id);
          break;

        case 'message_start':
          setIsStreaming(true);
          streamBuffer.current = '';
          break;

        case 'content_block':
          if (msg.data.content_type === 'text' && msg.data.state === 'delta') {
            streamBuffer.current += msg.data.data.text;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...last,
                  content: streamBuffer.current
                };
              } else {
                updated.push({ role: 'assistant', content: streamBuffer.current });
              }
              return updated;
            });
          }
          break;

        case 'message_stop':
          setIsStreaming(false);
          break;
      }
    };

    ws.current = socket;
    return () => socket.close();
  }, [agentId, apiKey]);

  const sendMessage = useCallback((content: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      setMessages(prev => [...prev, { role: 'user', content }]);
      ws.current.send(JSON.stringify({ type: 'chat', content }));
    }
  }, []);

  const cancel = useCallback(() => {
    ws.current?.send(JSON.stringify({ type: 'cancel' }));
  }, []);

  return { messages, sendMessage, cancel, isStreaming, threadId };
}
```

### Best Practices

1. **Keep-Alive**: Send `ping` every 30 seconds to prevent timeout
2. **Reconnection**: Implement exponential backoff for reconnects
3. **Thread Persistence**: Store `thread_id` to resume conversations
4. **Error Handling**: Always handle `error` events gracefully
5. **Cancellation**: Use `cancel` for long responses when needed
6. **Token Refresh**: Reconnect with new token before expiry

For complete API documentation, see the [WebSocket API Reference](./ws-chat/readme.md).

## SSE API Usage

The SSE (Server-Sent Events) API provides a simpler alternative to WebSocket for request/response chat patterns. Instead of maintaining a persistent connection, each message is sent as an HTTP POST request with the response streamed back as SSE events.

### Endpoint

```
POST https://api.nebelus.ai/api/agents/{agent_id}/chat/
```

Optional query parameter: `?thread_id={thread_id}` to continue an existing conversation.

### Authentication

Include your API key in the Authorization header:

```
Authorization: Bearer {api_key}
```

### Basic JavaScript Example

```javascript
const apiKey = 'your-api-key';
const agentId = 'agent-uuid';

async function sendMessage(content) {
  const response = await fetch(
    `https://api.nebelus.ai/api/agents/${agentId}/chat/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content }]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split('\n\n');
    buffer = messages.pop() || '';

    for (const message of messages) {
      if (!message.trim()) continue;

      const lines = message.split('\n');
      let eventType = '';
      let eventData = null;

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            eventData = JSON.parse(line.slice(6).trim());
          } catch (e) {}
        }
      }

      if (eventType === 'content_block' && eventData?.state === 'delta') {
        fullContent += eventData.data?.text || '';
        console.log('Streaming:', fullContent);
      }
    }
  }

  return fullContent;
}

// Usage
sendMessage('Hello!').then(response => {
  console.log('Final response:', response);
});
```

### SSE Events

| Event | Description |
|-------|-------------|
| `message_start` | Response beginning, may contain `thread_id` |
| `content_block` | Streaming content with states: start, delta, complete |
| `message_stop` | Response complete |
| `message_delta` | Metadata updates (stop_reason) |
| `usage_metadata` | Token usage statistics |
| `error` | Error notification |

### Cancellation

Use `AbortController` to cancel an in-progress request:

```javascript
const controller = new AbortController();

// Start request
fetch(endpoint, {
  ...options,
  signal: controller.signal
});

// Cancel when needed
controller.abort();
```

### Best Practices

1. **Use SSE for simple chat**: When you only need request/response, SSE is simpler than WebSocket
2. **Use WebSocket for real-time**: When you need server push (voice, notifications), use WebSocket
3. **Thread persistence**: Store `thread_id` from `message_start` to continue conversations
4. **Error handling**: Check response status and handle SSE parsing errors
5. **Cancellation**: Always support cancellation for better UX

## Contributing

When adding new docs:
1. Create a descriptive directory name
2. Include a README.md explaining the example
3. Keep docs self-contained and well-documented
4. Add your example to this main README

## 🚀 Deployment

This repository is automatically deployed to GitHub Pages on every push to the main branch.

### Setting up GitHub Pages

1. Go to your repository settings
2. Navigate to **Pages** section
3. Under **Source**, select **GitHub Actions**
4. The workflow in `.github/workflows/deploy.yml` will handle deployment

Your docs will be available at: `https://<username>.github.io/docs/`

### Local Preview

Test the landing page locally:
```bash
# Serve the landing page
python3 -m http.server 8080

# Then visit http://localhost:8080
```

## 📦 Repository Structure

```
docs/
├── index.html                   # Landing page (GitHub Pages home)
├── .github/
│   └── workflows/
│       └── deploy.yml           # Auto-deployment to GitHub Pages
├── vanillajs/                   # Vanilla JavaScript docs
├── vue/                         # Vue.js docs
├── Makefile                     # Helper commands
└── README.md                    # This file
```

## License

These docs are provided as-is for educational and demonstration purposes.

<!-- Updated: Tue Jan  6 06:24:07 +03 2026 -->
