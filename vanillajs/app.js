// Tab switching function
function switchTab(tabName) {
  // Hide all tab contents and remove background
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.add("hidden")
    content.classList.remove("bg-indigo-50", "p-6", "rounded-lg", "border-2", "border-indigo-100")
  })

  // Remove active state from all tabs
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.remove("border-indigo-600", "text-indigo-600", "bg-indigo-50", "rounded-t-lg")
    button.classList.add("border-transparent", "text-gray-600")
    button.setAttribute("aria-selected", "false")
  })

  // Show selected tab content with background
  const activeContent = document.getElementById(`content-${tabName}`)
  activeContent.classList.remove("hidden")
  activeContent.classList.add("bg-indigo-50", "p-6", "rounded-lg", "border-2", "border-indigo-100")

  // Add active state to selected tab
  const activeTab = document.getElementById(`tab-${tabName}`)
  activeTab.classList.remove("border-transparent", "text-gray-600")
  activeTab.classList.add("border-indigo-600", "text-indigo-600", "bg-indigo-50", "rounded-t-lg")
  activeTab.setAttribute("aria-selected", "true")
}

// Global state
let socket = null
let isConnected = false
let isTranslating = false
let sessionDuration = 0
let sessionInterval = null
let translationCount = 0
let audioChunksSent = 0
let pingInterval = null
let audioContext = null
let ttsAudioContext = null // Separate context for TTS playback
let audioStream = null
let mediaStreamSource = null
let audioProcessor = null
let pcmBuffer = new Float32Array(0)
let lastAudioSendTime = 0
const minChunkDuration = 500 // 500ms
let pendingSessionStart = false // Track if we're waiting for session confirmation

// Translation session tracking
let translationSessionId = null

// Voice conversation state
let voiceSessionId = null
let voiceSessionState = "idle"
let voiceTurns = 0
let voiceMessages = 0
let ttsAudioQueue = []
let isPlayingTTS = false

// Translation TTS queue (separate from voice conversation)
let translationTTSQueue = []
let isPlayingTranslationTTS = false

// Track active audio sources for interruption (like Vue component)
let activeVoiceAudioSources = []
let activeTranslationAudioSources = []

// Voice audio streaming
let voiceMediaStream = null
let voiceAudioContext = null
let voiceProcessor = null
let voicePcmBuffer = new Float32Array(0)
let voiceLastSendTime = 0
const VOICE_MIN_CHUNK_DURATION = 1000 // 1 second
const VOICE_MAX_CHUNK_DURATION = 2000 // 2 seconds

// DOM elements
const connectionStatus = document.getElementById("connectionStatus")
const connectBtn = document.getElementById("connectBtn")
const disconnectBtn = document.getElementById("disconnectBtn")
const updateSettingsBtn = document.getElementById("updateSettingsBtn")
const startBtn = document.getElementById("startBtn")
const stopBtn = document.getElementById("stopBtn")
const startVoiceBtn = document.getElementById("startVoiceBtn")
const stopVoiceBtn = document.getElementById("stopVoiceBtn")
const sendChatBtn = document.getElementById("sendChatBtn")
const translationsDiv = document.getElementById("translations")
const eventLog = document.getElementById("eventLog")
const chatMessages = document.getElementById("chatMessages")
const chatInput = document.getElementById("chatInput")

// Utility functions
function log(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString()
  const entry = document.createElement("div")
  const typeClasses = {
    error: "mb-1 text-red-500",
    success: "mb-1 text-green-500",
    info: "mb-1 text-blue-500"
  }
  entry.className = typeClasses[type] || typeClasses.info
  entry.textContent = `[${timestamp}] ${message}`
  eventLog.appendChild(entry)
  eventLog.scrollTop = eventLog.scrollHeight
  console.log(`[${type.toUpperCase()}]`, message)
}

function clearLog() {
  eventLog.innerHTML = ""
}

function updateStatus(status, message) {
  const statusClasses = {
    connected: "p-4 rounded-lg mb-5 font-medium bg-green-100 text-green-800 border-2 border-green-500",
    disconnected: "p-4 rounded-lg mb-5 font-medium bg-red-100 text-red-800 border-2 border-red-500",
    connecting: "p-4 rounded-lg mb-5 font-medium bg-yellow-100 text-yellow-800 border-2 border-yellow-500"
  }
  connectionStatus.className = statusClasses[status] || statusClasses.disconnected
  const icons = {
    connected: "🟢",
    disconnected: "⚫",
    connecting: "🟡"
  }
  connectionStatus.textContent = `${icons[status]} ${message}`
}

function updateStats() {
  document.getElementById("sessionDuration").textContent = formatDuration(sessionDuration)
  document.getElementById("translationCount").textContent = translationCount
  document.getElementById("audioChunks").textContent = audioChunksSent
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

// WebSocket connection
async function connect() {
  const apiUrl = document.getElementById("apiUrl").value.trim()
  const apiKey = document.getElementById("authToken").value.trim()

  // Validate API key
  if (!apiKey) {
    alert("Please enter an API key")
    return
  }

  // Initialize and resume AudioContext on user interaction (required by browser autoplay policy)
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext = new AudioContextClass()
    log("AudioContext initialized", "info")
  }

  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume()
      log("AudioContext resumed (ready for audio playback)", "success")
    } catch (error) {
      log(`Warning: Could not resume AudioContext: ${error.message}`, "error")
    }
  }

  const wsUrl = `${apiUrl}/stream/?api_key=${encodeURIComponent(apiKey)}`
  log(`Connecting to ${apiUrl} with API key authentication...`, "info")
  updateStatus("connecting", "Connecting...")

  try {
    socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      isConnected = true
      updateStatus("connected", "Connected")
      log("WebSocket connection established", "success")
      connectBtn.disabled = true
      disconnectBtn.disabled = false
      updateSettingsBtn.disabled = false
      // Enable start button - user can initiate translation session
      startBtn.disabled = false
      startVoiceBtn.disabled = false
      // Chat doesn't need WebSocket - uses SSE independently

      // Start heartbeat
      startHeartbeat()

      log('Connected. Click "Start Translation" to begin.', "info")
    }

    socket.onerror = (error) => {
      log(`WebSocket error: ${error.message || "Unknown error"}`, "error")
      updateStatus("disconnected", "Connection Error")
    }

    socket.onclose = (event) => {
      isConnected = false
      updateStatus("disconnected", "Disconnected")
      log(`WebSocket closed: Code ${event.code}, Reason: ${event.reason || "None"}`, "error")

      // Stop heartbeat
      stopHeartbeat()

      // Stop translation if active
      if (isTranslating) {
        stopTranslation()
      }

      // Stop voice conversation if active
      if (voiceSessionId) {
        stopVoiceAudioCapture()
        voiceSessionId = null
        voiceSessionState = "idle"
      }

      // Update UI buttons
      connectBtn.disabled = false
      disconnectBtn.disabled = true
      updateSettingsBtn.disabled = true
      startBtn.disabled = true
      stopBtn.disabled = true
      startVoiceBtn.disabled = true
      stopVoiceBtn.disabled = true
      // Chat uses SSE independently, doesn't need WebSocket
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleIncomingEvent(data)
      } catch (error) {
        log(`Failed to parse message: ${error.message}`, "error")
      }
    }
  } catch (error) {
    log(`Connection error: ${error.message}`, "error")
    updateStatus("disconnected", "Connection Failed")
  }
}

function disconnect() {
  if (socket) {
    socket.close()
    socket = null
  }

  // Clean up any active audio captures
  if (isTranslating) {
    stopTranslation()
  }
  stopVoiceAudioCapture()

  // Reset voice session state
  voiceSessionId = null
  voiceSessionState = "idle"
}

// Heartbeat mechanism
function startHeartbeat() {
  pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendEvent("PING", {})
    }
  }, 120000) // 2 minutes
}

