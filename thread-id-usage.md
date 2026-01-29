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

## Best Practices

1. **Always store the thread ID** after receiving it from the first response
2. **Check for thread ID updates** in each response as they can occasionally change
3. **Provide thread IDs when resuming conversations** to maintain context
4. **Handle error cases** where a thread might have expired or been deleted

## Thread Expiration

Thread IDs have an expiration period (typically 30 days). If a thread ID has expired, the system will create a new thread and return a new thread ID.