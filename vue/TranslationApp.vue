<template>
  <div class="max-w-7xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
    <!-- Header -->
    <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 text-center md:text-left">
      <div class="flex items-center justify-center md:justify-start gap-4 mb-2">
        <img src="https://storage.googleapis.com/nebelus-public/logo.png" alt="Nebelus Logo" class="h-12 w-auto">
        <h1 class="text-3xl font-bold">
          Nebelus Translation
        </h1>
      </div>
      <p class="opacity-90">
        Real-time bidirectional voice translation
      </p>
    </div>

    <div class="p-8">
      <!-- Connection Section -->
      <div class="mb-8">
        <h2 class="text-gray-800 mb-4 text-xl border-b-2 border-indigo-600 pb-3 font-semibold">
          Connection
        </h2>

        <div class="mb-5">
          <label class="block mb-2 text-gray-700 font-medium" for="apiUrl">API Base URL</label>
          <input
            id="apiUrl"
            v-model="apiUrl"
            type="text"
            class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 transition-colors"
            placeholder="wss://api.nebelus.ai or ws://127.0.0.1:8000">
        </div>

        <div class="mb-5">
          <label class="block mb-2 text-gray-700 font-medium" for="apiKey"> API Key <span class="text-red-600">*</span> </label>
          <input
            id="apiKey"
            v-model="apiKey"
            type="password"
            class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 transition-colors"
            placeholder="Enter API key (sk-ns-org-...)"
            required>
          <small class="block mt-1.5 text-gray-500 text-xs"> Required. API key (sk-ns-org-...) in URL query parameter. </small>
        </div>

        <div
          :class="{
            'p-4 rounded-lg mb-5 font-medium': true,
            'bg-green-100 text-green-800 border-2 border-green-500': connectionStatus === 'connected',
            'bg-red-100 text-red-800 border-2 border-red-500': connectionStatus === 'disconnected',
            'bg-yellow-100 text-yellow-800 border-2 border-yellow-500': connectionStatus === 'connecting'
          }">
          {{ connectionStatusText }}
        </div>

        <div class="flex gap-2.5 flex-wrap">
          <button
            :disabled="isConnected"
            class="px-6 py-3 rounded-lg text-sm font-semibold transition-all"
            :class="
              isConnected
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:-translate-y-0.5 hover:shadow-lg'
            "
            @click="connect">
            Connect
          </button>
          <button
            :disabled="!isConnected"
            class="px-6 py-3 rounded-lg text-sm font-semibold transition-all bg-gray-600 text-white"
            :class="!isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'"
            @click="disconnect">
            Disconnect
          </button>
        </div>
      </div>

      <!-- Translation Settings -->
      <div class="mb-8 bg-indigo-50 p-6 rounded-lg border-2 border-indigo-100">
        <h2 class="text-gray-800 mb-4 text-xl border-b-2 border-indigo-600 pb-3 font-semibold">
          Translation Settings
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label class="block mb-2 text-gray-700 font-medium" for="languageA">Source Language</label>
            <select
              id="languageA"
              v-model="settings.languageA"
              class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 transition-colors">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ar">Arabic</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>

          <div>
            <label class="block mb-2 text-gray-700 font-medium" for="languageB">Target Language</label>
            <select
              id="languageB"
              v-model="settings.languageB"
              class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 transition-colors">
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ar">Arabic</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>
        </div>

        <div class="mb-5">
          <label class="block mb-2 text-gray-700 font-medium" for="context">Context (Optional)</label>
          <textarea
            id="context"
            v-model="settings.context"
            rows="2"
            class="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-600 transition-colors"
            placeholder="e.g., Medical terminology, business meeting..." />
        </div>

        <!-- TTS Toggle -->
        <div class="mb-5">
          <div class="inline-flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <div class="flex-1">
              <label class="block font-medium text-sm text-gray-900 cursor-pointer">Enable Text-to-Speech</label>
              <p class="text-xs text-gray-500">
                Play translated audio
              </p>
            </div>
            <button
              type="button"
              :class="{
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2': true,
                'bg-blue-600': settings.enableTts,
                'bg-gray-200': !settings.enableTts
              }"
              role="switch"
              :aria-checked="settings.enableTts"
              @click="settings.enableTts = !settings.enableTts">
              <span class="sr-only">Enable TTS</span>
              <span
                :class="{
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out': true,
                  'translate-x-5': settings.enableTts,
                  'translate-x-0': !settings.enableTts
                }" />
            </button>
          </div>
        </div>

        <div class="flex gap-2.5 flex-wrap">
          <button
            :disabled="!translationSessionId"
            class="px-6 py-3 rounded-lg text-sm font-semibold transition-all bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
            :class="!translationSessionId ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-lg'"
            @click="updateSettings">
            Update Settings
          </button>
        </div>
      </div>

      <!-- Session Control -->
      <div class="mb-8">
        <h2 class="text-gray-800 mb-4 text-xl border-b-2 border-indigo-600 pb-3 font-semibold">
          Session Control
        </h2>

        <div class="flex gap-2.5 flex-wrap mb-5">
          <button
            :disabled="!isConnected || isTranslating"
            class="px-6 py-3 rounded-lg text-sm font-semibold transition-all bg-green-500 text-white"
            :class="!isConnected || isTranslating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'"
            @click="startTranslation">
            Start Translation
          </button>
          <button
            :disabled="!isTranslating"
            class="px-6 py-3 rounded-lg text-sm font-semibold transition-all bg-red-500 text-white"
            :class="!isTranslating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'"
            @click="stopTranslation">
            End Translation
          </button>
        </div>

        <div class="flex gap-5 flex-wrap">
          <div class="flex-1 min-w-[150px] p-4 bg-gray-50 rounded-lg text-center">
            <div class="text-2xl font-bold text-indigo-600">
              {{ formatDuration(sessionDuration) }}
            </div>
            <div class="text-xs text-gray-600 mt-1">
              Session Duration
            </div>
          </div>
          <div class="flex-1 min-w-[150px] p-4 bg-gray-50 rounded-lg text-center">
            <div class="text-2xl font-bold text-indigo-600">
              {{ translationCount }}
            </div>
            <div class="text-xs text-gray-600 mt-1">
              Translations
            </div>
          </div>
          <div class="flex-1 min-w-[150px] p-4 bg-gray-50 rounded-lg text-center">
            <div class="text-2xl font-bold text-indigo-600">
              {{ audioChunksSent }}
            </div>
            <div class="text-xs text-gray-600 mt-1">
              Audio Chunks Sent
            </div>
          </div>
        </div>
      </div>

      <!-- Translations Display -->
      <div class="mb-8">
        <h2 class="text-gray-800 mb-4 text-xl border-b-2 border-indigo-600 pb-3 font-semibold">
          Translation Results
        </h2>
        <div class="max-h-96 overflow-y-auto border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
          <p v-if="translations.length === 0" class="text-center text-gray-400 p-5">
            No translations yet. Start a session to see results here.
          </p>
          <div
            v-for="(translation, index) in translations"
            :key="index"
            class="bg-white p-4 mb-4 rounded-lg border-l-4 border-indigo-600 shadow">
            <div class="flex justify-between mb-2.5 text-xs text-gray-600">
              <span>{{ translation.speaker || "Speaker" }}</span>
              <span class="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                {{ Math.round((translation.confidence || 0) * 100) }}% confidence
              </span>
            </div>
            <div class="mb-2">
              <strong class="text-indigo-600 block mb-1 text-xs uppercase"> Original ({{ translation.original_language }}) </strong>
              <p class="text-gray-800 text-sm leading-relaxed">
                {{ translation.original_text }}
              </p>
            </div>
            <div class="mb-2">
              <strong class="text-indigo-600 block mb-1 text-xs uppercase"> Translation ({{ translation.target_language }}) </strong>
              <p class="text-gray-800 text-sm leading-relaxed">
                {{ translation.translated_text }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Event Log -->
      <div class="mb-8 mt-8 pt-8 border-t-2 border-gray-200">
        <h2 class="text-gray-800 mb-4 text-xl border-b-2 border-gray-400 pb-3 font-semibold">
          📋 Debug Event Log
        </h2>
        <div
          ref="eventLogRef"
          class="bg-gray-800 text-green-500 p-4 rounded-lg font-mono text-xs max-h-80 overflow-y-auto whitespace-pre-wrap break-words">
          <div v-for="(logEntry, index) in eventLog" :key="index" :class="logEntry.className">
            {{ logEntry.message }}
          </div>
        </div>
        <div class="flex gap-2.5 flex-wrap mt-2.5">
          <button
            class="px-6 py-3 rounded-lg text-sm font-semibold transition-all bg-gray-600 text-white hover:bg-gray-700"
            @click="clearLog">
            Clear Log
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue"

// Props
const props = defineProps({
  defaultApiUrl: {
    type: String,
    default: "wss://api.nebelus.ai"
  }
})

// Connection state
const apiUrl = ref(props.defaultApiUrl)
const apiKey = ref("")
const socket = ref(null)
const isConnected = ref(false)
const connectionStatus = ref("disconnected")
const pingInterval = ref(null)

// Translation state
const translationSessionId = ref(null)
const isTranslating = ref(false)
const sessionDuration = ref(0)
const sessionInterval = ref(null)
const translationCount = ref(0)
const audioChunksSent = ref(0)
const translations = ref([])

// Settings
const settings = ref({
  languageA: "en",
  languageB: "es",
  context: "",
  enableTts: true
})

// Audio processing
const audioContext = ref(null)
const audioStream = ref(null)
const mediaStreamSource = ref(null)
const audioProcessor = ref(null)
const pcmBuffer = ref(new Float32Array(0))
const lastAudioSendTime = ref(0)
const minChunkDuration = 500 // 500ms

// TTS playback
const ttsAudioContext = ref(null)
const ttsAudioQueue = ref([])
const isPlayingTTS = ref(false)
const activeTTSAudioSources = ref([])

// Event log
const eventLog = ref([])
const eventLogRef = ref(null)

// Computed
const connectionStatusText = computed(() => {
  const icons = {
    connected: "🟢",
    disconnected: "⚫",
    connecting: "🟡"
  }
  const messages = {
    connected: "Connected",
    disconnected: "Disconnected",
    connecting: "Connecting..."
  }
  return `${icons[connectionStatus.value]} ${messages[connectionStatus.value]}`
})

// Methods
function log(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString()
  const typeClasses = {
    error: "mb-1 text-red-500",
    success: "mb-1 text-green-500",
    info: "mb-1 text-blue-500"
  }
  eventLog.value.push({
    message: `[${timestamp}] ${message}`,
    className: typeClasses[type] || typeClasses.info
  })

  nextTick(() => {
    if (eventLogRef.value) {
      eventLogRef.value.scrollTop = eventLogRef.value.scrollHeight
    }
  })

  console.log(`[${type.toUpperCase()}]`, message)
}

function clearLog() {
  eventLog.value = []
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

async function connect() {
  if (!apiKey.value) {
    alert("Please enter an API key")
    return
  }

  // Initialize AudioContext on user interaction
  if (!audioContext.value) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext.value = new AudioContextClass()
    log("AudioContext initialized", "info")
  }

  if (audioContext.value.state === "suspended") {
    try {
      await audioContext.value.resume()
      log("AudioContext resumed (ready for audio playback)", "success")
    } catch (error) {
      log(`Warning: Could not resume AudioContext: ${error.message}`, "error")
    }
  }

  const wsUrl = `${apiUrl.value}/stream/?api_key=${encodeURIComponent(apiKey.value)}`
  log(`Connecting to ${apiUrl.value} with API key authentication...`, "info")
  connectionStatus.value = "connecting"

  try {
    socket.value = new WebSocket(wsUrl)

    socket.value.onopen = () => {
      isConnected.value = true
      connectionStatus.value = "connected"
      log("WebSocket connection established", "success")
      startHeartbeat()
      log('Connected. Click "Start Translation" to begin.', "info")
    }

    socket.value.onerror = (error) => {
      log(`WebSocket error: ${error.message || "Unknown error"}`, "error")
      connectionStatus.value = "disconnected"
    }

    socket.value.onclose = (event) => {
      isConnected.value = false
      connectionStatus.value = "disconnected"
      log(`WebSocket closed: Code ${event.code}, Reason: ${event.reason || "None"}`, "error")
      stopHeartbeat()

      if (isTranslating.value) {
        stopTranslation()
      }
    }

    socket.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleIncomingEvent(data)
      } catch (error) {
        log(`Failed to parse message: ${error.message}`, "error")
      }
    }
  } catch (error) {
    log(`Connection error: ${error.message}`, "error")
    connectionStatus.value = "disconnected"
  }
}

