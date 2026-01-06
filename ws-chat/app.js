/**
 * Nebelus WebSocket Chat Example
 *
 * Demonstrates real-time bidirectional communication with AI agents
 * using the Nebelus WebSocket API.
 *
 * Events handled:
 * - connection: Initial connection with thread_id
 * - message_start: Beginning of assistant response
 * - content_block: Streaming content (text, tool_use, tool_result)
 * - message_stop: Response complete
 * - usage_metadata: Token usage statistics
 * - human_approval: Workflow paused for user decision
 * - cancel_acknowledged: Cancel request received
 * - pong: Response to ping
 * - error: Error notification
 */

class NebelusWebSocketChat {
  constructor() {
    this.ws = null
    this.threadId = null
    this.isStreaming = false
    this.currentAssistantMessage = ""
    this.pingInterval = null

    // DOM elements
    this.elements = {
      apiUrl: document.getElementById("apiUrl"),
      agentId: document.getElementById("agentId"),
      apiKey: document.getElementById("apiKey"),
      threadId: document.getElementById("threadId"),
      connectBtn: document.getElementById("connectBtn"),
      disconnectBtn: document.getElementById("disconnectBtn"),
      statusDot: document.getElementById("statusDot"),
      statusText: document.getElementById("statusText"),
      threadInfo: document.getElementById("threadInfo"),
      chatMessages: document.getElementById("chatMessages"),
      messageInput: document.getElementById("messageInput"),
      sendBtn: document.getElementById("sendBtn"),
      cancelBtn: document.getElementById("cancelBtn"),
      debugHeader: document.getElementById("debugHeader"),
      debugToggle: document.getElementById("debugToggle"),
      debugContent: document.getElementById("debugContent"),
      usageInfo: document.getElementById("usageInfo"),
      inputTokens: document.getElementById("inputTokens"),
      outputTokens: document.getElementById("outputTokens"),
      modelName: document.getElementById("modelName")
    }

    this.init()
  }

  init() {
    // Load saved config from localStorage
    this.loadConfig()

    // Event listeners
    this.elements.connectBtn.addEventListener("click", () => this.connect())
    this.elements.disconnectBtn.addEventListener("click", () => this.disconnect())
    this.elements.sendBtn.addEventListener("click", () => this.sendMessage())
    this.elements.cancelBtn.addEventListener("click", () => this.cancelGeneration())

    this.elements.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    this.elements.debugHeader.addEventListener("click", () => {
      const content = this.elements.debugContent
      const toggle = this.elements.debugToggle
      content.classList.toggle("show")
      toggle.textContent = content.classList.contains("show") ? "Hide" : "Show"
    })

    // Save config on change
    ;["apiUrl", "agentId", "apiKey", "threadId"].forEach((id) => {
      this.elements[id].addEventListener("change", () => this.saveConfig())
    })
  }

  loadConfig() {
    const config = JSON.parse(localStorage.getItem("nebelus_ws_config") || "{}")
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
    localStorage.setItem("nebelus_ws_config", JSON.stringify(config))
  }

