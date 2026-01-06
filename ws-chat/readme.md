# Agents WebSocket API Documentation

## Overview

The Agents WebSocket API provides real-time bidirectional communication for AI agent chat interactions. It delivers the same streaming events as the HTTP SSE API but over WebSocket, enabling persistent connections with multiple messages per connection.

## Endpoints

### New Thread (creates thread on connect)
```
wssA://api.nebelus.ai/ws/agents/<agent_id>/chat/
```

### Existing Thread (continues conversation)
```
wssA://api.nebelus.ai/ws/agents/<agent_id>/threads/<thread_id>/
```

## Authentication

Authentication can be done via headers or query parameters:

### Headers (Recommended)
Pass the API key and Origin header when connecting:

```python
# Python (websockets library)
async with websockets.connect(
    uri,
    additional_headers={"Authorization": f"{api_key}"}
) as wssA:
    ...
```

```javascript
// JavaScript (browser WebSocket doesn't support custom headers)
// Use query parameters instead (see below)
```

### Query Parameters (Browser Fallback)
For browser WebSocket connections where headers aren't supported:

```
wssA://api.nebelus.ai/ws/agents/<agent_id>/chat/?api_key=sk-ns-org-...
```

Or with access token:
```
wssA://api.nebelus.ai/ws/agents/<agent_id>/chat/?token=<access_token>
```

## Connection Flow

1. Client connects with authentication
2. Server validates credentials and agent access
3. Server sends `connection` event with agent/thread info
4. Client sends `chat` messages
5. Server streams response events
6. Connection stays open for multiple messages

## Client → Server Messages

### Chat Message
Send a message to the agent:

