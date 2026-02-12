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
├── ws-chat/                 # WebSocket chat example
│   ├── index.html                  # Main HTML file
│   └── app.js                      # WebSocket client implementation
│
├── sse-chat/                       # SSE (Server-Sent Events) chat example
│   ├── index.html                  # Main HTML file
│   └── app.js                      # SSE streaming implementation
│
├── thread-id-usage.md              # Guide to thread ID usage for WS and SSE
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

**Location:** `ws-chat/`

**Features:**
- Pure WebSocket implementation (no SSE fallback)
- Real-time streaming responses
- Cancel generation support
- Human approval workflow handling
- Tool use and tool result display
- Token usage statistics
- Debug event logging
- Keep-alive ping/pong
- **Interactive code snippets** with copy buttons (Connection, Send, Events, Cancel, Human Approval)

**Usage:**

Using the Makefile (recommended):
```bash
make ws-chat
# Opens http://localhost:8082
```

Or manually:
```bash
cd ws-chat
python3 -m http.server 8082
```

**Configuration:**
1. Enter your WebSocket URL (e.g., `wss://api.nebelus.ai`)
2. Enter your Agent ID (UUID)
3. Enter your API key
4. Optionally enter a Thread ID to continue an existing conversation
5. Click "Connect" to start chatting

See [vanillajs/readme.md](./vanillajs/readme.md) for detailed documentation.

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
- **Interactive code snippets** with copy buttons (Connection, Send, Events, Cancel, Full Example)

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
    attachments: [] // optional file attachments (see File Attachments section below)
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

### File Attachments

You can attach files to your chat messages by including them in the `metadata.attachments` array. Files must be base64-encoded.

**Supported File Types:**
- Documents: PDF, TXT, DOC, DOCX
- Images: PNG, JPG, JPEG, GIF, WEBP
- Code: JS, PY, TS, JSON, XML, HTML, CSS
- Data: CSV, XLS, XLSX

**JavaScript Example (File Upload):**
```javascript
// Function to convert file to base64
function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			// Extract base64 data (remove data:type/subtype;base64, prefix)
			const base64 = reader.result.split(',')[1];
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

// Handle file input
document.getElementById('fileInput').addEventListener('change', async (event) => {
	const file = event.target.files[0];
	if (!file) return;

	// Convert file to base64
	const base64Content = await fileToBase64(file);

	// Send message with file attachment
	ws.send(JSON.stringify({
		type: 'chat',
		content: 'Can you analyze this file?',
		metadata: {
			attachments: [{
				name: file.name,
				content_type: file.type,
				data: base64Content
			}]
		}
	}));
});
```

**Python Example (File Upload):**
```python
import base64
import json

def send_message_with_file(ws, message, file_path):
	# Read and encode file
	with open(file_path, 'rb') as f:
		file_data = base64.b64encode(f.read()).decode('utf-8')

	# Get file info
	import os
	import mimetypes
	file_name = os.path.basename(file_path)
	content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'

	# Send message with attachment
	ws.send(json.dumps({
		'type': 'chat',
		'content': message,
		'metadata': {
			'attachments': [{
				'name': file_name,
				'content_type': content_type,
				'data': file_data
			}]
		}
	}))

# Usage
send_message_with_file(ws, 'Please review this document', '/path/to/document.pdf')
```

**Multiple Files:**
```javascript
// Send multiple files at once
ws.send(JSON.stringify({
	type: 'chat',
	content: 'Compare these two documents',
	metadata: {
		attachments: [
			{
				name: 'document1.pdf',
				content_type: 'application/pdf',
				data: base64Data1
			},
			{
				name: 'document2.pdf',
				content_type: 'application/pdf',
				data: base64Data2
			}
		]
	}
}));
```

**Image Analysis Example:**
```javascript
// Upload and analyze an image
const imageFile = event.target.files[0];
const base64Image = await fileToBase64(imageFile);

ws.send(JSON.stringify({
	type: 'chat',
	content: 'What objects do you see in this image?',
	metadata: {
		attachments: [{
			name: imageFile.name,
			content_type: imageFile.type, // e.g., 'image/png'
			data: base64Image
		}]
	}
}));
```

**File Size Limits:**
- Maximum file size: 10 MB per file
- Maximum total attachment size per message: 25 MB
- For larger files, consider splitting or using external storage with URLs

### Resuming a Thread

To continue a previous conversation, use the thread-specific endpoint with your stored thread ID:

**JavaScript Example:**
```javascript
// Store thread ID when you first connect
let currentThreadId = null;

// Initial connection
const ws = new WebSocket(
	`wss://api.nebelus.ai/ws/agents/${agentId}/chat/?api_key=${apiKey}`
);

ws.onmessage = (event) => {
	const msg = JSON.parse(event.data);

	if (msg.event === 'connection') {
		// Save the thread ID for later use
		currentThreadId = msg.data.thread_id;
		localStorage.setItem('nebelus_thread_id', currentThreadId);
		console.log('New thread created:', currentThreadId);
	}
};

// Later: Resume the conversation
function resumeThread(threadId) {
	const ws = new WebSocket(
		`wss://api.nebelus.ai/ws/agents/${agentId}/threads/${threadId}/?api_key=${apiKey}`
	);

	ws.onopen = () => {
		console.log('Resumed thread:', threadId);
		// You can now continue the conversation
		ws.send(JSON.stringify({
			type: 'chat',
			content: 'Continuing our previous conversation...'
		}));
	};

	return ws;
}

// Resume the saved thread
const savedThreadId = localStorage.getItem('nebelus_thread_id');
if (savedThreadId) {
	resumeThread(savedThreadId);
}
```

**Python Example:**
```python
import asyncio
import json
import websockets

