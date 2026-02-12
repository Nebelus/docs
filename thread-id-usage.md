# Thread ID Usage in Nebelus API

This guide explains how to obtain and use thread IDs in both WebSocket and Server-Sent Events (SSE) API implementations.

## What is a Thread ID?

A thread ID is a unique identifier for a conversation between a user and an agent. When you start a new conversation, the system automatically generates a thread ID. You can use this ID to:

- Continue the same conversation later
- Maintain context across multiple messages
- Reference the conversation history in other parts of your application

## WebSocket API

### Obtaining a Thread ID

When you connect to a new WebSocket session, the server sends a `connection` event that includes the thread ID:

```javascript
// WebSocket connection
const ws = new WebSocket(
  'wss://api.nebelus.ai/ws/agents/8db77b86-21cb-4fca-869f-7c80b1a7d49b/chat/?api_key=YOUR_API_KEY'
);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.event === 'connection') {
    // Extract and store the thread ID
    const threadId = msg.data.thread_id;
    console.log('Connected with thread ID:', threadId);
    
    // Store this thread ID for future use
    localStorage.setItem('nebelus_thread_id', threadId);
  }
};
```

In Python:

```python
async with websockets.connect(uri, additional_headers={"Authorization": f"{api_key}"}) as wss:
    # Wait for connection event
    msg = json.loads(await wss.recv())
    if msg["event"] == "connection":
        thread_id = msg["data"]["thread_id"]
        print(f"Connected with thread ID: {thread_id}")
        
        # Store this thread ID for future use
```

### Using a Thread ID for Continuation

To continue a conversation using a stored thread ID, use the threads endpoint:

```javascript
// Connect to an existing thread
const threadId = localStorage.getItem('nebelus_thread_id');
const ws = new WebSocket(
  `wss://api.nebelus.ai/ws/agents/8db77b86-21cb-4fca-869f-7c80b1a7d49b/threads/${threadId}/?api_key=YOUR_API_KEY`
);
```

In Python:

```python
thread_id = "previously_saved_thread_id"
uri = f"wss://api.nebelus.ai/ws/agents/<agent_id>/threads/{thread_id}/"

async with websockets.connect(
    uri,
    additional_headers={"Authorization": f"{api_key}"}
) as wss:
    # Continue the conversation...
```

## Server-Sent Events (SSE) API

### Obtaining a Thread ID

With SSE, the thread ID is included in the `message_start` event at the beginning of a response:

```javascript
// Process SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value, { stream: true });
  buffer += chunk;
  
  // Process complete SSE messages
  const messages = buffer.split("\n\n");
  buffer = messages.pop() || "";
  
  for (const message of messages) {
    // Parse the event
    const lines = message.split("\n");
    let eventType = "";
    let eventData = null;
    
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const jsonStr = line.slice(6).trim();
          if (jsonStr && jsonStr !== "[DONE]") {
            eventData = JSON.parse(jsonStr);
          }
        } catch (e) {
          console.warn("Failed to parse SSE data:", e);
        }
      }
    }
    
    // Extract thread ID from message_start event
    if (eventType === "message_start" && eventData?.thread_id) {
      const threadId = eventData.thread_id;
      console.log("Thread ID:", threadId);
      // Store for future use
      localStorage.setItem("nebelus_thread_id", threadId);
    }
  }
}
```

### Using a Thread ID for Continuation

To continue a conversation with SSE, include the thread ID in your request body:

```javascript
// Build request body - include thread_id if continuing a conversation
const threadId = localStorage.getItem("nebelus_thread_id");
const requestBody = {
  messages: [{ role: "user", content: "My follow-up question" }]
};

if (threadId) {
  requestBody.thread_id = threadId;
}