  connect() {
    const apiUrl = this.elements.apiUrl.value.trim()
    const agentId = this.elements.agentId.value.trim()
    const apiKey = this.elements.apiKey.value.trim()
    const threadId = this.elements.threadId.value.trim()

    if (!apiUrl || !agentId || !apiKey) {
      this.addSystemMessage("Please fill in API URL, Agent ID, and API Key")
      return
    }

    this.setStatus("connecting")

    // Build WebSocket URL based on whether we have a thread ID
    let wsUrl
    if (threadId) {
      // Continue existing thread
      wsUrl = `${apiUrl}/ws/agents/${agentId}/threads/${threadId}/?api_key=${apiKey}`
    } else {
      // Create new thread
      wsUrl = `${apiUrl}/ws/agents/${agentId}/chat/?api_key=${apiKey}`
    }

    this.logDebug("connect", { url: wsUrl.replace(apiKey, "***") })

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => this.handleOpen()
      this.ws.onmessage = (event) => this.handleMessage(event)
      this.ws.onerror = (error) => this.handleError(error)
      this.ws.onclose = (event) => this.handleClose(event)
    } catch (error) {
      this.setStatus("disconnected")
      this.addSystemMessage(`Connection failed: ${error.message}`)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, "User disconnected")
    }
    this.cleanup()
  }

  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    this.ws = null
    this.isStreaming = false
    this.setStatus("disconnected")
    this.updateInputState(false)
  }

  handleOpen() {
    this.setStatus("connected")
    this.logDebug("open", { message: "WebSocket connected" })

    // Start ping interval (every 30 seconds)
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }))
        this.logDebug("ping", { timestamp: new Date().toISOString() })
      }
    }, 30000)
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data)
      this.logDebug(message.event, message.data)

      switch (message.event) {
        case "connection":
          this.handleConnectionEvent(message.data)
          break

        case "message_start":
          this.handleMessageStart(message.data)
          break

        case "content_block":
          this.handleContentBlock(message.data)
          break

        case "message_stop":
          this.handleMessageStop(message.data)
          break

        case "usage_metadata":
          this.handleUsageMetadata(message.data)
          break

        case "human_approval":
          this.handleHumanApproval(message.data)
          break

        case "cancel_acknowledged":
          this.handleCancelAcknowledged(message.data)
          break

        case "pong":
          // Pong received, connection is alive
          break

        case "error":
          this.handleErrorEvent(message.data)
          break

        default:
          console.log("Unknown event:", message.event, message.data)
      }
    } catch (error) {
      console.error("Failed to parse message:", error, event.data)
    }
  }

  handleConnectionEvent(data) {
    this.threadId = data.thread_id
    this.elements.threadInfo.textContent = `Thread: ${data.thread_id.slice(0, 8)}...`
    this.elements.threadId.value = data.thread_id

    this.addSystemMessage(`Connected to agent "${data.agent_name || data.agent_id}"`)
    this.updateInputState(true)
  }

  handleMessageStart(data) {
    this.isStreaming = true
    this.currentAssistantMessage = ""
    this.elements.cancelBtn.disabled = false

    // Create assistant message container
    this.createAssistantMessage()
  }

  handleContentBlock(data) {
    const { index, content_type, state, data: blockData } = data

    // Enable cancel button when receiving content (fallback if message_start wasn't received)
    if (!this.isStreaming && state === "start") {
      this.isStreaming = true
      this.currentAssistantMessage = ""
      this.elements.cancelBtn.disabled = false
      this.createAssistantMessage()
    }

    if (content_type === "text") {
      if (state === "delta" && blockData?.text) {
        // Append streaming text
        this.currentAssistantMessage += blockData.text
        this.updateAssistantMessage(this.currentAssistantMessage, true)
      } else if (state === "complete") {
        // Text block complete
        this.updateAssistantMessage(this.currentAssistantMessage, false)
      }
    } else if (content_type === "thinking") {
      // Handle thinking/reasoning blocks
      if (state === "delta" && blockData?.thinking) {
        this.addThinkingContent(blockData.thinking)
      }
    } else if (content_type === "tool_use") {
      // Handle tool use
      if (state === "complete" && blockData) {
        this.addToolUseMessage(blockData)
      }
    } else if (content_type === "tool_result") {
      // Handle tool result
      if (state === "complete" && blockData) {
        this.addToolResultMessage(blockData)
      }
    }
  }

  handleMessageStop(data) {
    this.isStreaming = false
    this.elements.cancelBtn.disabled = true

    // Remove streaming indicator
    this.updateAssistantMessage(this.currentAssistantMessage, false)

    if (data.stop_reason === "cancelled") {
      this.addSystemMessage("Generation cancelled by user")
    }
  }

  handleUsageMetadata(data) {
    this.elements.usageInfo.style.display = "flex"
    this.elements.inputTokens.textContent = data.input_tokens || 0
    this.elements.outputTokens.textContent = data.output_tokens || 0
    this.elements.modelName.textContent = data.model || "-"
  }

  handleHumanApproval(data) {
    this.isStreaming = false

    // Display approval request
    const tools = data.data?.tools || []
    let message = "Agent is requesting approval:\n\n"

    tools.forEach((tool, i) => {
      message += `${i + 1}. ${tool.name}\n`
      if (tool.args) {
        message += `   Args: ${JSON.stringify(tool.args, null, 2)}\n`
      }
    })

    message += "\nUse the approve/reject buttons to respond."

    this.addApprovalMessage(message, data)
  }

  handleCancelAcknowledged(data) {
    this.addSystemMessage(data.message || "Cancel request acknowledged")
  }

  handleErrorEvent(data) {
    const errorMessage = data.message || data.type || "Unknown error"
    this.addSystemMessage(`Error: ${errorMessage}`)

    if (data.type === "authentication_error") {
      this.disconnect()
    }
  }

  handleError(error) {
    this.logDebug("error", { message: "WebSocket error" })
    this.addSystemMessage("WebSocket error occurred")
  }

  handleClose(event) {
    this.logDebug("close", { code: event.code, reason: event.reason })

    const reasons = {
      1000: "Normal closure",
      4001: "Authentication required",
      4002: "No organization context",
      4003: "Access forbidden",
      4004: "Not found / Agent inactive"
    }

    const reason = reasons[event.code] || event.reason || "Unknown"
    this.addSystemMessage(`Disconnected: ${reason} (code: ${event.code})`)
    this.cleanup()
  }

  sendMessage() {
    const content = this.elements.messageInput.value.trim()

    if (!content || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    // Add user message to chat
    this.addUserMessage(content)

    // Send via WebSocket
    const message = {
      type: "chat",
      content: content
    }

    this.ws.send(JSON.stringify(message))
    this.logDebug("send", message)

    // Clear input
    this.elements.messageInput.value = ""
  }

  cancelGeneration() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isStreaming) {
      this.ws.send(JSON.stringify({ type: "cancel" }))
      this.logDebug("cancel", { timestamp: new Date().toISOString() })
    }
  }

  sendApprovalDecision(decisions) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: "interrupt_resume",
        decisions: decisions
      }
      this.ws.send(JSON.stringify(message))
      this.logDebug("interrupt_resume", message)
    }
  }

  // UI Methods

  setStatus(status) {
    const dot = this.elements.statusDot
    const text = this.elements.statusText

    dot.className = "status-dot"

    switch (status) {
      case "connected":
        dot.classList.add("connected")
        text.textContent = "Connected"
        this.elements.connectBtn.disabled = true
        this.elements.disconnectBtn.disabled = false
        break
      case "connecting":
        dot.classList.add("connecting")
        text.textContent = "Connecting..."
        this.elements.connectBtn.disabled = true
        this.elements.disconnectBtn.disabled = true
        break
      case "disconnected":
      default:
        text.textContent = "Disconnected"
        this.elements.connectBtn.disabled = false
        this.elements.disconnectBtn.disabled = true
        this.elements.threadInfo.textContent = ""
    }
  }

  updateInputState(enabled) {
    this.elements.messageInput.disabled = !enabled
    this.elements.sendBtn.disabled = !enabled
    if (enabled) {
      this.elements.messageInput.focus()
    }
  }

  addUserMessage(content) {
    const html = `
      <div class="message user">
        <div class="message-header">
          <span class="message-role user">You</span>
        </div>
        <div class="message-content">${this.escapeHtml(content)}</div>
      </div>
    `
    this.appendMessage(html)
  }

  createAssistantMessage() {
    const html = `
      <div class="message assistant" id="current-assistant-message">
        <div class="message-header">
          <span class="message-role assistant">Assistant</span>
        </div>
        <div class="message-content"><span class="streaming-indicator"></span></div>
      </div>
    `
    this.appendMessage(html)
  }

  updateAssistantMessage(content, isStreaming) {
    const msgEl = document.getElementById("current-assistant-message")
    if (msgEl) {
      const contentEl = msgEl.querySelector(".message-content")
      contentEl.innerHTML = this.escapeHtml(content) + (isStreaming ? '<span class="streaming-indicator"></span>' : "")

      if (!isStreaming) {
        msgEl.removeAttribute("id")
      }
    }
  }

  addThinkingContent(thinking) {
    // For simplicity, append thinking to the current message
    // In a real app, you might display this differently
    console.log("Thinking:", thinking)
  }

  addToolUseMessage(data) {
    const html = `
      <div class="message system">
        <div class="message-header">
          <span class="message-role system">Tool: ${this.escapeHtml(data.name)}</span>
        </div>
        <div class="message-content">
          <strong>Input:</strong>
          <pre>${this.escapeHtml(JSON.stringify(data.input, null, 2))}</pre>
        </div>
      </div>
    `
    this.appendMessage(html)
  }

  addToolResultMessage(data) {
    const html = `
      <div class="message system">
        <div class="message-header">
          <span class="message-role system">Result: ${this.escapeHtml(data.name)}</span>
        </div>
        <div class="message-content">${this.escapeHtml(
          typeof data.content === "string" ? data.content : JSON.stringify(data.content, null, 2)
        )}</div>
      </div>
    `
    this.appendMessage(html)
  }

  addApprovalMessage(content, data) {
    const id = `approval-${Date.now()}`
    const html = `
      <div class="message system" id="${id}">
        <div class="message-header">
          <span class="message-role system">Approval Required</span>
        </div>
        <div class="message-content">
          ${this.escapeHtml(content)}
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="btn-primary" onclick="chat.handleApproval('${id}', 'approve')">Approve</button>
            <button class="btn-danger" onclick="chat.handleApproval('${id}', 'reject')">Reject</button>
          </div>
        </div>
      </div>
    `
    this.appendMessage(html)
  }

  handleApproval(elementId, decision) {
    const decisions = [{ type: decision }]
    this.sendApprovalDecision(decisions)

    // Update UI
    const el = document.getElementById(elementId)
    if (el) {
      const buttons = el.querySelectorAll("button")
      buttons.forEach((btn) => (btn.disabled = true))

      const statusText = document.createElement("div")
      statusText.style.marginTop = "8px"
      statusText.style.color = decision === "approve" ? "#22c55e" : "#dc2626"
      statusText.textContent = decision === "approve" ? "Approved" : "Rejected"
      el.querySelector(".message-content").appendChild(statusText)
    }
  }

  addSystemMessage(content) {
    const html = `
      <div class="message system">
        <div class="message-header">
          <span class="message-role system">System</span>
        </div>
        <div class="message-content">${this.escapeHtml(content)}</div>
      </div>
    `
    this.appendMessage(html)
  }

  appendMessage(html) {
    this.elements.chatMessages.insertAdjacentHTML("beforeend", html)
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight
  }

  logDebug(event, data) {
    const time = new Date().toLocaleTimeString()
    const dataStr = typeof data === "object" ? JSON.stringify(data) : data

    const html = `
      <div class="debug-entry">
        <span class="debug-time">[${time}]</span>
        <span class="debug-event">${event}</span>
        <div class="debug-data">${this.escapeHtml(dataStr)}</div>
      </div>
    `

    this.elements.debugContent.insertAdjacentHTML("afterbegin", html)

    // Limit entries
    const entries = this.elements.debugContent.querySelectorAll(".debug-entry")
    if (entries.length > 100) {
      entries[entries.length - 1].remove()
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize chat
const chat = new NebelusWebSocketChat()