function stopHeartbeat() {
  if (pingInterval) {
    clearInterval(pingInterval)
    pingInterval = null
  }
}

// Event handling
function sendEvent(event, data) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    log(`Cannot send event: WebSocket not connected`, "error")
    return false
  }

  const message = { event, ...data }
  socket.send(JSON.stringify(message))
  log(`Sent: ${event}`, "info")
  return true
}

function handleIncomingEvent(data) {
  const { event, content } = data

  log(`Received: ${event}`, "info")

  switch (event) {
    case "PONG":
      log("Heartbeat received (PONG)", "success")
      break

    case "TRANSLATION_SESSION_START":
      handleTranslationStart(content)
      break

    case "TRANSLATION_RESULT":
      handleTranslationResult(content)
      break

    case "TRANSLATION_COMPLETE":
      handleTranslationComplete(content)
      break

    case "TRANSLATION_SESSION_ERROR":
      handleTranslationError(content)
      break

    case "TRANSLATION_SESSION_END":
      log("Translation session ended", "info")
      break

    // Voice conversation events
    case "VOICE_SESSION_CREATED":
      handleVoiceSessionCreated(content)
      break

    case "VOICE_SESSION_STATE_CHANGED":
      handleVoiceSessionStateChanged(content)
      break

    case "VOICE_SESSION_ENDED":
      handleVoiceSessionEnded(content)
      break

    case "VOICE_TURN_START":
      handleVoiceTurnStart(content)
      break

    case "VOICE_TURN_END":
      handleVoiceTurnEnd(content)
      break

    case "VOICE_TURN_INTERRUPT":
      handleVoiceTurnInterrupt(content)
      break

    case "VOICE_AGENT_RESPONSE_START":
      handleAgentVoiceResponseStart(content)
      break

    case "VOICE_AGENT_RESPONSE_STREAM":
      handleAgentVoiceResponseStream(content)
      break

    case "VOICE_AGENT_RESPONSE_END":
      handleAgentVoiceResponseEnd(content)
      break

    case "VOICE_AGENT_RESPONSE_ERROR":
      handleAgentVoiceResponseError(content)
      break

    case "VOICE_OUTPUT_START":
      handleTTSStart(content)
      break

    case "VOICE_OUTPUT_AUDIO":
      handleTTSAudioChunk(content)
      break

    case "VOICE_OUTPUT_END":
      handleTTSEnd(content)
      break

    case "VOICE_OUTPUT_ERROR":
      handleTTSError(content)
      break

    case "VOICE_MESSAGE_CREATED":
      handleVoiceMessageCreated(content)
      break

    case "VOICE_ERROR":
      handleVoiceError(content)
      break

    case "AGENT_RECORDING_START":
      handleAgentRecordingStart(content)
      break

    case "AGENT_RECORDING_COMPLETE":
      handleAgentRecordingComplete(content)
      break

    case "AGENT_RECORDING_TRANSCRIPTION":
      handleAgentRecordingTranscription(content)
      break

    case "AGENT_RECORDING_ERROR":
      handleAgentRecordingError(content)
      break

    case "VOICE_INPUT_TRANSCRIPTION":
      handleVoiceTranscription(content, false)
      break

    case "VOICE_TRANSCRIPTION_PARTIAL":
      handleVoiceTranscription(content, true)
      break

    default:
      log(`Unhandled event: ${event}`, "info")
  }
}

function handleTranslationStart(content) {
  log(`Translation session started: ${content.session_id}`, "success")

  // Store session ID from server
  if (content.session_id) {
    translationSessionId = content.session_id
    pendingSessionStart = false // Session confirmed by server
  }

  // Reset counters for new session
  translationCount = 0
  audioChunksSent = 0
  updateStats()

  // Update settings with the new session_id and current settings
  // Use settings from TRANSLATION_SESSION_START if provided, otherwise use form values
  const languageA = content.language_a || document.getElementById("languageA").value
  const languageB = content.language_b || document.getElementById("languageB").value
  const context = document.getElementById("context").value.trim()
  const enableTts = content.enable_tts !== undefined ? content.enable_tts : document.getElementById("enableTts").checked

  // Update form values if provided by server
  if (content.language_a) {
    document.getElementById("languageA").value = content.language_a
  }
  if (content.language_b) {
    document.getElementById("languageB").value = content.language_b
  }
  if (content.enable_tts !== undefined) {
    document.getElementById("enableTts").checked = content.enable_tts
  }

  // Send updated settings to server
  const settings = {
    session_id: content.session_id,
    language_a: languageA,
    language_b: languageB,
    enable_tts: enableTts
  }

  if (context) {
    settings.context = context
  }

  sendEvent("TRANSLATION_SETTINGS_UPDATE", settings)

  // Automatically start audio streaming after a short delay (if not already started)
  if (!isTranslating && !audioStream) {
    setTimeout(async () => {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        log("getUserMedia is not available. This page must be served over HTTPS or localhost.", "error")
        log('Audio streaming will not start automatically. Click "Start Translation" after ensuring HTTPS/localhost.', "info")
        startBtn.disabled = false // Enable button so user can try manually
        return
      }

      try {
        // Request microphone access
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        log("Microphone access granted", "success")

        // Initialize audio processing
        await initializeAudioStreaming()

        // Start sending audio
        isTranslating = true
        startBtn.disabled = true
        stopBtn.disabled = false
        sessionDuration = 0
        if (sessionInterval) {
          clearInterval(sessionInterval)
        }
        sessionInterval = setInterval(() => {
          sessionDuration++
          updateStats()
        }, 1000)

        log("Audio streaming started automatically", "success")
      } catch (error) {
        log(`Failed to start audio streaming: ${error.message}`, "error")
        log('You can try clicking "Start Translation" manually after granting microphone permission.', "info")
        startBtn.disabled = false // Enable button so user can try manually
      }
    }, 200)
  } else {
    // Session already started, just update the UI
    isTranslating = true
    startBtn.disabled = true
    stopBtn.disabled = false
    sessionDuration = 0
    if (sessionInterval) {
      clearInterval(sessionInterval)
    }
    sessionInterval = setInterval(() => {
      sessionDuration++
      updateStats()
    }, 1000)
  }

  // Enable the start button so user can manually start if auto-start doesn't work
  // (It will be disabled again if auto-start succeeds)
  setTimeout(() => {
    if (!isTranslating) {
      startBtn.disabled = false
    }
  }, 500)
}

function handleTranslationResult(content) {
  translationCount++
  updateStats()

  // Add to translations display
  if (translationsDiv.querySelector("p")) {
    translationsDiv.innerHTML = ""
  }

  const item = document.createElement("div")
  item.className = "bg-white p-4 mb-4 rounded-lg border-l-4 border-indigo-600 shadow"
  item.innerHTML = `
        <div class="flex justify-between mb-2.5 text-xs text-gray-600">
            <span>${content.speaker || "Speaker"}</span>
            <span class="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">${Math.round((content.confidence || 0) * 100)}% confidence</span>
        </div>
        <div class="mb-2">
            <strong class="text-indigo-600 block mb-1 text-xs uppercase">Original (${content.original_language})</strong>
            <p class="text-gray-800 text-sm leading-relaxed">${content.original_text}</p>
        </div>
        <div class="mb-2">
            <strong class="text-indigo-600 block mb-1 text-xs uppercase">Translation (${content.target_language})</strong>
            <p class="text-gray-800 text-sm leading-relaxed">${content.translated_text}</p>
        </div>
    `
  translationsDiv.insertBefore(item, translationsDiv.firstChild)

  log(`Translation received: "${content.original_text}" → "${content.translated_text}"`, "success")

  // Play TTS if available
  if (content.tts_audio && document.getElementById("enableTts").checked) {
    playTTSAudio(content.tts_audio)
  }
}