// Make the request
const response = await fetch(`https://api.nebelus.ai/api/agents/${agentId}/chat/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
    "Authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify(requestBody)
});
```

In Python:

```python
import requests

thread_id = "previously_saved_thread_id"  # Load from your storage
api_key = "YOUR_API_KEY"
agent_id = "YOUR_AGENT_ID"

# Include thread_id in the request body for continuation
response = requests.post(
    f"https://api.nebelus.ai/api/agents/{agent_id}/chat/",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    },
    json={
        "messages": [{"role": "user", "content": "My follow-up question"}],
        "thread_id": thread_id  # Include thread_id for continuation
    },
    stream=True  # Enable streaming for SSE
)

# Process the SSE response...
```

## Complete Examples

### WebSocket: Full Conversation Management

```javascript
class ConversationManager {
	constructor(agentId, apiKey) {
		this.agentId = agentId;
		this.apiKey = apiKey;
		this.ws = null;
		this.threadId = null;
	}

	// Start a new conversation
	async startNewConversation() {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(
				`wss://api.nebelus.ai/ws/agents/${this.agentId}/chat/?api_key=${this.apiKey}`
			);

			this.ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);

				if (msg.event === 'connection') {
					this.threadId = msg.data.thread_id;
					console.log('New conversation started:', this.threadId);
					localStorage.setItem('conversation_thread', this.threadId);
					resolve(this.threadId);
				}
			};

			this.ws.onerror = (error) => reject(error);
		});
	}

	// Resume an existing conversation
	async resumeConversation(threadId) {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(
				`wss://api.nebelus.ai/ws/agents/${this.agentId}/threads/${threadId}/?api_key=${this.apiKey}`
			);

			this.ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);

				if (msg.event === 'connection') {
					this.threadId = msg.data.thread_id;
					console.log('Conversation resumed:', this.threadId);
					resolve(this.threadId);
				} else if (msg.event === 'error') {
					console.error('Failed to resume:', msg.data.message);
					reject(new Error(msg.data.message));
				}
			};

			this.ws.onerror = (error) => reject(error);
		});
	}

	// Send a message
	sendMessage(content, attachments = []) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({
				type: 'chat',
				content,
				metadata: { attachments }
			}));
		}
	}

	// Auto-reconnect with saved thread
	async autoReconnect() {
		const savedThreadId = localStorage.getItem('conversation_thread');

		if (savedThreadId) {
			try {
				await this.resumeConversation(savedThreadId);
				console.log('Successfully reconnected to saved conversation');
				return true;
			} catch (error) {
				console.log('Saved thread expired, starting new conversation');
				await this.startNewConversation();
				return false;
			}
		} else {
			await this.startNewConversation();
			return false;
		}
	}

	disconnect() {
		if (this.ws) {
			this.ws.close();
		}
	}
}

// Usage
const manager = new ConversationManager(agentId, apiKey);

// Auto-reconnect or start new
await manager.autoReconnect();

// Send messages
manager.sendMessage('Hello!');
```

### SSE: Full Conversation Management

```javascript
class SSEConversationManager {
	constructor(agentId, apiKey) {
		this.agentId = agentId;
		this.apiKey = apiKey;
		this.threadId = null;
		this.baseUrl = 'https://api.nebelus.ai';
	}

	async sendMessage(content, attachments = []) {
		const requestBody = {
			messages: [{
				role: 'user',
				content,
				metadata: { attachments }
			}]
		};

		// Include thread_id if continuing conversation
		if (this.threadId) {
			requestBody.thread_id = this.threadId;
		}

		const response = await fetch(
			`${this.baseUrl}/api/agents/${this.agentId}/chat/`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'text/event-stream',
					'Authorization': `Bearer ${this.apiKey}`
				},
				body: JSON.stringify(requestBody)
			}
		);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		// Process SSE stream
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let fullResponse = '';

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

				// Extract and save thread_id
				if (eventType === 'message_start' && eventData?.thread_id) {
					this.threadId = eventData.thread_id;
					localStorage.setItem('sse_thread_id', this.threadId);
					console.log('Thread ID:', this.threadId);
				}

				// Accumulate text
				if (eventType === 'content_block' && eventData?.state === 'delta') {
					fullResponse += eventData.data?.text || '';
				}
			}
		}

		return fullResponse;
	}

	// Load saved thread
	loadSavedThread() {
		const saved = localStorage.getItem('sse_thread_id');
		if (saved) {
			this.threadId = saved;
			console.log('Loaded saved thread:', this.threadId);
			return true;
		}
		return false;
	}

	// Clear thread (start fresh)
	clearThread() {
		this.threadId = null;
		localStorage.removeItem('sse_thread_id');
	}
}