function disconnect() {
  if (socket.value) {
    socket.value.close()
    socket.value = null
  }

  if (isTranslating.value) {
    stopTranslation()
  }
}

function startHeartbeat() {
  pingInterval.value = setInterval(() => {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) {
      sendEvent("PING", {})
    }
  }, 120000) // 2 minutes
}

function stopHeartbeat() {
  if (pingInterval.value) {
    clearInterval(pingInterval.value)
    pingInterval.value = null
  }
}

function sendEvent(event, data) {
  if (!socket.value || socket.value.readyState !== WebSocket.OPEN) {
    log(`Cannot send event: WebSocket not connected`, "error")
    return false
  }

  const message = { event, ...data }
  socket.value.send(JSON.stringify(message))
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
    default:
      log(`Unhandled event: ${event}`, "info")
  }
}

async function handleTranslationStart(content) {
  log(`Translation session started: ${content.session_id}`, "success")

  if (content.session_id) {
    translationSessionId.value = content.session_id
  }

  translationCount.value = 0
  audioChunksSent.value = 0

  // Send settings update
  const settingsData = {
    session_id: content.session_id,
    language_a: settings.value.languageA,
    language_b: settings.value.languageB,
    enable_tts: settings.value.enableTts
  }

  if (settings.value.context) {
    settingsData.context = settings.value.context
  }

  sendEvent("TRANSLATION_SETTINGS_UPDATE", settingsData)

  // Start audio streaming
  setTimeout(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log("getUserMedia is not available. This page must be served over HTTPS or localhost.", "error")
      return
    }

    try {
      audioStream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
      log("Microphone access granted", "success")

      await initializeAudioStreaming()

      isTranslating.value = true
      sessionDuration.value = 0
      if (sessionInterval.value) {
        clearInterval(sessionInterval.value)
      }
      sessionInterval.value = setInterval(() => {
        sessionDuration.value++
      }, 1000)

      log("Audio streaming started automatically", "success")
    } catch (error) {
      log(`Failed to start audio streaming: ${error.message}`, "error")
    }
  }, 200)
}