```json
{
  "type": "chat",
  "content": "Hello, how can you help me?",
  "metadata": {},
  "return_context": false,
  "return_timing": false,
  "return_accumulated": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Must be `"chat"` |
| `content` | string | The message content |
| `metadata` | object | Optional metadata to attach to the message |
| `return_context` | boolean | Include execution context in response |
| `return_timing` | boolean | Include timing details in response |
| `return_accumulated` | boolean | Include accumulated content in message_stop |

### Interrupt Resume
Resume a paused workflow after human approval:

```json
{
  "type": "interrupt_resume",
  "decisions": [
    {"node_name": "approve_action", "approved": true}
  ],
  "return_context": false,
  "return_timing": false
}
```

### Cancel
Cancel an active streaming response:

```json
{
  "type": "cancel"
}
```

### Ping
Keep-alive ping:

```json
{
  "type": "ping"
}
```

## Server → Client Events

### Connection
Sent after successful connection:

```json
{
  "event": "connection",
  "data": {
    "status": "connected",
    "agent_id": "8db77b86-...",
    "agent_name": "My Agent",
    "thread_id": "a1b2c3d4-...",
    "thread_title": ""
  }
}
```

### Message Start
Indicates the start of a response:

```json
{
  "event": "message_start",
  "data": {
    "completion_id": "run_abc123",
    "model": "gpt-4o",
    "agent_message_id": "msg_xyz789"
  }
}
```

### Content Block
Streaming content (text, tools, thinking, rich content):

**Text Delta:**
```json
{
  "event": "content_block",
  "data": {
    "content_type": "text",
    "state": "delta",
    "index": 0,
    "data": {
      "text": "Hello! I'm here to help..."
    }
  }
}
```

**Text Complete:**
```json
{
  "event": "content_block",
  "data": {
    "content_type": "text",
    "state": "complete",
    "index": 0
  }
}
```

**Tool Use:**
```json
{
  "event": "content_block",
  "data": {
    "content_type": "tool_use",
    "state": "complete",
    "index": 1,
    "data": {
      "tool_name": "search",
      "tool_call_id": "call_abc",
      "input": {"query": "weather"}
    }
  }
}
```

**Tool Result:**
```json
{
  "event": "content_block",
  "data": {
    "content_type": "tool_result",
    "state": "complete",
    "index": 2,
    "data": {
      "tool_call_id": "call_abc",
      "output": "Current weather: 72F, sunny"
    }
  }
}
```

**Thinking (Extended Thinking):**
```json
{
  "event": "content_block",
  "data": {
    "content_type": "thinking",
    "state": "delta",
    "index": 0,
    "data": {
      "thinking": "Let me analyze this request..."
    }
  }
}
```

**Rich Content Types:**
- `table` - Data tables with headers and rows
- `chart` - Chart.js compatible chart data
- `code_block` - Code with language and content
- `json_data` - Structured JSON output
- `image` - Base64 or URL images
- `file` - File attachments

### Usage Metadata
Token usage information:

```json
{
  "event": "usage_metadata",
  "data": {
    "input_tokens": 150,
    "output_tokens": 75,
    "total_tokens": 225,
    "model": "gpt-4o"
  }
}
```

### Message Stop
End of response:

```json
{
  "event": "message_stop",
  "data": {
    "stop_reason": "end_turn",
    "user_message_id": "msg_user123",
    "agent_message_id": "msg_agent456",
    "timing": {
      "total_ms": 1500,
      "provider_ms": 1200
    }
  }
}
```

### Human Approval
Workflow paused for approval:

```json
{
  "event": "human_approval",
  "data": {
    "message": "Action requires approval",
    "node_name": "approve_action",
    "thread_id": "thread_abc",
    "data": {}
  }
}
```

### Timing Details
Detailed timing breakdown (when `return_timing: true`):

```json
{
  "event": "timing_details",
  "data": {
    "total_ms": 1500,
    "provider_ms": 1200,
    "server_compute_ms": 300,
    "provider_calls": [],
    "tool_calls": []
  }
}
```

### Agent Context
Execution context (when `return_context: true`):

```json
{
  "event": "agent_context",
  "data": {
    "model": "gpt-4o",
    "total_tokens": 500,
    "num_messages": 5,
    "tool_usage": {
      "total_calls": 2,
      "tools_used": ["search", "calculator"]
    }
  }
}
```

### Thread Title
Auto-generated thread title:

```json
{
  "event": "thread_title",
  "data": {
    "title": "Weather inquiry"
  }
}
```

### Cancel Acknowledged
Confirms cancel request received:

```json
{
  "event": "cancel_acknowledged",
  "data": {
    "status": "cancelling",
    "message": "Cancel request received, stopping stream"
  }
}
```

### Pong
Response to ping:

```json
{
  "event": "pong",
  "data": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error
Error occurred:

```json
{
  "event": "error",
  "data": {
    "type": "authentication_error",
    "message": "Authentication required"
  }
}
```

**Error Types:**
- `authentication_error` - Invalid or missing credentials
- `organization_error` - No organization context
- `forbidden` - Access denied to agent/thread
- `not_found` - Agent or thread not found
- `agent_inactive` - Agent is not active
- `insufficient_credits` - Not enough credits
- `busy` - Already processing a message
- `streaming_error` - Error during streaming
- `handler_error` - Internal handler error

## Close Codes

| Code | Meaning |
|------|---------|
| 4001 | Authentication failed |
| 4002 | No organization context |
| 4003 | Access forbidden |
| 4004 | Resource not found |

## Example: JavaScript Client

```javascript
const ws = new WebSocket(
  'wssA://api.nebelus.ai/ws/agents/8db77b86-21cb-4fca-869f-7c80b1a7d49b/chat/?api_key=sk-ns-org-...'
);

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.event) {
    case 'connection':
      console.log('Thread:', msg.data.thread_id);
      // Send first message
      ws.send(JSON.stringify({
        type: 'chat',
        content: 'Hello!'
      }));
      break;

    case 'content_block':
      if (msg.data.content_type === 'text' && msg.data.state === 'delta') {
        process.stdout.write(msg.data.data.text);
      }
      break;

    case 'message_stop':
      console.log('\n--- Response complete ---');
      break;

    case 'human_approval':
      console.log('Approval needed:', msg.data.message);
      // Resume with approval
      ws.send(JSON.stringify({
        type: 'interrupt_resume',
        decisions: [{ node_name: msg.data.node_name, approved: true }]
      }));
      break;

    case 'error':
      console.error('Error:', msg.data.message);
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

## Example: Python Client

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

## Features

### Bidirectional Conversation
Send multiple messages without reconnecting:

```javascript
// Send first message
ws.send(JSON.stringify({ type: 'chat', content: 'What is Python?' }));

// Wait for response, then send follow-up
ws.send(JSON.stringify({ type: 'chat', content: 'Show me an example' }));
```

### Cancel Streaming
Cancel a long-running response:

```javascript
// Start a long request
ws.send(JSON.stringify({ type: 'chat', content: 'Write a long essay...' }));

// Cancel after 5 seconds
setTimeout(() => {
  ws.send(JSON.stringify({ type: 'cancel' }));
}, 5000);
```

### Keep-Alive
Use ping/pong to keep connection alive:

```javascript
setInterval(() => {
  ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

### Workflow Interrupts
Handle human approval requests:

```javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.event === 'human_approval') {
    // Show approval UI, then resume
    const approved = confirm(msg.data.message);
    ws.send(JSON.stringify({
      type: 'interrupt_resume',
      decisions: [{
        node_name: msg.data.node_name,
        approved: approved
      }]
    }));
  }
};
```