function handleTranslationComplete(content) {
  log(`Translation session completed: ${content.total_translations || 0} translations`, "success")
  isTranslating = false
  startBtn.disabled = false
  stopBtn.disabled = true
  if (sessionInterval) {
    clearInterval(sessionInterval)
    sessionInterval = null
  }

  // Note: Don't clear TTS queue here - let queued audio finish playing
  log(`Translation complete. ${translationTTSQueue.length} TTS audio(s) still in queue to play`, "info")
}

function handleTranslationError(content) {
  const errorMsg = content.error || "Unknown error"
  log(`Translation error: ${errorMsg}`, "error")

  // If session not found, the server might need to create it first
  // Don't spam alerts for repeated errors
  if (errorMsg.includes("session not found") || errorMsg.includes("not a valid UUID")) {
    if (!isTranslating) {
      // Only show alert if we're not already translating (to avoid spam)
      log("Session not found. The server may need to create the session first. Waiting for TRANSLATION_SESSION_START...", "info")
    }
  } else {
    alert(`Translation Error: ${errorMsg}`)
  }
}

// Voice conversation event handlers
function handleVoiceSessionCreated(content) {
  voiceSessionId = content.session_id
  voiceSessionState = "listening"
  voiceTurns = 0
  voiceMessages = 0

  // Clear any existing voice TTS queue from previous session
  ttsAudioQueue = []
  isPlayingTTS = false

  document.getElementById("voiceSessionId").textContent = content.session_id.substring(0, 8) + "..."
  updateVoiceState("listening", "Voice session active - listening")

  log(`Voice session created: ${content.session_id}`, "success")
  log(`  Agent ID: ${content.agent_id || "N/A"}`, "info")
  log(`  Thread ID: ${content.thread_id || "N/A"}`, "info")
  log(`  Interaction Mode: ${content.interaction_mode || "N/A"}`, "info")
  log("🎤 Audio streaming is now active - speaking to the agent...", "success")
}

function handleVoiceSessionStateChanged(content) {
  const newState = content.state
  const previousState = voiceSessionState
  voiceSessionState = newState

  updateVoiceState(newState, `State changed: ${previousState} → ${newState}`)

  log(`Voice session state changed: ${previousState} → ${newState}`, "info")
}

function handleVoiceSessionEnded(content) {
  updateVoiceState("ended", `Session ended: ${content.reason || "unknown"}`)

  // Stop audio capture
  stopVoiceAudioCapture()

  voiceSessionId = null
  voiceSessionState = "idle"
  document.getElementById("voiceSessionId").textContent = "-"

  // Reset UI buttons
  startVoiceBtn.disabled = false
  stopVoiceBtn.disabled = true

  log(`Voice session ended: ${content.reason || "unknown"}`, "info")
  log("🎤 Microphone stopped", "info")
}

function handleVoiceTurnStart(content) {
  log(`Voice turn started: ${content.turn_id} (speaker: ${content.speaker || "unknown"})`, "info")
}

function handleVoiceTurnEnd(content) {
  voiceTurns++
  document.getElementById("voiceTurns").textContent = voiceTurns

  log(`Voice turn ended: ${content.turn_id}`, "success")
  log(`  Text: "${content.text || "N/A"}"`, "info")
  log(`  Language: ${content.language || "N/A"}`, "info")
  log(`  Confidence: ${Math.round((content.confidence || 0) * 100)}%`, "info")

  // Don't display here - messages are already shown via VOICE_MESSAGE_CREATED
  // and VOICE_AGENT_RESPONSE_STREAM. This is just a turn end marker.
}

function handleVoiceTurnInterrupt(content) {
  const turnId = content.turn_id
  const reason = content.reason || "unknown"
  const interruptedTasks = content.interrupted_tasks || []

  log(`Voice turn interrupted: ${turnId || "N/A"}`, "info")
  log(`  Reason: ${reason}`, "info")
  if (interruptedTasks.length > 0) {
    log(`  Interrupted tasks: ${interruptedTasks.join(", ")}`, "info")
  }

  // Stop all audio playback immediately
  stopAllAudio()

  // Clear all audio queues
  ttsAudioQueue = []
  translationTTSQueue = []
  isPlayingTTS = false
  isPlayingTranslationTTS = false

  log("All audio stopped and queues cleared due to interruption", "info")

  // Clean up streaming message if interrupted
  if (currentStreamingMessageElement) {
    const streamingIndicator = currentStreamingMessageElement.querySelector(".animate-pulse")
    if (streamingIndicator) {
      streamingIndicator.remove()
    }
    currentStreamingMessageElement = null
  }

  // Transition back to listening if voice session is still active
  if (voiceSessionId && voiceSessionState !== "idle") {
    voiceSessionState = "listening"
    updateVoiceState("listening", "Agent interrupted - listening for speech")
  }
}

// Stop all audio sources (helper function for interrupt)
function stopAllAudio() {
  // Stop all active voice TTS audio sources
  if (activeVoiceAudioSources.length > 0) {
    log(`Stopping ${activeVoiceAudioSources.length} active voice audio source(s)`, "info")
    activeVoiceAudioSources.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch (error) {
        // Source may already be stopped
      }
    })
    activeVoiceAudioSources = []
  }

  // Stop all active translation TTS audio sources
  if (activeTranslationAudioSources.length > 0) {
    log(`Stopping ${activeTranslationAudioSources.length} active translation audio source(s)`, "info")
    activeTranslationAudioSources.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch (error) {
        // Source may already be stopped
      }
    })
    activeTranslationAudioSources = []
  }

  log("All audio sources stopped", "info")
}

// Track streaming agent message
let currentStreamingMessageElement = null

function handleAgentVoiceResponseStart(content) {
  log(`Agent voice response started: ${content.response_id || "N/A"}`, "info")

  // Reset streaming message for new response
  currentStreamingMessageElement = null
}

function handleAgentVoiceResponseStream(content) {
  // Get accumulated text from the stream
  const accumulatedText = content?.accumulated_text || content?.text || content?.text_chunk || ""

  log(`Agent response stream: ${accumulatedText.length} chars`, "info")

  // Update or create streaming message in UI
  if (!currentStreamingMessageElement) {
    // Create new streaming message
    const voiceEventsDiv = document.getElementById("voiceEvents")
    if (voiceEventsDiv) {
      // Remove ONLY the placeholder paragraph if it exists (don't clear all content!)
      const placeholder = voiceEventsDiv.querySelector("p.text-center.text-gray-400")
      if (placeholder) {
        placeholder.remove()
      }

      currentStreamingMessageElement = document.createElement("div")
      currentStreamingMessageElement.className = "bg-white p-4 mb-3 rounded-lg border-l-4 border-blue-600 shadow-sm"
      currentStreamingMessageElement.innerHTML = `
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-lg">🤖</span>
                    <strong class="text-blue-600 text-sm font-semibold uppercase">ASSISTANT</strong>
                    <span class="ml-2 text-xs text-gray-500 animate-pulse">● streaming...</span>
                </div>
                <p class="text-gray-800 text-base leading-relaxed" id="streamingMessageText">${accumulatedText}</p>
            `
      voiceEventsDiv.insertBefore(currentStreamingMessageElement, voiceEventsDiv.firstChild)
    }
  } else {
    // Update existing streaming message
    const textElement = currentStreamingMessageElement.querySelector("#streamingMessageText")
    if (textElement) {
      textElement.textContent = accumulatedText
    }
  }
}

function handleAgentVoiceResponseEnd(content) {
  const finalText = content?.total_text || content?.text || ""

  log(`Agent voice response ended: ${content.response_id || "N/A"}`, "success")
  log(`  Complete text (${finalText.length} chars): "${finalText.substring(0, 100)}..."`, "info")

  // Finalize streaming message - just remove the streaming indicator, keep everything else
  if (currentStreamingMessageElement) {
    // Remove "streaming..." indicator only
    const streamingIndicator = currentStreamingMessageElement.querySelector(".animate-pulse")
    if (streamingIndicator) {
      streamingIndicator.remove()
    }

    // Update with final text if provided
    const textElement = currentStreamingMessageElement.querySelector("#streamingMessageText")
    if (textElement && finalText) {
      textElement.textContent = finalText
    }

    // Keep the message visible! Just clear the reference
    currentStreamingMessageElement = null
  } else if (finalText) {
    // If no streaming element exists, create final message
    addVoiceEventToDisplay("Agent Response", {
      role: "assistant",
      text: finalText
    })
  }

  // Audio continues playing independently via VOICE_OUTPUT_AUDIO events
  // Don't stop or interfere with audio playback!
}