async def resume_thread(agent_id, thread_id, api_key):
	# Connect to existing thread
	uri = f"wss://api.nebelus.ai/ws/agents/{agent_id}/threads/{thread_id}/"

	async with websockets.connect(
		uri,
		additional_headers={"Authorization": f"{api_key}"}
	) as wss:
		# Wait for connection event
		msg = json.loads(await wss.recv())
		if msg["event"] == "connection":
			print(f"Resumed thread: {msg['data']['thread_id']}")

			# Continue conversation
			await wss.send(json.dumps({
				"type": "chat",
				"content": "Let's continue where we left off"
			}))

			# Handle responses...
			async for message in wss:
				msg = json.loads(message)
				# Process messages...

# Usage
thread_id = "saved_thread_id_from_previous_session"
asyncio.run(resume_thread(agent_id, thread_id, api_key))
```

For more details on thread management, see the [Thread ID Usage Guide](./thread-id-usage.md).

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
3. **Thread Persistence**: Store `thread_id` to resume conversations (see [Thread ID Usage Guide](./thread-id-usage.md))
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

### File Attachments with SSE

You can include file attachments in your SSE requests by adding them to the messages array:

```javascript
async function sendMessageWithFile(content, file) {
	// Convert file to base64
	const base64Data = await new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => {
			const base64 = reader.result.split(',')[1];
			resolve(base64);
		};
		reader.readAsDataURL(file);
	});

	// Prepare request with attachment
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
				messages: [{
					role: 'user',
					content: content,
					metadata: {
						attachments: [{
							name: file.name,
							content_type: file.type,
							data: base64Data
						}]
					}
				}]
			})
		}
	);

	// Process SSE response...
}

// Usage with file input
document.getElementById('fileInput').addEventListener('change', async (event) => {
	const file = event.target.files[0];
	await sendMessageWithFile('Can you analyze this document?', file);
});
```

**Python Example with File:**
```python
import base64
import requests
import json

def send_sse_with_file(agent_id, api_key, message, file_path):
	# Read and encode file
	with open(file_path, 'rb') as f:
		file_data = base64.b64encode(f.read()).decode('utf-8')

	# Get file info
	import os
	import mimetypes
	file_name = os.path.basename(file_path)
	content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'

	# Prepare request
	url = f"https://api.nebelus.ai/api/agents/{agent_id}/chat/"
	headers = {
		"Authorization": f"Bearer {api_key}",
		"Content-Type": "application/json",
		"Accept": "text/event-stream"
	}
	data = {
		"messages": [{
			"role": "user",
			"content": message,
			"metadata": {
				"attachments": [{
					"name": file_name,
					"content_type": content_type,
					"data": file_data
				}]
			}
		}]
	}

	# Send request with streaming
	response = requests.post(url, headers=headers, json=data, stream=True)

	# Process SSE events...
	for line in response.iter_lines():
		if line:
			# Parse SSE events
			pass

# Usage
send_sse_with_file(agent_id, api_key, "Review this document", "document.pdf")
```

### Resuming Threads with SSE

To continue a conversation, include the `thread_id` in your request body:

**JavaScript Example:**
```javascript
async function sendMessageToThread(content, threadId) {
	const requestBody = {
		messages: [{ role: 'user', content }]
	};

	// Include thread_id to continue existing conversation
	if (threadId) {
		requestBody.thread_id = threadId;
	}

	const response = await fetch(
		`https://api.nebelus.ai/api/agents/${agentId}/chat/`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'text/event-stream',
				'Authorization': `Bearer ${apiKey}`
			},
			body: JSON.stringify(requestBody)
		}
	);

	// Process SSE response and extract thread_id from message_start event
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const messages = buffer.split('\n\n');
		buffer = messages.pop() || '';

		for (const message of messages) {
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

			// Save thread_id from first message
			if (eventType === 'message_start' && eventData?.thread_id) {
				localStorage.setItem('nebelus_thread_id', eventData.thread_id);
				console.log('Thread ID:', eventData.thread_id);
			}
		}
	}
}

// Start new conversation
await sendMessageToThread('Hello!', null);

// Continue conversation
const savedThreadId = localStorage.getItem('nebelus_thread_id');
await sendMessageToThread('Follow-up question', savedThreadId);
```

**Python Example:**
```python
def send_sse_message(agent_id, api_key, message, thread_id=None):
	url = f"https://api.nebelus.ai/api/agents/{agent_id}/chat/"
	headers = {
		"Authorization": f"Bearer {api_key}",
		"Content-Type": "application/json",
		"Accept": "text/event-stream"
	}

	# Build request body
	data = {
		"messages": [{"role": "user", "content": message}]
	}

	# Include thread_id for continuation
	if thread_id:
		data["thread_id"] = thread_id

	response = requests.post(url, headers=headers, json=data, stream=True)

	# Process and extract thread_id
	for line in response.iter_lines():
		if line:
			line_str = line.decode('utf-8')
			if line_str.startswith('data: '):
				try:
					event_data = json.loads(line_str[6:])
					if 'thread_id' in event_data:
						return event_data['thread_id']
				except:
					pass

# Usage
thread_id = send_sse_message(agent_id, api_key, "Hello!")
print(f"Thread created: {thread_id}")

# Continue conversation
send_sse_message(agent_id, api_key, "Follow-up", thread_id=thread_id)
```

### Best Practices

1. **Use SSE for simple chat**: When you only need request/response, SSE is simpler than WebSocket
2. **Use WebSocket for real-time**: When you need server push (voice, notifications), use WebSocket
3. **Thread persistence**: Store `thread_id` from `message_start` to continue conversations (see [Thread ID Usage Guide](./thread-id-usage.md))
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