function handleTranslationResult(content) {
  translationCount.value++

  translations.value.unshift({
    speaker: content.speaker,
    original_text: content.original_text,
    original_language: content.original_language,
    translated_text: content.translated_text,
    target_language: content.target_language,
    confidence: content.confidence
  })

  log(`Translation received: "${content.original_text}" → "${content.translated_text}"`, "success")

  // Play TTS if available
  if (content.tts_audio && settings.value.enableTts) {
    playTTSAudio(content.tts_audio)
  }
}

function handleTranslationComplete(content) {
  log(`Translation session completed: ${content.total_translations || 0} translations`, "success")
  isTranslating.value = false
  if (sessionInterval.value) {
    clearInterval(sessionInterval.value)
    sessionInterval.value = null
  }
}

function handleTranslationError(content) {
  const errorMsg = content.error || "Unknown error"
  log(`Translation error: ${errorMsg}`, "error")
}

function updateSettings() {
  if (!translationSessionId.value) {
    log("No session ID available. Requesting server to create a new translation session...", "info")

    const settingsData = {
      language_a: settings.value.languageA,
      language_b: settings.value.languageB,
      enable_tts: settings.value.enableTts
    }

    if (settings.value.context) {
      settingsData.context = settings.value.context
    }

    sendEvent("TRANSLATION_SESSION_START", settingsData)
    return
  }

  const settingsData = {
    session_id: translationSessionId.value,
    language_a: settings.value.languageA,
    language_b: settings.value.languageB,
    enable_tts: settings.value.enableTts
  }

  if (settings.value.context) {
    settingsData.context = settings.value.context
  }

  log(`Sending TRANSLATION_SETTINGS_UPDATE with session_id: ${translationSessionId.value}`, "info")
  sendEvent("TRANSLATION_SETTINGS_UPDATE", settingsData)
}