function handleAgentVoiceResponseError(content) {
  log(`Agent voice response error: ${content.error || "Unknown error"} (code: ${content.error_code || "N/A"})`, "error")
}

function handleTTSStart(content) {
  log(`TTS started: ${content.response_id || "N/A"}`, "info")
  log(`  Text: "${content.text || "N/A"}"`, "info")
  log(`  Voice: ${content.voice || "N/A"}`, "info")

  // Don't clear queue on VOICE_OUTPUT_START - we want to queue multiple TTS chunks
  // The queue will be processed sequentially
  log(`Current voice TTS queue size: ${ttsAudioQueue.length}`, "info")
}

function handleTTSAudioChunk(content) {
  try {
    if (!content.audio_data) {
      log("TTS audio chunk has no audio data, skipping", "error")
      return
    }

    // Queue the base64 audio data directly (not blob URLs)
    ttsAudioQueue.push(content.audio_data)

    log(
      `TTS audio chunk received: ${content.chunk_index || 0} (final: ${content.is_final || false}) - Queue size: ${ttsAudioQueue.length}`,
      "info"
    )

    // Start playing if not already playing
    if (!isPlayingTTS) {
      log("Starting voice TTS playback", "info")
      playNextTTSChunk()
    } else {
      log(`Voice TTS already playing, queued (${ttsAudioQueue.length} in queue)`, "info")
    }
  } catch (error) {
    log(`Failed to process TTS audio chunk: ${error.message}`, "error")
  }
}

function handleTTSEnd(content) {
  log(`TTS ended: ${content.response_id || "N/A"} (total chunks: ${content.total_chunks || 0})`, "success")
}

function handleTTSError(content) {
  log(`TTS error: ${content.error || "Unknown error"} (code: ${content.error_code || "N/A"})`, "error")
}

function handleVoiceMessageCreated(content) {
  voiceMessages++
  document.getElementById("voiceMessages").textContent = voiceMessages

  log(`Voice message created: ${content.message_id || "N/A"}`, "success")
  log(`  Role: ${content.role || "N/A"}`, "info")
  log(`  Content: "${content.content || "N/A"}"`, "info")
  log(`  Thread ID: ${content.thread_id || "N/A"}`, "info")

  // Skip assistant messages - they're already displayed via VOICE_AGENT_RESPONSE_STREAM
  // Only show user messages here
  if (content.role === "user") {
    addVoiceEventToDisplay("Message Created", {
      role: content.role || "unknown",
      text: content.content || ""
    })
  }
}

function handleVoiceError(content) {
  log(
    `Voice error: ${content.error || "Unknown error"} (code: ${content.error_code || "N/A"}, type: ${content.error_type || "N/A"})`,
    "error"
  )
  alert(`Voice Error: ${content.error || "Unknown error"}`)
}

function handleVoiceTranscription(content, isPartial) {
  const text = content.text || ""
  const turnId = content.turn_id || "N/A"
  const speaker = content.speaker || "user"
  const language = content.language || "en"
  const confidence = content.confidence ? Math.round(content.confidence * 100) : 0

  if (isPartial) {
    log(`🎤 Partial transcription: "${text}"`, "info")
    log(`  Turn ID: ${turnId}, Speaker: ${speaker}, Language: ${language}`, "info")
  } else {
    log(`✓ Final transcription: "${text}"`, "success")
    log(`  Turn ID: ${turnId}, Speaker: ${speaker}, Language: ${language}, Confidence: ${confidence}%`, "info")

    // Don't display here - it will be shown via VOICE_MESSAGE_CREATED event
    // This avoids duplication
  }
}

// Agent Recording event handlers
let agentRecordingSessionId = null

function handleAgentRecordingStart(content) {
  agentRecordingSessionId = content.session_id

  log(`Agent recording started: ${content.session_id}`, "success")
  log(`  Duration: ${content.duration_seconds || 0} seconds`, "info")
  log(`  Language: ${content.language || "auto-detect"}`, "info")
  log(`  Enable Analysis: ${content.enable_analysis || false}`, "info")
  log(`  Thread ID: ${content.thread_id || "N/A"}`, "info")

  if (content.instruction_message) {
    log(`  Instructions: "${content.instruction_message}"`, "info")
  }

  // Display in UI
  addVoiceEventToDisplay("Agent Recording Started", {
    role: "system",
    text: content.instruction_message || "Recording audio..."
  })
}

function handleAgentRecordingComplete(content) {
  log(`Agent recording completed: ${content.session_id || "N/A"}`, "success")

  if (content.audio_data) {
    log(`  Audio data received (Base64 length: ${content.audio_data.length})`, "info")
  }

  addVoiceEventToDisplay("Agent Recording Complete", {
    role: "system",
    text: "Recording completed successfully"
  })
}

function handleAgentRecordingTranscription(content) {
  log(`Agent recording transcription: ${content.session_id || "N/A"}`, "success")
  log(`  Text: "${content.text || "N/A"}"`, "info")
  log(`  Language: ${content.language || "N/A"}`, "info")
  log(`  Confidence: ${Math.round((content.confidence || 0) * 100)}%`, "info")

  // Display transcription
  addVoiceEventToDisplay("Agent Recording Transcription", {
    role: "user",
    text: content.text || ""
  })
}

function handleAgentRecordingError(content) {
  const errorMsg = content.error || "Unknown error"
  const errorCode = content.error_code || "N/A"

  log(`Agent recording error: ${errorMsg} (code: ${errorCode})`, "error")

  addVoiceEventToDisplay("Agent Recording Error", {
    role: "system",
    text: `Error: ${errorMsg}`
  })
}

function updateVoiceState(state, message) {
  const stateElement = document.getElementById("voiceState")
  const stateIcons = {
    idle: "⚪",
    listening: "🟢",
    thinking: "🟡",
    speaking: "🔵",
    error: "🔴",
    ended: "⚫"
  }
  const stateClasses = {
    idle: "p-4 rounded-lg mb-4 font-medium bg-red-100 text-red-800 border-2 border-red-500",
    listening: "p-4 rounded-lg mb-4 font-medium bg-green-100 text-green-800 border-2 border-green-500",
    thinking: "p-4 rounded-lg mb-4 font-medium bg-yellow-100 text-yellow-800 border-2 border-yellow-500",
    speaking: "p-4 rounded-lg mb-4 font-medium bg-blue-100 text-blue-800 border-2 border-blue-500",
    error: "p-4 rounded-lg mb-4 font-medium bg-red-100 text-red-800 border-2 border-red-500",
    ended: "p-4 rounded-lg mb-4 font-medium bg-gray-100 text-gray-800 border-2 border-gray-500"
  }

  stateElement.className = stateClasses[state] || stateClasses.idle
  stateElement.textContent = `${stateIcons[state] || "⚫"} ${message || state}`
}

