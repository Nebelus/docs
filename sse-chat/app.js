/**
 * Nebelus SSE Chat Example
 *
 * Demonstrates text-based chat with AI agents using Server-Sent Events (SSE)
 * for streaming responses. This is simpler than WebSocket and works well
 * for request/response patterns like chat.
 *
 * SSE Events handled:
 * - message_start: Beginning of assistant response
 * - content_block: Streaming content with states (start, delta, complete)
 * - message_stop: Response complete
 * - message_delta: Metadata updates (stop_reason)
 * - usage_metadata: Token usage statistics
 * - error: Error notification
 */

class NebelusSSEChat {
  constructor() {
    this.abortController = null
    this.threadId = null
    this.isStreaming = false

    // DOM elements
    this.elements = {
      apiUrl: document.getElementById("apiUrl"),
      agentId: document.getElementById("agentId"),
      apiKey: document.getElementById("apiKey"),
      threadId: document.getElementById("threadId"),
      chatMessages: document.getElementById("chatMessages"),
      messageInput: document.getElementById("messageInput"),
      sendBtn: document.getElementById("sendBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      clearBtn: document.getElementById("clearBtn"),
      debugLog: document.getElementById("debugLog"),
      usageInfo: document.getElementById("usageInfo"),
      inputTokens: document.getElementById("inputTokens"),
      outputTokens: document.getElementById("outputTokens"),
      modelName: document.getElementById("modelName")
    }

    this.init()
  }

  init() {
    // Load saved config
    this.loadConfig()

    // Enter key sends message
    this.elements.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    // Save config on change
    ;["apiUrl", "agentId", "apiKey"].forEach((id) => {
      this.elements[id].addEventListener("change", () => this.saveConfig())
    })
  }

  loadConfig() {
    const config = JSON.parse(localStorage.getItem("nebelus_sse_config") || "{}")
    if (config.apiUrl) {
      this.elements.apiUrl.value = config.apiUrl
    }
    if (config.agentId) {
      this.elements.agentId.value = config.agentId
    }
    if (config.apiKey) {
      this.elements.apiKey.value = config.apiKey
    }
  }

  saveConfig() {
    const config = {
      apiUrl: this.elements.apiUrl.value,
      agentId: this.elements.agentId.value,
      apiKey: this.elements.apiKey.value
    }
    localStorage.setItem("nebelus_sse_config", JSON.stringify(config))
  }

  async sendMessage() {
    const apiUrl = this.elements.apiUrl.value.trim()
    const agentId = this.elements.agentId.value.trim()
    const apiKey = this.elements.apiKey.value.trim()
    const threadId = this.elements.threadId.value.trim()
    const content = this.elements.messageInput.value.trim()

    // Validation
    if (!agentId || !apiKey) {
      this.addSystemMessage("Please enter Agent ID and API Key")
      return
    }

    if (!content) {
      return
    }

    // Clear input and disable send
    this.elements.messageInput.value = ""
    this.elements.sendBtn.disabled = true
    this.elements.cancelBtn.disabled = false
    this.isStreaming = true

    // Add user message to chat
    this.addUserMessage(content)

    // Create abort controller for cancellation
    this.abortController = new AbortController()

    try {
      // Build endpoint URL
      const endpoint = `${apiUrl}/api/agents/${agentId}/chat/`

      // Build request body - include thread_id if provided
      const requestBody = {
        messages: [{ role: "user", content }]
      }
      if (threadId) {
        requestBody.thread_id = threadId
      }

      this.logDebug("request", { endpoint, thread_id: threadId || "(new)", content: content.substring(0, 50) + "..." })

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      this.logDebug("stream_start", { status: response.status })

      // Process SSE stream
      await this.processSSEStream(response)
    } catch (error) {
      if (error.name === "AbortError") {
        this.addSystemMessage("Request cancelled")
        this.logDebug("cancelled", {})
      } else {
        this.addSystemMessage(`Error: ${error.message}`)
        this.logDebug("error", { message: error.message })
      }
    } finally {
      this.isStreaming = false
      this.elements.sendBtn.disabled = false
      this.elements.cancelBtn.disabled = true
      this.abortController = null
    }
  }

  async processSSEStream(response) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    let assistantMessageId = "assistant-" + Date.now()
    let fullContent = ""
    let messageCreated = false

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          this.logDebug("stream_end", { totalChars: fullContent.length })
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Process complete SSE messages (separated by double newline)
        const messages = buffer.split("\n\n")
        buffer = messages.pop() || ""

        for (const message of messages) {
          if (!message.trim()) {
            continue
          }

          const lines = message.split("\n")
          let eventType = ""
          let eventData = null

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6).trim()
                if (jsonStr && jsonStr !== "[DONE]") {
                  eventData = JSON.parse(jsonStr)
                }
              } catch (e) {
                console.warn("Failed to parse SSE data:", line, e)
              }
            }
          }

          if (!eventType || !eventData) {
            continue
          }

          this.logDebug(eventType, eventData)

          // Handle events
          switch (eventType) {
            case "message_start":
              if (eventData.message?.id) {
                assistantMessageId = "assistant-" + eventData.message.id
              }
              // Extract thread_id if present
              if (eventData.thread_id) {
                this.threadId = eventData.thread_id
                this.elements.threadId.value = eventData.thread_id
              }
              break

            case "content_block":
              if (eventData.state === "start") {
                // Content block started
              } else if (eventData.state === "delta") {
                const deltaText = eventData.data?.text || ""
                if (deltaText) {
                  fullContent += deltaText

                  if (!messageCreated) {
                    this.addAssistantMessage(fullContent, assistantMessageId, true)
                    messageCreated = true
                  } else {
                    this.updateAssistantMessage(assistantMessageId, fullContent, true)
                  }
                }
              } else if (eventData.state === "complete") {
                // Content block complete
              }
              break

            case "message_stop":
              // Finalize message
              if (messageCreated) {
                this.updateAssistantMessage(assistantMessageId, fullContent, false)
              }
              break

            case "message_delta":
              // Stop reason, etc.
              if (eventData.delta?.stop_reason) {
                this.logDebug("stop_reason", { reason: eventData.delta.stop_reason })
              }
              break

            case "usage_metadata":
              if (eventData.usage) {
                this.showUsage(eventData.usage, eventData.model)
              }
              break

            case "error":
              this.addSystemMessage(`Error: ${JSON.stringify(eventData)}`)
              break
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  cancelRequest() {
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  // UI Methods

  addUserMessage(content) {
    this.clearPlaceholder()

    const html = `
      <div class="flex justify-end">
        <div class="bg-indigo-600 text-white px-4 py-2 rounded-lg max-w-[80%] break-words">
          ${this.escapeHtml(content)}
        </div>
      </div>
    `
    this.elements.chatMessages.insertAdjacentHTML("beforeend", html)
    this.scrollToBottom()
  }

  addAssistantMessage(content, messageId, isStreaming) {
    this.clearPlaceholder()

    const streamingCursor = isStreaming ? '<span class="streaming-cursor"></span>' : ""
    const html = `
      <div id="${messageId}" class="flex justify-start">
        <div class="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg max-w-[80%] break-words whitespace-pre-wrap">
          ${this.escapeHtml(content)}${streamingCursor}
        </div>
      </div>
    `
    this.elements.chatMessages.insertAdjacentHTML("beforeend", html)
    this.scrollToBottom()
  }

  updateAssistantMessage(messageId, content, isStreaming) {
    const msgEl = document.getElementById(messageId)
    if (!msgEl) {
      this.addAssistantMessage(content, messageId, isStreaming)
      return
    }

    const bubble = msgEl.querySelector("div")
    if (bubble) {
      const streamingCursor = isStreaming ? '<span class="streaming-cursor"></span>' : ""
      bubble.innerHTML = this.escapeHtml(content) + streamingCursor
    }
    this.scrollToBottom()
  }

  addSystemMessage(content) {
    this.clearPlaceholder()

    const html = `
      <div class="flex justify-center">
        <div class="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-sm">
          ${this.escapeHtml(content)}
        </div>
      </div>
    `
    this.elements.chatMessages.insertAdjacentHTML("beforeend", html)
    this.scrollToBottom()
  }

  clearPlaceholder() {
    const placeholder = this.elements.chatMessages.querySelector("p.text-center")
    if (placeholder) {
      placeholder.remove()
    }
  }

  clearChat() {
    this.elements.chatMessages.innerHTML =
      '<p class="text-center text-gray-400 py-10">Enter your Agent ID and API Key to start chatting.</p>'
    this.elements.usageInfo.classList.add("hidden")
    this.logDebug("chat_cleared", {})
  }

  showUsage(usage, model) {
    this.elements.usageInfo.classList.remove("hidden")
    this.elements.inputTokens.textContent = usage.input_tokens || 0
    this.elements.outputTokens.textContent = usage.output_tokens || 0
    this.elements.modelName.textContent = model || "-"
  }

  scrollToBottom() {
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight
  }

  logDebug(event, data) {
    const time = new Date().toLocaleTimeString()
    const dataStr = typeof data === "object" ? JSON.stringify(data) : data

    // Clear placeholder
    const placeholder = this.elements.debugLog.querySelector("p.text-gray-500")
    if (placeholder) {
      placeholder.remove()
    }

    const html = `<div class="mb-1"><span class="text-gray-500">[${time}]</span> <span class="text-blue-400">${event}</span> ${this.escapeHtml(dataStr)}</div>`
    this.elements.debugLog.insertAdjacentHTML("beforeend", html)

    // Limit entries
    const entries = this.elements.debugLog.querySelectorAll("div")
    if (entries.length > 100) {
      entries[0].remove()
    }

    // Auto-scroll debug log
    this.elements.debugLog.scrollTop = this.elements.debugLog.scrollHeight
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize
const chat = new NebelusSSEChat()