async function startTranslation() {
  if (audioContext.value && audioContext.value.state === "suspended") {
    try {
      await audioContext.value.resume()
      log("AudioContext resumed for translation session", "success")
    } catch (error) {
      log(`Warning: Could not resume AudioContext: ${error.message}`, "error")
    }
  }

  if (!translationSessionId.value) {
    updateSettings()
    log("Waiting for server to create translation session (TRANSLATION_SESSION_START event)...", "info")
    return
  }

  try {
    audioStream.value = await navigator.mediaDevices.getUserMedia({ audio: true })
    log("Microphone access granted", "success")

    await initializeAudioStreaming()

    isTranslating.value = true
    sessionDuration.value = 0
    if (sessionInterval.value) {
      clearInterval(sessionInterval.value)
    }
    sessionInterval.value = setInterval(() => {
      sessionDuration.value++
    }, 1000)

    log("Translation session started - audio streaming active", "success")
  } catch (error) {
    log(`Failed to start translation: ${error.message}`, "error")
    alert(`Failed to access microphone: ${error.message}`)
  }
}

function stopTranslation() {
  if (!isTranslating.value) {
    return
  }

  if (pcmBuffer.value && pcmBuffer.value.length > 0) {
    sendAudioChunk()
  }

  if (sessionInterval.value) {
    clearInterval(sessionInterval.value)
    sessionInterval.value = null
  }

  isTranslating.value = false

  if (audioProcessor.value) {
    audioProcessor.value.disconnect()
    audioProcessor.value = null
  }

  if (mediaStreamSource.value) {
    mediaStreamSource.value.disconnect()
    mediaStreamSource.value = null
  }

  if (audioStream.value) {
    audioStream.value.getTracks().forEach((track) => track.stop())
    audioStream.value = null
  }

  pcmBuffer.value = new Float32Array(0)

  stopAllAudio()
  ttsAudioQueue.value = []
  isPlayingTTS.value = false

  if (translationSessionId.value) {
    sendEvent("TRANSLATION_SESSION_END", { session_id: translationSessionId.value })
    translationSessionId.value = null
  }

  log("Translation session stopped", "info")
}