function addVoiceEventToDisplay(type, data) {
  const voiceEventsDiv = document.getElementById("voiceEvents")

  if (!voiceEventsDiv) {
    log("Voice events display element not found", "error")
    return
  }

  // Remove ONLY the placeholder paragraph if it exists (don't clear all content!)
  const placeholder = voiceEventsDiv.querySelector("p.text-center.text-gray-400")
  if (placeholder) {
    placeholder.remove()
  }

  // Determine role/speaker for display
  const role = data.role || data.speaker || "unknown"
  const roleColor = role === "user" ? "green-600" : role === "assistant" ? "blue-600" : "gray-600"
  const roleBorder = role === "user" ? "border-green-600" : role === "assistant" ? "border-blue-600" : "border-gray-600"
  const roleIcon = role === "user" ? "👤" : role === "assistant" ? "🤖" : "💬"

  const item = document.createElement("div")
  item.className = `bg-white p-4 mb-3 rounded-lg border-l-4 ${roleBorder} shadow-sm hover:shadow-md transition-shadow`

  let contentHtml = `
        <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">${roleIcon}</span>
            <strong class="text-${roleColor} text-sm font-semibold uppercase">${role}</strong>
        </div>
    `

  if (data.text || data.content) {
    const text = data.text || data.content || ""
    contentHtml += `<p class="text-gray-800 text-base leading-relaxed">${text}</p>`
  }

  item.innerHTML = contentHtml
  voiceEventsDiv.insertBefore(item, voiceEventsDiv.firstChild)
}

async function playNextTTSChunk() {
  // Check if queue is empty
  if (ttsAudioQueue.length === 0) {
    isPlayingTTS = false
    log("Voice TTS queue empty, playback complete", "info")
    return
  }

  // Mark as playing before processing
  isPlayingTTS = true
  const base64Audio = ttsAudioQueue.shift()

  log(`Playing voice TTS chunk - ${ttsAudioQueue.length} remaining in queue`, "info")

  try {
    // Validate audio data
    if (!base64Audio || base64Audio.length === 0) {
      log("Empty voice TTS audio data, skipping to next", "error")
      isPlayingTTS = false
      playNextTTSChunk()
      return
    }

    // Decode Base64 to binary
    const binaryString = window.atob(base64Audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    if (bytes.length < 100) {
      log(`Voice TTS chunk too small (${bytes.length} bytes), skipping`, "error")
      isPlayingTTS = false
      playNextTTSChunk()
      return
    }

    // Initialize AudioContext for TTS playback (use default sample rate for proper playback)
    // Don't use voiceAudioContext (16kHz) as TTS audio is typically 24kHz
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioContext = new AudioContextClass()
      log(`TTS AudioContext created (${audioContext.sampleRate}Hz)`, "info")
    }

    const playbackContext = audioContext

    // Resume AudioContext if suspended
    if (playbackContext && playbackContext.state === "suspended") {
      await playbackContext.resume()
    }

    // Check if it's a WAV file (starts with "RIFF")
    const isWav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46

    if (isWav && playbackContext) {
      // Use Web Audio API to decode WAV file
      const audioBuffer = await playbackContext.decodeAudioData(bytes.buffer)

      if (audioBuffer.duration < 0.01) {
        log(`Voice TTS WAV too short (${audioBuffer.duration}s), skipping`, "error")
        isPlayingTTS = false
        playNextTTSChunk()
        return
      }

      const source = playbackContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(playbackContext.destination)

      // Track this source for interruption
      activeVoiceAudioSources.push(source)

      // IMPORTANT: Set up onended BEFORE starting
      source.onended = () => {
        // Remove from active sources
        const index = activeVoiceAudioSources.indexOf(source)
        if (index > -1) {
          activeVoiceAudioSources.splice(index, 1)
        }

        log(`Voice TTS WAV chunk finished (${audioBuffer.duration.toFixed(2)}s)`, "info")
        // Use setTimeout to ensure we're out of the audio callback before recursing
        setTimeout(() => {
          isPlayingTTS = false
          playNextTTSChunk()
        }, 10)
      }

      source.start(0)
      log(`▶️ Playing voice TTS chunk (WAV, ${audioBuffer.duration.toFixed(2)}s, ${bytes.length} bytes)`, "success")
    } else if (playbackContext) {
      // Fallback: treat as raw PCM (16-bit @ 24kHz for TTS)
      const int16Array = new Int16Array(bytes.buffer)
      const float32Array = new Float32Array(int16Array.length)
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0
      }

      // Use 24000 Hz for TTS audio (Azure TTS default)
      const audioBuffer = playbackContext.createBuffer(1, float32Array.length, 24000)
      audioBuffer.getChannelData(0).set(float32Array)

      if (audioBuffer.duration < 0.01) {
        log(`Voice TTS PCM too short (${audioBuffer.duration}s), skipping`, "error")
        isPlayingTTS = false
        playNextTTSChunk()
        return
      }

      const source = playbackContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(playbackContext.destination)

      // Track this source for interruption
      activeVoiceAudioSources.push(source)

      // IMPORTANT: Set up onended BEFORE starting
      source.onended = () => {
        // Remove from active sources
        const index = activeVoiceAudioSources.indexOf(source)
        if (index > -1) {
          activeVoiceAudioSources.splice(index, 1)
        }

        log(`Voice TTS PCM chunk finished (${audioBuffer.duration.toFixed(2)}s)`, "info")
        // Use setTimeout to ensure we're out of the audio callback before recursing
        setTimeout(() => {
          isPlayingTTS = false
          playNextTTSChunk()
        }, 10)
      }

      source.start(0)
      log(`▶️ Playing voice TTS chunk (PCM 24kHz, ${audioBuffer.duration.toFixed(2)}s, ${bytes.length} bytes)`, "success")
    } else {
      log("No audio context available for voice TTS playback", "error")
      isPlayingTTS = false
      playNextTTSChunk()
    }
  } catch (error) {
    log(`Failed to play voice TTS chunk: ${error.message}`, "error")
    console.error("Voice TTS Error Details:", error)
    console.error("Audio data length:", base64Audio?.length)
    // Reset flag and try next chunk with a small delay
    setTimeout(() => {
      isPlayingTTS = false
      playNextTTSChunk()
    }, 50)
  }
}

// Translation control
function updateSettings() {
  const languageA = document.getElementById("languageA").value
  const languageB = document.getElementById("languageB").value
  const context = document.getElementById("context").value.trim()
  const enableTts = document.getElementById("enableTts").checked

  // Don't generate session ID - server will create it
  // Only send settings if we already have a session_id from server
  if (!translationSessionId) {
    log("No session ID available. Requesting server to create a new translation session...", "info")
    // Request server to start a new translation session
    // Server will create the session and send TRANSLATION_SESSION_START with the session_id
    const settings = {
      language_a: languageA,
      language_b: languageB,
      enable_tts: enableTts
    }

    if (context) {
      settings.context = context
    }

    log(`Requesting new translation session with settings (no session_id - server will generate)`, "info")
    // Send TRANSLATION_SESSION_START request to server (server will create session and respond with TRANSLATION_SESSION_START)
    sendEvent("TRANSLATION_SESSION_START", settings)
    return
  }

  // If we have a session_id, update settings for that session
  const settings = {
    session_id: translationSessionId,
    language_a: languageA,
    language_b: languageB,
    enable_tts: enableTts
  }

  if (context) {
    settings.context = context
  }

  log(`Sending TRANSLATION_SETTINGS_UPDATE with session_id: ${translationSessionId}`, "info")
  sendEvent("TRANSLATION_SETTINGS_UPDATE", settings)
}

async function startTranslation() {
  // Ensure AudioContext is ready (user interaction allows autoplay)
  if (audioContext && audioContext.state === "suspended") {
    try {
      await audioContext.resume()
      log("AudioContext resumed for translation session", "success")
    } catch (error) {
      log(`Warning: Could not resume AudioContext: ${error.message}`, "error")
    }
  }

  // Check if we already have a session ID from server
  if (!translationSessionId) {
    // Request server to create a new translation session
    // Server will send TRANSLATION_SESSION_START with the session_id
    pendingSessionStart = true
    updateSettings()

    log("Waiting for server to create translation session (TRANSLATION_SESSION_START event)...", "info")
    // Don't start audio capture yet - wait for TRANSLATION_SESSION_START from server
    // The handleTranslationStart function will start audio capture
    return
  }

  // If we already have a session_id, we can start audio capture immediately
  // Request microphone access
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    log("Microphone access granted", "success")

    // Initialize audio processing
    await initializeAudioStreaming()

    // Start sending audio
    isTranslating = true
    startBtn.disabled = true
    stopBtn.disabled = false
    sessionDuration = 0
    if (sessionInterval) {
      clearInterval(sessionInterval)
    }
    sessionInterval = setInterval(() => {
      sessionDuration++
      updateStats()
    }, 1000)

    log("Translation session started - audio streaming active", "success")
  } catch (error) {
    log(`Failed to start translation: ${error.message}`, "error")
    alert(`Failed to access microphone: ${error.message}`)
    pendingSessionStart = false
  }
}