// Usage
const sseManager = new SSEConversationManager(agentId, apiKey);

// Start new conversation
const response1 = await sseManager.sendMessage('Hello!');
console.log('Response:', response1);

// Continue conversation (automatically uses saved thread_id)
const response2 = await sseManager.sendMessage('Follow-up question');
console.log('Response:', response2);

// Later: Load saved thread and continue
const loaded = sseManager.loadSavedThread();
if (loaded) {
	const response3 = await sseManager.sendMessage('Resuming our chat');
	console.log('Response:', response3);
}
```

### Python: Complete Thread Management

```python
import json
import asyncio
import websockets
from typing import Optional

class ThreadManager:
	def __init__(self, agent_id: str, api_key: str):
		self.agent_id = agent_id
		self.api_key = api_key
		self.thread_id: Optional[str] = None
		self.ws = None

	async def start_conversation(self) -> str:
		"""Start a new conversation"""
		uri = f"wss://api.nebelus.ai/ws/agents/{self.agent_id}/chat/"

		self.ws = await websockets.connect(
			uri,
			additional_headers={"Authorization": self.api_key}
		)

		# Wait for connection event
		msg = json.loads(await self.ws.recv())
		if msg["event"] == "connection":
			self.thread_id = msg["data"]["thread_id"]
			print(f"New conversation: {self.thread_id}")
			return self.thread_id

	async def resume_conversation(self, thread_id: str) -> bool:
		"""Resume existing conversation"""
		uri = f"wss://api.nebelus.ai/ws/agents/{self.agent_id}/threads/{thread_id}/"

		try:
			self.ws = await websockets.connect(
				uri,
				additional_headers={"Authorization": self.api_key}
			)

			msg = json.loads(await self.ws.recv())
			if msg["event"] == "connection":
				self.thread_id = msg["data"]["thread_id"]
				print(f"Resumed conversation: {self.thread_id}")
				return True
		except Exception as e:
			print(f"Failed to resume: {e}")
			return False

	async def send_message(self, content: str) -> str:
		"""Send message and return response"""
		await self.ws.send(json.dumps({
			"type": "chat",
			"content": content
		}))

		response = ""
		async for message in self.ws:
			msg = json.loads(message)

			if msg["event"] == "content_block":
				if msg["data"]["state"] == "delta":
					text = msg["data"]["data"].get("text", "")
					response += text
					print(text, end="", flush=True)

			elif msg["event"] == "message_stop":
				print("\n--- Complete ---")
				break

			elif msg["event"] == "error":
				raise Exception(msg["data"]["message"])

		return response

	async def auto_connect(self, saved_thread_id: Optional[str] = None) -> bool:
		"""Automatically connect to saved or new conversation"""
		if saved_thread_id:
			if await self.resume_conversation(saved_thread_id):
				return True
			print("Saved thread expired, starting new conversation")

		await self.start_conversation()
		return False

	async def close(self):
		if self.ws:
			await self.ws.close()


# Usage
async def main():
	manager = ThreadManager(agent_id="your-agent-id", api_key="your-api-key")

	# Try to resume saved conversation, or start new
	saved_id = load_thread_id_from_storage()  # Your storage logic
	await manager.auto_connect(saved_id)

	# Send messages
	await manager.send_message("Hello!")
	await manager.send_message("How are you?")

	# Save thread ID for later
	save_thread_id_to_storage(manager.thread_id)  # Your storage logic

	await manager.close()

