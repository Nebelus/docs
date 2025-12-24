# Nebelus Examples & Tutorials

This directory contains example applications and tutorials for working with Nebelus.

## 🌐 Live Demos

Visit our GitHub Pages site to try the examples online:
👉 **[https://nebelus.github.io/examples/](https://nebelus.github.io/examples/)**

## Quick Start

Use the Makefile to quickly test any example locally:

```bash
# Show all available commands
make help

# Test vanilla JS translation app
make vanilla-js

# Test Vue translation app
make vue-html

# Check all examples
make test
```

## Directory Structure

```
examples/
├── vanillajs/                      # Vanilla JavaScript translation app example
│   ├── index.html                  # Main HTML file
│   ├── app.js                      # Application logic
│   └── readme.md                   # App-specific documentation
│
└── vue/                            # Vue.js component examples
    └── TranslationApp.vue          # Real-time translation component
```

## Examples

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

### 2. Vue Component Examples
Vue.js component examples demonstrating Nebelus integration.

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
import TranslationApp from '@/examples/vue/TranslationApp.vue'
</script>
```

**Props:**
- `defaultApiUrl` (String, optional) - Default WebSocket URL (default: `wss://api.nebelus.ai`)

**Requirements:**
- Microphone access (browser will prompt user)
- HTTPS or localhost (required for getUserMedia)
- Valid Nebelus API key

## Contributing

When adding new examples:
1. Create a descriptive directory name
2. Include a README.md explaining the example
3. Keep examples self-contained and well-documented
4. Add your example to this main README

## 🚀 Deployment

This repository is automatically deployed to GitHub Pages on every push to the main branch.

### Setting up GitHub Pages

1. Go to your repository settings
2. Navigate to **Pages** section
3. Under **Source**, select **GitHub Actions**
4. The workflow in `.github/workflows/deploy.yml` will handle deployment

Your examples will be available at: `https://<username>.github.io/examples/`

### Local Preview

Test the landing page locally:
```bash
# Serve the landing page
python3 -m http.server 8080

# Then visit http://localhost:8080
```

## 📦 Repository Structure

```
examples/
├── index.html                   # Landing page (GitHub Pages home)
├── .github/
│   └── workflows/
│       └── deploy.yml           # Auto-deployment to GitHub Pages
├── vanillajs/                   # Vanilla JavaScript examples
├── vue/                         # Vue.js examples
├── Makefile                     # Helper commands
└── README.md                    # This file
```

## License

These examples are provided as-is for educational and demonstration purposes.