function stopTranslation() {
  if (!isTranslating) {
    return
  }

  // Send any remaining audio
  if (pcmBuffer && pcmBuffer.length > 0) {
    sendAudioChunk()
  }

  // Stop timer first
  if (sessionInterval) {
    clearInterval(sessionInterval)
    sessionInterval = null
  }

  // Stop audio processing BEFORE sending end event
  isTranslating = false

  // Cleanup audio resources
  if (audioProcessor) {
    audioProcessor.disconnect()
    audioProcessor = null
  }

  if (mediaStreamSource) {
    mediaStreamSource.disconnect()
    mediaStreamSource = null
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop())
    audioStream = null
  }

  // Clear buffers
  pcmBuffer = new Float32Array(0)

  // Stop all playing audio immediately
  stopAllAudio()

  // Clear TTS queue to prevent stale audio from playing
  translationTTSQueue = []
  isPlayingTranslationTTS = false
  log("Translation TTS queue cleared and audio stopped", "info")

  // Send end event to backend (only if we have a session_id)
  if (translationSessionId) {
    sendEvent("TRANSLATION_SESSION_END", { session_id: translationSessionId })
    translationSessionId = null // Clear session ID after ending
  }

  // Update UI
  startBtn.disabled = false
  stopBtn.disabled = true

  log("Translation session stopped", "info")
}

// Voice Conversation functions
// Voice audio helper functions
async function requestVoiceAudioAccess() {
  if (voiceMediaStream) {
    log("Voice microphone already active", "info")
    return
  }

  try {
    log("Requesting voice microphone access...", "info")
    voiceMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })

    // Set up audio context for voice (16kHz for voice)
    if (!voiceAudioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      voiceAudioContext = new AudioCtx({ sampleRate: 16000 })
      log(`Voice audio context created (${voiceAudioContext.sampleRate}Hz)`, "success")
    }

    if (voiceAudioContext.state === "suspended") {
      await voiceAudioContext.resume()
    }

    const source = voiceAudioContext.createMediaStreamSource(voiceMediaStream)
    voiceProcessor = voiceAudioContext.createScriptProcessor(4096, 1, 1)

    voiceProcessor.onaudioprocess = (event) => {
      handleVoiceAudioProcess(event.inputBuffer.getChannelData(0))
    }

    // Create silent gain to prevent feedback
    const silentGain = voiceAudioContext.createGain()
    silentGain.gain.value = 0

    source.connect(voiceProcessor)
    voiceProcessor.connect(silentGain)
    silentGain.connect(voiceAudioContext.destination)

    voicePcmBuffer = new Float32Array(0)
    voiceLastSendTime = performance.now()

    log("Voice microphone access granted", "success")
  } catch (error) {
    console.error("Failed to access voice microphone:", error)
    log(`Failed to access voice microphone: ${error.message}`, "error")
    alert(`Failed to access microphone: ${error.message}`)
    throw error
  }
}

function handleVoiceAudioProcess(channelData) {
  if (!voiceAudioContext || !voiceSessionId) {
    return // Session not ready yet
  }

  const float32Data = new Float32Array(channelData.length)
  float32Data.set(channelData)

  // Accumulate audio buffer
  voicePcmBuffer = concatFloat32Arrays(voicePcmBuffer, float32Data)

  const now = performance.now()
  const bufferDurationMs = (voicePcmBuffer.length / voiceAudioContext.sampleRate) * 1000
  const timeSinceLastSend = now - voiceLastSendTime

  const shouldSend =
    (bufferDurationMs >= VOICE_MIN_CHUNK_DURATION && timeSinceLastSend >= VOICE_MIN_CHUNK_DURATION) ||
    timeSinceLastSend >= VOICE_MAX_CHUNK_DURATION

  if (shouldSend && voicePcmBuffer.length > 0) {
    sendVoiceAudioChunk()
    voiceLastSendTime = now
  }
}

function sendVoiceAudioChunk() {
  if (!voicePcmBuffer || voicePcmBuffer.length === 0 || !voiceSessionId) {
    return
  }

  const bufferSize = voicePcmBuffer.length
  const sampleRate = voiceAudioContext.sampleRate
  const durationMs = (bufferSize / sampleRate) * 1000

  // Convert Float32 to Int16 PCM
  const int16Array = new Int16Array(voicePcmBuffer.length)
  for (let i = 0; i < voicePcmBuffer.length; i++) {
    const sample = voicePcmBuffer[i]
    int16Array[i] = Math.max(-32768, Math.min(32767, sample * 32768))
  }

  // Convert to base64
  const base64Audio = arrayBufferToBase64(int16Array.buffer)

  // Send audio data
  const audioPayload = {
    event: "VOICE_INPUT_AUDIO",
    session_id: voiceSessionId,
    audio_data: base64Audio,
    format: "pcm",
    sample_rate: 16000
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(audioPayload))
    log(`Sent voice audio chunk: ${bufferSize} samples (${durationMs.toFixed(0)}ms)`, "info")
  }

  // Clear buffer
  voicePcmBuffer = new Float32Array(0)
}

function stopVoiceAudioCapture() {
  if (voiceProcessor) {
    voiceProcessor.disconnect()
    voiceProcessor = null
    log("Voice processor disconnected", "info")
  }

  if (voiceMediaStream) {
    voiceMediaStream.getTracks().forEach((track) => {
      track.stop()
      log(`Voice track stopped: ${track.label}`, "info")
    })
    voiceMediaStream = null
  }

  if (voiceAudioContext) {
    voiceAudioContext.close()
    voiceAudioContext = null
    log("Voice audio context closed", "info")
  }

  voicePcmBuffer = new Float32Array(0)
}

async function startVoiceConversation() {
  if (!isConnected) {
    alert("Please connect to the WebSocket server first")
    return
  }

  // Get and validate agent ID
  const agentId = document.getElementById("agentId").value.trim()
  if (!agentId) {
    alert("Please enter an Agent ID (UUID)")
    log("Agent ID is required to start voice conversation", "error")
    return
  }

  log("Starting voice conversation session...", "info")
  log(`Using Agent ID: ${agentId}`, "info")

  try {
    // Request microphone access first
    await requestVoiceAudioAccess()

    // Send voice conversation start event (matches Vue component format)
    const startPayload = {
      event: "VOICE_SESSION_START",
      agent_id: agentId,
      voice_config: {
        interaction_mode: "conversation"
      },
      preferences: {
        language: "en",
        voice_settings: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        }
      }
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(startPayload))
      log("Sent: VOICE_SESSION_START", "info")
    }

    startVoiceBtn.disabled = true
    stopVoiceBtn.disabled = false

    log("Voice conversation started. Microphone is active and streaming...", "success")
    log("Waiting for VOICE_SESSION_CREATED to begin audio streaming...", "info")
  } catch (error) {
    log(`Failed to start voice conversation: ${error.message}`, "error")
    startVoiceBtn.disabled = false
    stopVoiceBtn.disabled = true
  }
}