async function initializeAudioStreaming() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  audioContext.value = new AudioContextClass()

  if (audioContext.value.state === "suspended") {
    await audioContext.value.resume()
  }

  mediaStreamSource.value = audioContext.value.createMediaStreamSource(audioStream.value)
  audioProcessor.value = audioContext.value.createScriptProcessor(4096, 1, 1)

  audioProcessor.value.onaudioprocess = (event) => {
    if (!isTranslating.value) {
      return
    }
    handleAudioProcess(event.inputBuffer.getChannelData(0))
  }

  const silentGain = audioContext.value.createGain()
  silentGain.gain.value = 0
  mediaStreamSource.value.connect(audioProcessor.value)
  audioProcessor.value.connect(silentGain)
  silentGain.connect(audioContext.value.destination)

  pcmBuffer.value = new Float32Array(0)
  lastAudioSendTime.value = performance.now()
}

function handleAudioProcess(channelData) {
  if (!audioContext.value || !isTranslating.value) {
    return
  }

  const float32Data = new Float32Array(channelData.length)
  float32Data.set(channelData)
  pcmBuffer.value = concatFloat32Arrays(pcmBuffer.value, float32Data)

  const now = performance.now()
  const bufferDurationMs = (pcmBuffer.value.length / audioContext.value.sampleRate) * 1000
  const timeSinceLastSend = now - lastAudioSendTime.value

  if (bufferDurationMs >= minChunkDuration && timeSinceLastSend >= minChunkDuration) {
    sendAudioChunk()
    lastAudioSendTime.value = now
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
  if (!pcmBuffer.value || pcmBuffer.value.length === 0) {
    return
  }

  if (!isTranslating.value || !translationSessionId.value || !audioContext.value) {
    pcmBuffer.value = new Float32Array(0)
    return
  }

  const actualSampleRate = audioContext.value.sampleRate
  const targetSampleRate = 16000
  const resampledData = resampleAudio(pcmBuffer.value, actualSampleRate, targetSampleRate)

  const int16Array = new Int16Array(resampledData.length)
  for (let i = 0; i < resampledData.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32768))
  }

  const base64Audio = arrayBufferToBase64(int16Array.buffer)

  if (
    sendEvent("TRANSLATION_AUDIO_STREAM", {
      session_id: translationSessionId.value,
      audio_data: base64Audio
    })
  ) {
    audioChunksSent.value++
  }

  pcmBuffer.value = new Float32Array(0)
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

