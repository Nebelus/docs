# Nebelus Chat Widget -- Integration Guide

> **Widget version:** 1.0.5 | **Last updated:** February 2026

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Installation & Embedding](#2-installation--embedding)
3. [Configuration Reference](#3-configuration-reference)
4. [User Identification](#4-user-identification)
5. [Thread Management](#5-thread-management)
6. [Event Callbacks](#6-event-callbacks)
7. [Public API Methods](#7-public-api-methods)
8. [Theming](#8-theming)
9. [File Uploads](#9-file-uploads)
10. [Streaming vs Non-Streaming](#10-streaming-vs-non-streaming)
11. [Security](#11-security)
12. [Framework Examples](#12-framework-examples)
13. [Troubleshooting & FAQ](#13-troubleshooting--faq)

---

## 1. Quick Start

Add this snippet to your website's HTML, right before the closing `</body>` tag:

```html
<script src="https://cdn.nebelus.ai/nebelus-widget.js"></script>
<script>
  NebelusWidget.init({
    apiKey: 'YOUR_API_KEY',
    agentId: 'YOUR_AGENT_ID',
    deploymentId: 'YOUR_DEPLOYMENT_ID'
  });
</script>
```

That's it. The widget renders a floating chat button in the bottom-right corner of your page.

---

## 2. Installation & Embedding

### CDN Script Tag (recommended)

```html
<script src="https://cdn.nebelus.ai/nebelus-widget.js"></script>
```

The script exposes a global `NebelusWidget` object on `window`. Call `NebelusWidget.init(options)` to initialize.

### Full HTML Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Website</title>
</head>
<body>
  <!-- Your page content -->

  <script src="https://cdn.nebelus.ai/nebelus-widget.js"></script>
  <script>
    NebelusWidget.init({
      apiKey: 'nbl_live_abc123',
      agentId: 'agent-uuid-here',
      deploymentId: 'deployment-uuid-here'
    });
  </script>
</body>
</html>
```

### Notes

- The widget uses **Shadow DOM** for full style isolation -- your site's CSS will not affect the widget, and vice versa.
- The widget is fully self-contained; no additional CSS files are required.
- The script is safe to load asynchronously by adding `async` or `defer` to the script tag, but you must then call `NebelusWidget.init()` after the script has loaded.

---

## 3. Configuration Reference

Pass these options to `NebelusWidget.init()`.

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `apiKey` | `string` | **Required.** Your Nebelus API key. Create one in **Settings > API Keys**. |
| `agentId` | `string` | **Required.** The ID of the AI agent that powers the chat. |

### Connection & Deployment

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiBaseUrl` | `string` | `"https://api.nebelus.ai"` | Base URL for the Nebelus API. Override for self-hosted or staging environments. |
| `deploymentId` | `string` | `null` | Links the widget to a specific deployment for domain validation and persistence. |

### User Identification & Persistence

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `userId` | `string` | `null` | Your application's user identifier. Enables cross-device conversation persistence. When omitted, the widget uses a browser fingerprint. |
| `threadId` | `string` | `null` | Resume a specific conversation thread. Takes priority over auto-selection of the most recent thread. |
| `enablePersistence` | `boolean` | `true` | Enable server-side user identification and thread persistence. Set to `false` for ephemeral (no-history) mode. |
| `enableThreadHistory` | `boolean` | `false` | Show a sidebar that lets users view and switch between previous conversations. |
| `persistSession` | `boolean` | `true` | Persist session data (messages, thread IDs) in `localStorage` across page reloads. |
| `sessionTimeout` | `number` | `1800000` | Session timeout in milliseconds (default: 30 minutes). After this period of inactivity, a new session is created. |

### Behavior

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stream` | `boolean` | `true` | Use SSE streaming for real-time token-by-token responses. Set to `false` for complete responses. |
| `autoOpen` | `boolean` | `false` | Automatically open the chat window on page load. |
| `showWelcome` | `boolean` | `true` | Show the welcome message when a new conversation starts. |
| `showTimestamps` | `boolean` | `false` | Display timestamps on each message. |
| `debug` | `boolean` | `false` | Enable verbose console logging prefixed with `[Nebelus Widget]`. |
| `maxMessagesPerMinute` | `number` | `10` | Client-side rate limit. The user cannot send more than this many messages per minute. |
| `position` | `string` | `"bottom-right"` | Widget button position. One of: `"bottom-right"`, `"bottom-left"`, `"top-right"`, `"top-left"`. |

### Appearance

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `agentName` | `string` | `null` | Agent name used for generating dynamic avatars (via DiceBear). |
| `agentAvatar` | `string` | `null` | Custom agent avatar image URL. Overrides dynamic avatar generation. |
| `useAgentAvatar` | `boolean` | `false` | Display the agent's avatar next to assistant messages and in the header. |

### File Uploads

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableFileUpload` | `boolean` | `true` | Enable the file upload system internally. |
| `allowUserFileSubmission` | `boolean` | `true` | Show the attach button and allow users to submit files. |
| `maxFileSize` | `number` | `10485760` | Maximum file size in bytes (default: 10 MB). |
| `allowedFileTypes` | `string[]` | See below | MIME types accepted for upload. |

Default allowed file types:

```
image/jpeg, image/png, image/gif, image/webp,
application/pdf,
application/vnd.openxmlformats-officedocument.wordprocessingml.document,
text/plain
```

### Text Customization

Override any of the widget's UI strings via the `text` object:

| Option | Type | Default |
|--------|------|---------|
| `text.headerText` | `string` | `"Chat with us"` |
| `text.placeholderText` | `string` | `"Type your message..."` |
| `text.welcomeMessage` | `string` | `"Hi! How can I help you today?"` |
| `text.errorMessage` | `string` | `"Sorry, something went wrong. Please try again."` |
| `text.rateLimitMessage` | `string` | `"Please slow down. You can send up to {limit} messages per minute."` |
| `text.offlineMessage` | `string` | `"Chat is currently offline. Please try again later."` |
| `text.poweredByText` | `string` | `"Secured by Nebelus AI"` |

The `{limit}` placeholder in `rateLimitMessage` is replaced at runtime with the value of `maxMessagesPerMinute`.

### Theme Customization

See [Section 8 -- Theming](#8-theming) for the full theme reference.

### Event Hooks

See [Section 6 -- Event Callbacks](#6-event-callbacks) for all available callbacks.

---

## 4. User Identification

The widget supports three identification modes that determine how conversations are persisted.

### Mode 1: Anonymous (Browser Fingerprint)

This is the **default** when no `userId` is provided. The widget generates a browser fingerprint using [FingerprintJS](https://fingerprint.com/) and stores it in `localStorage`. Returning visitors on the same browser will see their previous conversations.

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  deploymentId: 'YOUR_DEPLOYMENT_ID'
  // No userId -- fingerprint is used automatically
});
```

### Mode 2: Known User (userId)

Pass your application's user identifier to link conversations to a specific user. This enables **cross-device** persistence -- the same user can continue conversations from any browser.

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  deploymentId: 'YOUR_DEPLOYMENT_ID',
  userId: 'user-123'
});
```

### Mode 3: Ephemeral (No Persistence)

Disable persistence entirely. Each page load starts a fresh conversation with no history.

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  enablePersistence: false
});
```

### How Identification Works

1. On init, the widget calls `POST /api/v1/widget/identify/` with either `userId` or `fingerprint`.
2. The server returns a `deployment_user_id` and a list of existing `threads`.
3. The widget selects the most recent thread (or the one specified by `threadId`) and loads its messages.

---

## 5. Thread Management

### Resuming a Specific Thread

Use `threadId` to open the widget on a specific conversation. This is useful for support ticket deep-links or cross-device session handoff.

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  deploymentId: 'YOUR_DEPLOYMENT_ID',
  userId: 'user-123',
  threadId: 'thread-uuid-here'
});
```

> **Note:** `threadId` takes priority over localStorage session and auto-selection of the most recent thread.

### Conversation History Sidebar

Enable `enableThreadHistory` to show a slide-over sidebar where users can browse and switch between previous conversations.

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  deploymentId: 'YOUR_DEPLOYMENT_ID',
  enableThreadHistory: true
});
```

When enabled, a history icon appears in the chat header. Clicking it opens a sidebar listing all conversations with titles, previews, and timestamps. Users can also start a new conversation from this sidebar.

### Thread Lifecycle

1. **First message** -- When the user sends their first message without an existing `threadId`, the server creates a new thread. The widget receives the `threadId` via the `X-Thread-Id` response header and/or the `message_start` SSE event.
2. **Thread title** -- The server auto-generates a title after the first exchange. The widget receives it via the `thread_title` SSE event and fires the `onThreadTitleUpdate` callback.
3. **Subsequent messages** -- The `threadId` is sent with every request to maintain conversation context.
4. **New conversation** -- Users can start a new thread via the history sidebar's "+ New" button, which resets the thread state.

### Saving Thread IDs

Use the `onNewThread` and `onMessage` callbacks to capture thread IDs for your backend:

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  deploymentId: 'YOUR_DEPLOYMENT_ID',

  onNewThread: (data) => {
    // Save the thread ID to your database
    saveToDatabase({
      threadId: data.threadId,
      title: data.title,
      createdAt: data.createdAt
    });
  },

  onMessage: (data) => {
    // Every message includes the threadId
    console.log('Thread:', data.threadId, 'Role:', data.role);
  }
});
```

---

## 6. Event Callbacks

Pass callback functions to `NebelusWidget.init()` to react to widget events.

### onReady

Fired when the widget has finished initializing.

```javascript
onReady: (data) => {
  console.log('Widget ready, session:', data.sessionId);
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.sessionId` | `string` | The current session identifier. |

### onOpen

Fired when the chat window is opened.

```javascript
onOpen: () => {
  console.log('Chat opened');
}
```

No payload.

### onClose

Fired when the chat window is closed.

```javascript
onClose: () => {
  console.log('Chat closed');
}
```

No payload.

### onMessage

Fired when a message is sent (user) or received (assistant). This fires for both streaming and non-streaming modes.

```javascript
onMessage: (data) => {
  console.log(`[${data.role}] ${data.content}`);
  console.log('Thread ID:', data.threadId);
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.role` | `"user"` \| `"assistant"` | Who sent the message. |
| `data.content` | `string` | The message text content. |
| `data.threadId` | `string` \| `null` | The conversation thread ID. May be `null` for the very first message before the server assigns a thread. |
| `data.attachments` | `object[]` \| `undefined` | Present only on user messages that include file attachments. Each object has `id`, `name`, `type`, `preview`, and `url`. |

> **Timing note (streaming mode):** For assistant messages, `onMessage` fires once when the complete response has been received (at the `message_stop` SSE event), not on every token.

### onNewThread

Fired when a new conversation thread is created.

```javascript
onNewThread: (data) => {
  console.log('New thread:', data.threadId);
  saveToDatabase(data.threadId);
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.threadId` | `string` | The unique thread identifier. |
| `data.title` | `string` | The thread title (initially `"New conversation"`, updated later by the server). |
| `data.createdAt` | `string` | ISO 8601 timestamp of when the thread was created. |

### onThreadTitleUpdate

Fired when the server generates or updates a title for the current thread (typically after the first exchange).

```javascript
onThreadTitleUpdate: (data) => {
  console.log('Thread title updated:', data.title);
  updateTitleInDatabase(data.threadId, data.title);
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.threadId` | `string` | The thread identifier. |
| `data.title` | `string` | The new title. |

### onError

Fired when an error occurs during message sending or API communication.

```javascript
onError: (data) => {
  console.error('Widget error:', data.error);
  reportToSentry(data.error);
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.error` | `string` | The error message. |

### Full Example

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  deploymentId: 'YOUR_DEPLOYMENT_ID',

  onReady: (data) => {
    console.log('Widget ready:', data.sessionId);
  },
  onNewThread: (data) => {
    saveToDatabase(data.threadId);
  },
  onThreadTitleUpdate: (data) => {
    updateTitle(data.threadId, data.title);
  },
  onMessage: (data) => {
    analytics.track('chat_message', {
      role: data.role,
      threadId: data.threadId
    });
  },
  onOpen: () => analytics.track('chat_opened'),
  onClose: () => analytics.track('chat_closed'),
  onError: (data) => Sentry.captureMessage(data.error)
});
```

---

## 7. Public API Methods

After initialization, you can control the widget programmatically via the global `NebelusWidget` object.

### NebelusWidget.open()

Open the chat window programmatically.

```javascript
document.getElementById('help-btn').addEventListener('click', () => {
  NebelusWidget.open();
});
```

### NebelusWidget.close()

Close the chat window.

```javascript
NebelusWidget.close();
```

### NebelusWidget.send(message)

Send a message on behalf of the user. The message appears in the chat as a user message and triggers the AI response.

```javascript
NebelusWidget.send('I need help with my order #12345');
```

### NebelusWidget.setStreamingMode(enabled)

Toggle between streaming (SSE) and non-streaming response modes at runtime.

```javascript
// Disable streaming
NebelusWidget.setStreamingMode(false);

// Re-enable streaming
NebelusWidget.setStreamingMode(true);
```

### NebelusWidget.clearHistory()

Clear all messages from the chat window and `localStorage`. If `showWelcome` is enabled, the welcome message is re-displayed.

```javascript
NebelusWidget.clearHistory();
```

### NebelusWidget.updateTheme(themeObject)

Update theme colors and styles at runtime without re-initializing. Accepts a partial theme object -- only the properties you pass will be updated.

```javascript
NebelusWidget.updateTheme({
  primaryColor: '#10B981',
  userMessageBg: '#10B981'
});
```

### NebelusWidget.destroy()

Remove the widget from the DOM entirely and clean up all references.

```javascript
NebelusWidget.destroy();
```

---

## 8. Theming

### Theme Object

Pass a `theme` object to `init()` to customize colors and styles:

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  theme: {
    primaryColor: '#4F46E5',
    secondaryColor: '#818CF8',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    userMessageBg: '#4F46E5',
    userMessageText: '#FFFFFF',
    assistantMessageBg: '#F3F4F6',
    assistantMessageText: '#1F2937',
    headerBg: '#4F46E5',
    headerText: '#FFFFFF',
    inputBorder: '#E5E7EB',
    inputFocus: '#4F46E5',
    buttonRadius: '8px',
    messageRadius: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px'
  }
});
```

### Theme Properties Reference

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `primaryColor` | `string` | `"#4F46E5"` | Main brand color. Used for the chat button, header gradient start, send button, and user message background. |
| `secondaryColor` | `string` | `"#818CF8"` | Secondary brand color. Used for the header gradient end and button hover states. |
| `backgroundColor` | `string` | `"#FFFFFF"` | Chat window background color. |
| `textColor` | `string` | `"#1F2937"` | Primary text color throughout the widget. |
| `userMessageBg` | `string` | `"#4F46E5"` | Background color of user message bubbles. |
| `userMessageText` | `string` | `"#FFFFFF"` | Text color inside user message bubbles. |
| `assistantMessageBg` | `string` | `"#F3F4F6"` | Background color of assistant message bubbles. |
| `assistantMessageText` | `string` | `"#1F2937"` | Text color inside assistant message bubbles. |
| `headerBg` | `string` | `"#4F46E5"` | Header background color (also aliased from `primaryColor`). |
| `headerText` | `string` | `"#FFFFFF"` | Header text and icon color. |
| `inputBorder` | `string` | `"#E5E7EB"` | Border color for the message input field. |
| `inputFocus` | `string` | `"#4F46E5"` | Border/ring color when the input is focused. |
| `buttonRadius` | `string` | `"8px"` | Border radius for buttons. |
| `messageRadius` | `string` | `"12px"` | Border radius for message bubbles. |
| `fontFamily` | `string` | System fonts | Font stack used throughout the widget. |
| `fontSize` | `string` | `"14px"` | Base font size. |

### Backward-Compatible Aliases

If you are migrating from an older configuration format, the following aliases are automatically resolved:

| Old Key | Maps To |
|---------|---------|
| `inputBorderColor` | `inputBorder` |
| `borderRadius` | `buttonRadius` |
| `headerColor` | `headerBg` |

### CSS Variables

The widget exposes CSS custom properties on the `:host` selector inside its Shadow DOM. These are set automatically from the theme object:

```
--nebelus-primary-color
--nebelus-secondary-color
--nebelus-bg-color
--nebelus-text-color
--nebelus-user-msg-bg
--nebelus-user-msg-text
--nebelus-assistant-msg-bg
--nebelus-assistant-msg-text
--nebelus-header-bg
--nebelus-header-text
--nebelus-input-border
--nebelus-input-focus
--nebelus-button-radius
--nebelus-message-radius
--nebelus-font-family
--nebelus-font-size
--nebelus-primary-rgb          (auto-derived)
--nebelus-surface-color        (auto-derived)
--nebelus-muted-text-color     (auto-derived)
--nebelus-scrollbar-thumb      (auto-derived)
--nebelus-scrollbar-thumb-hover (auto-derived)
--nebelus-loading-overlay      (auto-derived)
```

The derived variables are automatically computed from `backgroundColor` to support both light and dark background themes.

### Runtime Theme Updates

Use `NebelusWidget.updateTheme()` to change the theme without re-initializing:

```javascript
// Switch to dark mode
NebelusWidget.updateTheme({
  backgroundColor: '#111827',
  textColor: '#F9FAFB',
  assistantMessageBg: '#1F2937',
  assistantMessageText: '#F9FAFB'
});
```

---

## 9. File Uploads

When enabled, a paperclip icon appears next to the message input. Users can attach files before sending a message.

### Configuration

```javascript
NebelusWidget.init({
  apiKey: 'YOUR_API_KEY',
  agentId: 'YOUR_AGENT_ID',
  enableFileUpload: true,
  allowUserFileSubmission: true,
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  allowedFileTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
});
```

### How It Works

1. The user clicks the attach button and selects one or more files.
2. Image files show a thumbnail preview in the input area. Other file types show an icon.
3. When the user clicks send, each attachment is uploaded to `POST /api/v1/widget/files/upload/` before the message is sent.
4. If the server processes the file asynchronously (status `"processing"`), the widget polls `GET /api/v1/widget/files/{id}/` until the file is ready (up to 30 attempts, 1-second intervals).
5. Successfully uploaded files are included in the chat message payload as `metadata.attachments`.

### Attachment Data in Events

The `onMessage` callback for user messages includes an `attachments` array when files are attached:

```javascript
onMessage: (data) => {
  if (data.attachments && data.attachments.length > 0) {
    data.attachments.forEach(att => {
      console.log('File:', att.name, 'URL:', att.url);
    });
  }
}
```

Each attachment object contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Server-side file ID. |
| `name` | `string` | Original filename. |
| `type` | `string` | MIME type. |
| `preview` | `string` \| `null` | Base64 data URL for image previews. |
| `url` | `string` | Server URL for the uploaded file. |

### Disabling File Uploads

To hide the attach button entirely:

```javascript
NebelusWidget.init({
  // ...
  allowUserFileSubmission: false
});
```

---

## 10. Streaming vs Non-Streaming

### Streaming Mode (default)

When `stream: true`, the widget sends requests with `Accept: application/json, text/event-stream, */*` and processes the response as an SSE (Server-Sent Events) stream.

Events received:

| SSE Event | Description |
|-----------|-------------|
| `message_start` | Contains the message ID and `thread_id`. |
| `content_block` (state: `delta`) | Incremental text content. Displayed token-by-token with a typing cursor. |
| `content_block` (state: `complete`) | Signals the content block is finished. |
| `message_stop` | The full response is complete. Triggers the `onMessage` callback. |
| `thread_title` | Server-generated title for the thread. Triggers `onThreadTitleUpdate`. |

Streaming provides a real-time typing effect and faster perceived response times.

### Non-Streaming Mode

When `stream: false`, the widget sends a standard JSON request and waits for the complete response.

```javascript
NebelusWidget.init({
  // ...
  stream: false
});
```

The response is a JSON object containing the full `message` and optional `thread_id`. The entire response appears at once.

### Switching at Runtime

```javascript
NebelusWidget.setStreamingMode(false); // switch to non-streaming
NebelusWidget.setStreamingMode(true);  // switch back to streaming
```

---

## 11. Security

### Shadow DOM Isolation

The widget renders inside a [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM), which provides:

- **CSS isolation** -- your site's styles do not leak into the widget, and widget styles do not affect your page.
- **DOM encapsulation** -- widget elements are not accessible via `document.querySelector()` from the host page.

### Domain Whitelisting

When a `deploymentId` is configured, the server validates the `Origin` header of every request against the deployment's allowed domains list.

- Configure allowed domains in the Nebelus dashboard under **Widget Configurator > Allowed Domains**.
- Only requests originating from whitelisted domains will be processed.
- `localhost` and `127.0.0.1` are always allowed for development.

### Domain Verification

Two methods are available to verify domain ownership:

**Option 1 -- DNS TXT Record:**
Add a TXT record at `_nebelus-verify.yourdomain.com` with the verification token provided in the dashboard.

**Option 2 -- File Upload:**
Place a file at `https://yourdomain.com/.well-known/nebelus-verify.txt` containing the verification token.

### Rate Limiting

Rate limiting is enforced at two levels:

| Level | Limit | Scope |
|-------|-------|-------|
| Client-side | `maxMessagesPerMinute` (default: 10) | Per browser session. Configurable. |
| Server-side (verified domains) | 1,000 requests/minute | Per deployment. |
| Server-side (unverified domains) | 100 requests/minute | Per deployment. |

> Verify your domains to unlock higher rate limits.

### CORS Protection

The server middleware validates the `Origin` header against the deployment's domain whitelist. Requests from non-whitelisted origins are rejected.

### API Key Security

- API keys authenticate widget requests to the Nebelus API.
- Never expose your API key in public repositories. While widget API keys are designed for client-side use (scoped to widget operations only), treat them with care.
- Create separate API keys for different environments (development, staging, production).

---

## 12. Framework Examples

### Vanilla JavaScript

```html
<script src="https://cdn.nebelus.ai/nebelus-widget.js"></script>
<script>
  NebelusWidget.init({
    apiKey: 'YOUR_API_KEY',
    agentId: 'YOUR_AGENT_ID',
    deploymentId: 'YOUR_DEPLOYMENT_ID',
    userId: getCurrentUserId(), // your auth logic
    enableThreadHistory: true,
    stream: true,

    onNewThread: (data) => {
      fetch('/api/save-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: data.threadId })
      });
    },

    onMessage: (data) => {
      if (data.role === 'assistant') {
        console.log('AI replied in thread:', data.threadId);
      }
    }
  });
</script>
```

### React

```jsx
// components/NebelusChat.jsx
import { useEffect, useRef } from 'react';

export default function NebelusChat({ userId, agentId, apiKey, deploymentId }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.nebelus.ai/nebelus-widget.js';
    script.async = true;
    script.onload = () => {
      window.NebelusWidget.init({
        apiKey,
        agentId,
        deploymentId,
        userId,
        enableThreadHistory: true,

        onReady: (data) => {
          console.log('Widget ready:', data.sessionId);
        },
        onNewThread: (data) => {
          console.log('New thread:', data.threadId);
        },
        onMessage: (data) => {
          console.log(`[${data.role}] Thread: ${data.threadId}`);
        },
        onError: (data) => {
          console.error('Widget error:', data.error);
        }
      });
    };
    document.body.appendChild(script);
    initialized.current = true;

    return () => {
      if (window.NebelusWidget) {
        window.NebelusWidget.destroy();
      }
    };
  }, [userId, agentId, apiKey, deploymentId]);

  return null; // Widget renders itself via the DOM
}

// Usage in App.jsx
function App() {
  return (
    <div>
      <h1>My App</h1>
      <NebelusChat
        apiKey="YOUR_API_KEY"
        agentId="YOUR_AGENT_ID"
        deploymentId="YOUR_DEPLOYMENT_ID"
        userId={user.id}
      />
    </div>
  );
}
```

### Vue 3

```vue
<!-- components/NebelusChat.vue -->
<template>
  <!-- Widget renders itself, no template needed -->
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  apiKey: { type: String, required: true },
  agentId: { type: String, required: true },
  deploymentId: { type: String, default: null },
  userId: { type: String, default: null }
});

const emit = defineEmits(['ready', 'newThread', 'message', 'error']);

let scriptEl = null;

onMounted(() => {
  scriptEl = document.createElement('script');
  scriptEl.src = 'https://cdn.nebelus.ai/nebelus-widget.js';
  scriptEl.async = true;
  scriptEl.onload = () => {
    window.NebelusWidget.init({
      apiKey: props.apiKey,
      agentId: props.agentId,
      deploymentId: props.deploymentId,
      userId: props.userId,
      enableThreadHistory: true,

      onReady: (data) => emit('ready', data),
      onNewThread: (data) => emit('newThread', data),
      onMessage: (data) => emit('message', data),
      onError: (data) => emit('error', data)
    });
  };
  document.body.appendChild(scriptEl);
});

onUnmounted(() => {
  if (window.NebelusWidget) {
    window.NebelusWidget.destroy();
  }
  if (scriptEl) {
    scriptEl.remove();
  }
});
</script>
```

Usage:

```vue
<template>
  <div>
    <h1>My App</h1>
    <NebelusChat
      api-key="YOUR_API_KEY"
      agent-id="YOUR_AGENT_ID"
      deployment-id="YOUR_DEPLOYMENT_ID"
      :user-id="user.id"
      @new-thread="handleNewThread"
      @message="handleMessage"
    />
  </div>
</template>
```

---

## 13. Troubleshooting & FAQ

### Widget does not appear

1. Verify the script is loaded: check the Network tab in DevTools for `nebelus-widget.js`.
2. Verify `NebelusWidget.init()` is called after the script loads. If using `async`/`defer`, use the script's `onload` event.
3. Check the browser console for errors like `"Nebelus Widget: API key is required"`.
4. Ensure `apiKey` and `agentId` are both provided and valid.

### "API Key Required" error in chat

The widget is loaded but no valid API key is configured. Ensure you pass a real API key (not `"YOUR_API_KEY"` or a placeholder).

### 403 Authentication Failed

Your API key is invalid, expired, or does not have permission for the specified agent. Check:
- The API key is active in **Settings > API Keys**.
- The API key has access to the agent specified by `agentId`.

### Messages not persisting across page reloads

- Ensure `persistSession: true` (default) and `enablePersistence: true` (default).
- If using `userId`, verify the same `userId` is passed on every page load.
- Check that `localStorage` is not blocked by the browser (private/incognito mode may clear storage).

### Thread ID not available in events

The `threadId` is available in `onMessage`, `onNewThread`, and `onThreadTitleUpdate` events. Note that the very first `onMessage` for a user's first message may have `threadId: null` if the server hasn't responded with a thread ID yet. Use `onNewThread` to capture the thread ID as soon as it's created.

### CORS errors

Ensure your domain is added to the deployment's allowed domains list in the Nebelus dashboard. For local development, `localhost` is automatically allowed.

### Rate limit exceeded

- **Client-side:** The widget enforces `maxMessagesPerMinute` (default: 10). Increase this value if needed.
- **Server-side:** Verify your domain to increase the limit from 100 to 1,000 requests/minute.

### Widget styles conflicting with my page

The widget uses Shadow DOM for style isolation. If you still see issues, ensure no global JavaScript is modifying the widget's container element (`#nebelus-widget-container`).

### File upload fails

1. Check the file size is under `maxFileSize` (default: 10 MB).
2. Check the file type is in the `allowedFileTypes` list.
3. Verify your API key has file upload permissions.
4. Enable `debug: true` and check console logs for detailed error messages.

### How do I completely remove the widget?

Call `NebelusWidget.destroy()`. This removes all DOM elements and cleans up event listeners. To also clear persisted data, call `NebelusWidget.clearHistory()` before destroying.

```javascript
NebelusWidget.clearHistory();
NebelusWidget.destroy();
```
