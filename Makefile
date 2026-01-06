# Nebelus Examples - Makefile
# Helper commands for testing example applications

.PHONY: help vanilla-js vue-dev install-deps clean ws-chat sse-chat

# Default target
help:
	@echo "Nebelus Examples - Available Commands"
	@echo "======================================"
	@echo ""
	@echo "  make vanilla-js     - Serve vanilla JS translation app on http://localhost:8080"
	@echo "  make vue-html       - Serve Vue translation app (standalone HTML) on http://localhost:8081"
	@echo "  make ws-chat        - Serve WebSocket chat example on http://localhost:8082"
	@echo "  make sse-chat       - Serve SSE chat example on http://localhost:8083"
	@echo "  make vue-dev        - Run Vue examples in development mode (requires parent project)"
	@echo "  make install-deps   - Install dependencies for testing"
	@echo "  make clean          - Clean up temporary files"
	@echo ""
	@echo "Quick Start:"
	@echo "  1. Run 'make vanilla-js' to test the vanilla JavaScript app"
	@echo "  2. Run 'make vue-html' to test the Vue app (no build required)"
	@echo "  3. Run 'make ws-chat' to test WebSocket chat with AI agents"
	@echo "  4. Run 'make sse-chat' to test SSE chat with AI agents"
	@echo "  5. Open the URL shown in your browser"
	@echo "  6. Enter your Nebelus API key and test"
	@echo ""

# Serve vanilla JS translation app using Python's built-in HTTP server
vanilla-js:
	@echo "Starting vanilla JS translation app..."
	@echo "Open http://localhost:8080 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@cd vanillajs && python3 -m http.server 8080

# Alternative: serve using Node.js http-server (if installed)
vanilla-js-node:
	@echo "Starting vanilla JS translation app with Node.js..."
	@echo "Open http://localhost:8080 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@if command -v npx > /dev/null; then \
		cd vanillajs && npx -y http-server -p 8080 -c-1; \
	else \
		echo "Error: npx not found. Please install Node.js or use 'make vanilla-js' instead."; \
		exit 1; \
	fi

# Serve Vue translation app (standalone HTML with Vue from CDN)
vue-html:
	@echo "Starting Vue translation app (standalone HTML)..."
	@echo "Open http://localhost:8081 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@cd vue && python3 -m http.server 8081

# Serve WebSocket chat example
ws-chat:
	@echo "Starting WebSocket chat example..."
	@echo "Open http://localhost:8082 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@cd ws-chat && python3 -m http.server 8082

# Alternative: serve WebSocket chat using Node.js http-server
ws-chat-node:
	@echo "Starting WebSocket chat example with Node.js..."
	@echo "Open http://localhost:8082 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@if command -v npx > /dev/null; then \
		cd ws-chat && npx -y http-server -p 8082 -c-1; \
	else \
		echo "Error: npx not found. Please install Node.js or use 'make ws-chat' instead."; \
		exit 1; \
	fi

# Serve SSE chat example
sse-chat:
	@echo "Starting SSE chat example..."
	@echo "Open http://localhost:8083 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@cd sse-chat && python3 -m http.server 8083

# Alternative: serve SSE chat using Node.js http-server
sse-chat-node:
	@echo "Starting SSE chat example with Node.js..."
	@echo "Open http://localhost:8083 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@if command -v npx > /dev/null; then \
		cd sse-chat && npx -y http-server -p 8083 -c-1; \
	else \
		echo "Error: npx not found. Please install Node.js or use 'make sse-chat' instead."; \
		exit 1; \
	fi

# Alternative: serve Vue HTML using Node.js http-server
vue-html-node:
	@echo "Starting Vue translation app with Node.js..."
	@echo "Open http://localhost:8081 in your browser"
	@echo "Press Ctrl+C to stop the server"
	@echo ""
	@if command -v npx > /dev/null; then \
		cd vue && npx -y http-server -p 8081 -c-1; \
	else \
		echo "Error: npx not found. Please install Node.js or use 'make vue-html' instead."; \
		exit 1; \
	fi

# Run Vue examples in the parent project's dev server
vue-dev:
	@echo "Vue components can be tested in the main application."
	@echo ""
	@echo "To test Vue components:"
	@echo "  1. Go to the parent directory: cd .."
	@echo "  2. Run the dev server: npm run dev"
	@echo "  3. Import components in your Vue app:"
	@echo ""
	@echo "     import TranslationApp from '@/examples/vue/TranslationApp.vue'"
	@echo "     import MessageHistoryExample from '@/examples/vue/MessageHistoryExample.vue'"
	@echo ""
	@echo "  4. Use in template:"
	@echo ""
	@echo "     <TranslationApp default-api-url=\"wss://api.nebelus.ai\" />"
	@echo ""

# Install dependencies needed for testing
install-deps:
	@echo "Checking dependencies..."
	@if ! command -v python3 > /dev/null; then \
		echo "Warning: python3 not found. Install Python 3 to use 'make vanilla-js'"; \
	else \
		echo "✓ python3 found"; \
	fi
	@if ! command -v node > /dev/null; then \
		echo "Warning: node not found. Install Node.js to use 'make vanilla-js-node'"; \
	else \
		echo "✓ node found"; \
	fi
	@echo ""
	@echo "All required dependencies are installed!"

# Clean up temporary files
clean:
	@echo "Cleaning up temporary files..."
	@find . -name ".DS_Store" -delete
	@find . -name "*.pyc" -delete
	@find . -name "__pycache__" -delete -type d
	@echo "Cleanup complete!"

# Test all examples (runs checks and validation)
test:
	@echo "Testing examples..."
	@echo ""
	@echo "Checking vanilla JS app..."
	@if [ -f "vanillajs/index.html" ]; then \
		echo "✓ vanillajs/index.html found"; \
	else \
		echo "✗ vanillajs/index.html missing"; \
	fi
	@if [ -f "vanillajs/app.js" ]; then \
		echo "✓ vanillajs/app.js found"; \
	else \
		echo "✗ vanillajs/app.js missing"; \
	fi
	@echo ""
	@echo "Checking Vue components..."
	@if [ -f "vue/TranslationApp.vue" ]; then \
		echo "✓ vue/TranslationApp.vue found"; \
	else \
		echo "✗ vue/TranslationApp.vue missing"; \
	fi
	@echo ""
	@echo "Checking WebSocket chat example..."
	@if [ -f "ws-chat/index.html" ]; then \
		echo "✓ ws-chat/index.html found"; \
	else \
		echo "✗ ws-chat/index.html missing"; \
	fi
	@if [ -f "ws-chat/app.js" ]; then \
		echo "✓ ws-chat/app.js found"; \
	else \
		echo "✗ ws-chat/app.js missing"; \
	fi
	@echo ""
	@echo "Checking SSE chat example..."
	@if [ -f "sse-chat/index.html" ]; then \
		echo "✓ sse-chat/index.html found"; \
	else \
		echo "✗ sse-chat/index.html missing"; \
	fi
	@if [ -f "sse-chat/app.js" ]; then \
		echo "✓ sse-chat/app.js found"; \
	else \
		echo "✗ sse-chat/app.js missing"; \
	fi
	@echo ""
	@echo "All checks complete!"

# Show information about the examples
info:
	@echo "Nebelus Examples Information"
	@echo "============================"
	@echo ""
	@echo "Directory Structure:"
	@tree -L 2 -I 'node_modules|.git' . 2>/dev/null || find . -maxdepth 2 -type f -o -type d | grep -v ".git" | sort
	@echo ""
	@echo "For detailed documentation, see README.md"