function stopVoiceConversation() {
  if (!voiceSessionId) {
    log("No active voice session to stop", "error")
    return
  }

  log("Stopping voice conversation session...", "info")

  // Stop all audio playback immediately (like Vue component's cleanup)
  stopAllAudio()

  // Clear all TTS queues to prevent new audio from playing
  ttsAudioQueue = []
  isPlayingTTS = false
  log("Voice TTS queue cleared", "info")

  // Send voice conversation end event
  const endPayload = {
    event: "VOICE_SESSION_END",
    session_id: voiceSessionId
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(endPayload))
    log("Sent: VOICE_SESSION_END", "info")
  }

  // Stop audio capture
  stopVoiceAudioCapture()

  // Reset state
  voiceSessionId = null
  voiceSessionState = "idle"

  startVoiceBtn.disabled = false
  stopVoiceBtn.disabled = true

  log("Voice conversation stopped. Microphone stopped. All audio cleared.", "success")
}

// Agent Chat functions (using SSE)
let currentChatAbortController = null

async function sendChatMessage() {
  const agentId = document.getElementById("agentId").value.trim()
  if (!agentId) {
    alert("Please enter an Agent ID (UUID)")
    log("Agent ID is required for chat", "error")
    return
  }

  const message = chatInput.value.trim()
  if (!message) {
    alert("Please enter a message")
    return
  }

  // Get API key for SSE request
  const apiKey = document.getElementById("authToken").value.trim()
  if (!apiKey) {
    alert("Please enter an API Key to use chat")
    log("API Key is required for SSE chat", "error")
    return
  }

  log("Sending chat message via SSE...", "info")

  // Add user message to display
  addChatMessage("user", message)

  // Clear input
  chatInput.value = ""
  sendChatBtn.disabled = true

  // Cancel any ongoing request
  if (currentChatAbortController) {
    currentChatAbortController.abort()
  }
  currentChatAbortController = new AbortController()

  try {
    // Use SSE for streaming chat (like Vue app)
    const apiBaseUrl = "https://api.nebelus.ai" // Use production API
    const endpoint = `${apiBaseUrl}/api/agents/${agentId}/chat/`

    const payload = {
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    }

    log(`Calling SSE endpoint: ${endpoint}`, "info")

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: currentChatAbortController.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    log("SSE stream started", "success")

    // Start with empty assistant message
    let assistantMessageId = "assistant-" + Date.now()
    let fullContent = ""
    let isFirstChunk = true

    // Parse SSE stream
    await parseSSEStream(response, (eventType, eventData) => {
      log(`SSE Event: ${eventType}`, "info")

      if (eventType === "message_start") {
        // Message started
        const messageId = eventData.message?.id || eventData.message?.message_id
        if (messageId) {
          assistantMessageId = "assistant-" + messageId
          log(`Message started: ${messageId}`, "success")
        }
      } else if (eventType === "content_block") {
        // Handle content blocks
        const state = eventData.state

        if (state === "start") {
          // Content block started
          log(`Content block started (index: ${eventData.index})`, "info")
        } else if (state === "delta") {
          // Delta update - append text
          const deltaText = eventData.data?.text || ""
          if (deltaText) {
            fullContent += deltaText
            log(`Delta: "${deltaText}" (total: ${fullContent.length} chars)`, "info")

            // Update or create message in UI
            if (isFirstChunk) {
              addChatMessage("assistant", fullContent, assistantMessageId)
              isFirstChunk = false
            } else {
              updateChatMessage(assistantMessageId, fullContent, true) // true = streaming
            }
          }
        } else if (state === "complete") {
          // Content block complete
          log(`Content block complete (index: ${eventData.index})`, "success")
        }
      } else if (eventType === "message_stop") {
        // Message complete
        log("Chat stream completed", "success")
        log(`Final message: ${fullContent.length} chars`, "info")

        // Show timing info if available
        if (eventData.timing) {
          log(`Timing: ${eventData.timing.total_ms}ms total, ${eventData.timing.provider_ms}ms provider`, "info")
        }

        // Remove streaming cursor
        updateChatMessage(assistantMessageId, fullContent, false) // false = done streaming
      } else if (eventType === "message_delta") {
        // Message metadata update (stop reason, etc)
        if (eventData.delta?.stop_reason) {
          log(`Stop reason: ${eventData.delta.stop_reason}`, "info")
        }
      } else if (eventType === "usage_metadata") {
        // Token usage info
        if (eventData.usage) {
          log(`Usage: ${eventData.usage.input_tokens} input, ${eventData.usage.output_tokens} output tokens`, "info")
        }
      } else if (eventType === "error") {
        log(`Chat error: ${JSON.stringify(eventData)}`, "error")
      } else {
        // Log any other events for debugging
        log(`Other event: ${JSON.stringify(eventData).substring(0, 100)}...`, "info")
      }
    })

    log("Chat response completed", "success")
  } catch (error) {
    if (error.name === "AbortError") {
      log("Chat request cancelled", "info")
    } else {
      log(`Chat error: ${error.message}`, "error")
      console.error("Chat error:", error)
      alert(`Chat error: ${error.message}`)
    }
  } finally {
    sendChatBtn.disabled = false
    currentChatAbortController = null
  }
}

async function parseSSEStream(response, onData) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk

      // Process complete SSE messages (separated by double newline)
      const messages = buffer.split("\n\n")
      buffer = messages.pop() || "" // Keep incomplete message in buffer

      for (const message of messages) {
        if (!message.trim()) {
          continue
        }

        const lines = message.split("\n")
        let eventType = ""
        let eventData = null

        // Parse event and data lines
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

        // Call handler with event type and data
        if (eventType && eventData) {
          onData(eventType, eventData)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function addChatMessage(role, content, messageId = null) {
  if (!chatMessages) {
    return
  }

  // Remove placeholder if present
  const placeholder = chatMessages.querySelector("p")
  if (placeholder && placeholder.textContent.includes("No messages yet")) {
    chatMessages.innerHTML = ""
  }

  const messageDiv = document.createElement("div")
  if (messageId) {
    messageDiv.id = messageId
  }
  messageDiv.className = role === "user" ? "mb-3 flex justify-end" : "mb-3 flex justify-start"

  const bubble = document.createElement("div")
  bubble.className =
    role === "user"
      ? "bg-indigo-600 text-white px-4 py-2 rounded-lg max-w-[80%] break-words"
      : "bg-gray-200 text-gray-800 px-4 py-2 rounded-lg max-w-[80%] break-words whitespace-pre-wrap"

  bubble.textContent = content
  messageDiv.appendChild(bubble)
  chatMessages.appendChild(messageDiv)

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight

  return messageDiv
}

function updateChatMessage(messageId, content, isStreaming = false) {
  if (!chatMessages) {
    return
  }

  // Check if message exists
  let messageDiv = document.getElementById(messageId)

  if (!messageDiv) {
    // Create new assistant message if it doesn't exist
    messageDiv = addChatMessage("assistant", content, messageId)
    return
  }

  // Update existing message content
  const bubble = messageDiv.querySelector("div")
  if (bubble) {
    bubble.textContent = content

    // Add streaming indicator (cursor)
    if (isStreaming) {
      // Add a blinking cursor to show streaming is happening
      if (!bubble.querySelector(".streaming-cursor")) {
        const cursor = document.createElement("span")
        cursor.className = "streaming-cursor inline-block w-1.5 h-4 bg-gray-600 ml-0.5 animate-pulse"
        bubble.appendChild(cursor)
      }
    } else {
      // Remove cursor when done
      const cursor = bubble.querySelector(".streaming-cursor")
      if (cursor) {
        cursor.remove()
      }
    }
  }

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function clearChat() {
  if (chatMessages) {
    chatMessages.innerHTML = '<p class="text-center text-gray-400 p-5">No messages yet. Enter your agent ID and start chatting.</p>'
  }
  log("Chat cleared", "info")
}

// Handle Enter key in chat input
if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  })
}