function playTTSAudio(base64Audio) {
  if (!base64Audio) {
    return
  }

  ttsAudioQueue.value.push(base64Audio)

  if (ttsAudioQueue.value.length > 1) {
    log(`TTS queued (${ttsAudioQueue.value.length} in queue)`, "info")
  }

  if (!isPlayingTTS.value) {
    playNextTTS()
  }
}

async function playNextTTS() {
  if (ttsAudioQueue.value.length === 0) {
    isPlayingTTS.value = false
    return
  }

  isPlayingTTS.value = true
  const base64Audio = ttsAudioQueue.value.shift()

  try {
    const binaryString = window.atob(base64Audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    if (!ttsAudioContext.value && AudioContextClass) {
      ttsAudioContext.value = new AudioContextClass({ sampleRate: 16000 })
      log("TTS Audio context created with sample rate: 16000 Hz", "info")
    }

    if (ttsAudioContext.value.state === "suspended") {
      await ttsAudioContext.value.resume()
    }

    const int16Array = new Int16Array(bytes.buffer)
    const float32Array = new Float32Array(int16Array.length)

    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0
    }

    const ttsSampleRate = 16000
    const audioBuffer = ttsAudioContext.value.createBuffer(1, float32Array.length, ttsSampleRate)
    audioBuffer.getChannelData(0).set(float32Array)

    if (audioBuffer.duration < 0.01) {
      log(`TTS PCM too short (${audioBuffer.duration}s), skipping`, "error")
      isPlayingTTS.value = false
      playNextTTS()
      return
    }

    const source = ttsAudioContext.value.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ttsAudioContext.value.destination)

    activeTTSAudioSources.value.push(source)

    source.onended = () => {
      const index = activeTTSAudioSources.value.indexOf(source)
      if (index > -1) {
        activeTTSAudioSources.value.splice(index, 1)
      }

      log(`TTS chunk finished (${audioBuffer.duration.toFixed(2)}s)`, "info")
      setTimeout(() => {
        isPlayingTTS.value = false
        playNextTTS()
      }, 10)
    }

    source.start(0)
    log(`▶️ Playing TTS (16kHz PCM, ${audioBuffer.duration.toFixed(2)}s) - ${ttsAudioQueue.value.length} remaining`, "success")
  } catch (error) {
    log(`Failed to play TTS: ${error.message}`, "error")
    console.error("TTS Error:", error)
    setTimeout(() => {
      isPlayingTTS.value = false
      playNextTTS()
    }, 50)
  }
}

function stopAllAudio() {
  if (activeTTSAudioSources.value.length > 0) {
    log(`Stopping ${activeTTSAudioSources.value.length} active audio source(s)`, "info")
    activeTTSAudioSources.value.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch (error) {
        // Source may already be stopped
      }
    })
    activeTTSAudioSources.value = []
  }
}

// Cleanup on unmount
onUnmounted(() => {
  disconnect()
  stopHeartbeat()

  if (audioContext.value) {
    audioContext.value.close().catch(() => {})
    audioContext.value = null
  }

  if (ttsAudioContext.value) {
    ttsAudioContext.value.close().catch(() => {})
    ttsAudioContext.value = null
  }
})

// Initialize
onMounted(() => {
  log("Translation component initialized", "success")
})
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