asyncio.run(main())
```

## File Attachments with Thread Resumption

You can include file attachments when resuming a conversation:

### WebSocket with Files

```javascript
// Resume thread and send message with file
async function resumeAndSendFile(threadId, file, message) {
	const ws = new WebSocket(
		`wss://api.nebelus.ai/ws/agents/${agentId}/threads/${threadId}/?api_key=${apiKey}`
	);

	await new Promise((resolve) => {
		ws.onopen = resolve;
	});

	// Convert file to base64
	const base64Data = await new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result.split(',')[1]);
		reader.readAsDataURL(file);
	});

	// Send message with attachment
	ws.send(JSON.stringify({
		type: 'chat',
		content: message,
		metadata: {
			attachments: [{
				name: file.name,
				content_type: file.type,
				data: base64Data
			}]
		}
	}));

	return ws;
}

// Usage
const savedThread = localStorage.getItem('thread_id');
const fileInput = document.getElementById('fileInput');
const ws = await resumeAndSendFile(
	savedThread,
	fileInput.files[0],
	'Here is the document we discussed'
);
```

### SSE with Files

```javascript
// Resume thread and send file via SSE
async function resumeThreadWithFile(threadId, file, message) {
	// Convert file to base64
	const base64Data = await new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result.split(',')[1]);
		reader.readAsDataURL(file);
	});

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
				thread_id: threadId,  // Resume conversation
				messages: [{
					role: 'user',
					content: message,
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

// Usage
const savedThread = localStorage.getItem('sse_thread_id');
const file = document.getElementById('fileInput').files[0];
await resumeThreadWithFile(savedThread, file, 'Continuing with this file');
```

## Best Practices

1. **Always store the thread ID** after receiving it from the first response
2. **Check for thread ID updates** in each response as they can occasionally change
3. **Provide thread IDs when resuming conversations** to maintain context
4. **Handle error cases** where a thread might have expired or been deleted
5. **Implement graceful fallback** to create new threads when resumption fails
6. **Store thread metadata** alongside thread IDs (creation date, conversation topic) for better management
7. **Clean up expired threads** from local storage periodically

## Thread Expiration

Thread IDs have an expiration period (typically 30 days). If a thread ID has expired, the system will create a new thread and return a new thread ID.

### Handling Expired Threads

```javascript
async function connectWithFallback(threadId) {
	try {
		// Try to resume existing thread
		const ws = new WebSocket(
			`wss://api.nebelus.ai/ws/agents/${agentId}/threads/${threadId}/?api_key=${apiKey}`
		);

		return await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Connection timeout'));
			}, 5000);

			ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);

				if (msg.event === 'connection') {
					clearTimeout(timeout);
					resolve(ws);
				} else if (msg.event === 'error') {
					clearTimeout(timeout);
					reject(new Error(msg.data.message));
				}
			};

			ws.onerror = () => {
				clearTimeout(timeout);
				reject(new Error('Connection failed'));
			};
		});
	} catch (error) {
		console.log('Thread expired or invalid, starting new conversation');
		// Start new conversation
		const ws = new WebSocket(
			`wss://api.nebelus.ai/ws/agents/${agentId}/chat/?api_key=${apiKey}`
		);

		return await new Promise((resolve) => {
			ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				if (msg.event === 'connection') {
					// Save new thread ID
					localStorage.setItem('thread_id', msg.data.thread_id);
					resolve(ws);
				}
			};
		});
	}
}
```

## Error Handling

Always handle potential errors when working with threads:

```javascript
// Comprehensive error handling
async function safeResumeThread(threadId) {
	try {
		const ws = new WebSocket(
			`wss://api.nebelus.ai/ws/agents/${agentId}/threads/${threadId}/?api_key=${apiKey}`
		);

		ws.onerror = (error) => {
			console.error('WebSocket error:', error);
			// Fall back to new conversation
			startNewConversation();
		};

		ws.onclose = (event) => {
			if (event.code === 4004) {
				console.log('Thread not found or expired');
				localStorage.removeItem('thread_id');
				startNewConversation();
			}
		};

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);

			if (msg.event === 'error') {
				if (msg.data.code === 'thread_not_found') {
					console.log('Thread not found, creating new');
					localStorage.removeItem('thread_id');
					startNewConversation();
				}
			}
		};

		return ws;
	} catch (error) {
		console.error('Failed to resume thread:', error);
		return startNewConversation();
	}
}
```