// Audio processing
async function initializeAudioStreaming() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  audioContext = new AudioContextClass()

  if (audioContext.state === "suspended") {
    await audioContext.resume()
  }

  mediaStreamSource = audioContext.createMediaStreamSource(audioStream)
  audioProcessor = audioContext.createScriptProcessor(4096, 1, 1)

  audioProcessor.onaudioprocess = (event) => {
    if (!isTranslating) {
      return
    }
    handleAudioProcess(event.inputBuffer.getChannelData(0))
  }

  // Connect with silent output
  const silentGain = audioContext.createGain()
  silentGain.gain.value = 0
  mediaStreamSource.connect(audioProcessor)
  audioProcessor.connect(silentGain)
  silentGain.connect(audioContext.destination)

  pcmBuffer = new Float32Array(0)
  lastAudioSendTime = performance.now()
}

function handleAudioProcess(channelData) {
  if (!audioContext || !isTranslating) {
    return
  }

  const float32Data = new Float32Array(channelData.length)
  float32Data.set(channelData)
  pcmBuffer = concatFloat32Arrays(pcmBuffer, float32Data)

  const now = performance.now()
  const bufferDurationMs = (pcmBuffer.length / audioContext.sampleRate) * 1000
  const timeSinceLastSend = now - lastAudioSendTime

  if (bufferDurationMs >= minChunkDuration && timeSinceLastSend >= minChunkDuration) {
    sendAudioChunk()
    lastAudioSendTime = now
  }
}

function concatFloat32Arrays(current, incoming) {
  if (!current || current.length === 0) {
    return incoming
  }
  const merged = new Float32Array(current.length + incoming.length)
  merged.set(current)
  merged.set(incoming, current.length)
  return merged
}

function sendAudioChunk() {
  if (!pcmBuffer || pcmBuffer.length === 0) {
    return
  }

  // Check if still translating
  if (!isTranslating) {
    pcmBuffer = new Float32Array(0)
    return
  }

  // Check for session ID BEFORE processing audio (server must create session first)
  if (!translationSessionId) {
    // Don't log warning every time, just clear buffer
    pcmBuffer = new Float32Array(0)
    return
  }

  if (!audioContext) {
    pcmBuffer = new Float32Array(0)
    return
  }

  const actualSampleRate = audioContext.sampleRate
  const targetSampleRate = 16000
  const resampledData = resampleAudio(pcmBuffer, actualSampleRate, targetSampleRate)

  // Convert to Int16
  const int16Array = new Int16Array(resampledData.length)
  for (let i = 0; i < resampledData.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32768))
  }

  // Convert to Base64
  const base64Audio = arrayBufferToBase64(int16Array.buffer)

  // Send via WebSocket with server-provided session_id
  if (
    sendEvent("TRANSLATION_AUDIO_STREAM", {
      session_id: translationSessionId,
      audio_data: base64Audio
    })
  ) {
    audioChunksSent++
    updateStats()
  }

  pcmBuffer = new Float32Array(0)
}

function resampleAudio(audioData, fromSampleRate, toSampleRate) {
  if (fromSampleRate === toSampleRate) {
    return audioData
  }

  const ratio = fromSampleRate / toSampleRate
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1)
    const t = srcIndex - srcIndexFloor
    result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t
  }

  return result
}

function arrayBufferToBase64(buffer) {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function cleanupAudio() {
  if (audioProcessor) {
    audioProcessor.disconnect()
    audioProcessor = null
  }

  if (mediaStreamSource) {
    mediaStreamSource.disconnect()
    mediaStreamSource = null
  }

  if (audioStream) {
    audioStream.getTracks().forEach((track) => track.stop())
    audioStream = null
  }

  if (audioContext) {
    audioContext.close().catch(() => {})
    audioContext = null
  }

  if (ttsAudioContext) {
    ttsAudioContext.close().catch(() => {})
    ttsAudioContext = null
  }

  pcmBuffer = new Float32Array(0)

  // Clear TTS queues
  translationTTSQueue = []
  isPlayingTranslationTTS = false
}

// TTS playback - Queue-based to prevent overlapping/cutting audio
// Uses SEPARATE audio context to avoid conflicts with recording context
function playTTSAudio(base64Audio) {
  if (!base64Audio) {
    return
  }

  // Add to queue
  translationTTSQueue.push(base64Audio)

  if (translationTTSQueue.length > 1) {
    log(`Translation TTS queued (${translationTTSQueue.length} in queue)`, "info")
  }

  // Start playing if not already playing
  if (!isPlayingTranslationTTS) {
    playNextTranslationTTS()
  }
}

async function playNextTranslationTTS() {
  if (translationTTSQueue.length === 0) {
    isPlayingTranslationTTS = false
    return
  }

  isPlayingTranslationTTS = true
  const base64Audio = translationTTSQueue.shift()

  try {
    // Decode Base64 to binary
    const binaryString = window.atob(base64Audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Create DEDICATED audio context for TTS playback at 16kHz
    // This context is SEPARATE from the recording context to avoid sample rate conflicts
    // Backend always outputs 16kHz for translation (both Azure and Google)
    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    // Create or reuse TTS audio context with fixed 16kHz sample rate
    if (!ttsAudioContext && AudioContextClass) {
      // Always use 16kHz for TTS playback (matches backend translation TTS output)
      ttsAudioContext = new AudioContextClass({ sampleRate: 16000 })
      log("TTS Audio context created with sample rate: 16000 Hz (fixed for translation)", "info")
    }

    // Ensure TTS audio context is running
    if (ttsAudioContext.state === "suspended") {
      await ttsAudioContext.resume()
    }

    // Convert raw PCM Int16 to Float32 for Web Audio API
    const int16Array = new Int16Array(bytes.buffer)
    const float32Array = new Float32Array(int16Array.length)

    // Convert Int16 PCM to Float32 (range -1.0 to 1.0)
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0
    }

    // Create audio buffer at 16kHz (TTS output sample rate from backend)
    const ttsSampleRate = 16000
    const audioBuffer = ttsAudioContext.createBuffer(1, float32Array.length, ttsSampleRate)

    // Copy audio data to buffer
    audioBuffer.getChannelData(0).set(float32Array)

    // Create audio source and play
    const source = ttsAudioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ttsAudioContext.destination)

    // Track this source for interruption
    activeTranslationAudioSources.push(source)

    // IMPORTANT: Wait for this chunk to finish before playing next
    source.onended = () => {
      // Remove from active sources
      const index = activeTranslationAudioSources.indexOf(source)
      if (index > -1) {
        activeTranslationAudioSources.splice(index, 1)
      }

      isPlayingTranslationTTS = false
      // Play next chunk in queue
      playNextTranslationTTS()
    }

    source.start(0)

    log(
      `Playing translation TTS (16kHz PCM, ${audioBuffer.duration.toFixed(2)}s) - ${translationTTSQueue.length} remaining in queue`,
      "success"
    )
  } catch (error) {
    log(`Failed to play translation TTS: ${error.message}`, "error")
    console.error("Translation TTS Error:", error)
    // Reset flag and try next chunk
    isPlayingTranslationTTS = false
    playNextTranslationTTS()
  }
}

// TTS Toggle Function
function toggleTTS() {
  const checkbox = document.getElementById("enableTts")
  const toggle = document.getElementById("ttsToggle")
  const thumb = document.getElementById("ttsToggleThumb")

  // Toggle state
  checkbox.checked = !checkbox.checked

  // Update UI
  if (checkbox.checked) {
    toggle.classList.remove("bg-gray-200")
    toggle.classList.add("bg-blue-600")
    toggle.setAttribute("aria-checked", "true")
    thumb.classList.remove("translate-x-0")
    thumb.classList.add("translate-x-5")
    log("TTS enabled", "success")
  } else {
    toggle.classList.remove("bg-blue-600")
    toggle.classList.add("bg-gray-200")
    toggle.setAttribute("aria-checked", "false")
    thumb.classList.remove("translate-x-5")
    thumb.classList.add("translate-x-0")
    log("TTS disabled", "info")
  }
}

// Initialize
updateStats()
log("WebSocket Translation Client initialized", "success")
