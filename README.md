# YouTube Real-Time Translated Subtitles

A Chrome extension that translates YouTube subtitles in real-time using a three-layer caption fallback chain — from YouTube's TimedText API, DOM caption scraping, to Whisper STT for captionless videos.

## Features

- **Three-layer caption fallback**: TimedText API → DOM observer → Audio capture + Whisper STT
- **Local LLM translation**: Ollama with streaming support (default: `qwen2.5:3b`)
- **Whisper STT fallback**: For videos without any captions (`whisper.cpp` or Groq API)
- **Multiple translation backends**: Ollama (local), YouTube Native captions
- **Overlay UI**: Translated subtitles displayed as a non-intrusive overlay with configurable font size and opacity
- **Popup settings**: Quick toggle and backend/display configuration without leaving YouTube

## Prerequisites

- [Bun](https://bun.sh) v1.0+
- Chrome or Chromium browser
- [Ollama](https://ollama.com) running locally with the `qwen2.5:3b` model pulled:
  ```bash
  ollama pull qwen2.5:3b
  # Verify Ollama is running
  curl http://localhost:11434/api/tags
  # Expected: JSON listing pulled models, not a connection error
  ```
- *(Optional)* [whisper.cpp server](https://github.com/ggerganov/whisper.cpp) at `http://localhost:8080` for captionless videos — see [whisper.cpp Setup](#whispercpp-setup) below
- *(Optional)* Groq API key for cloud-based Whisper transcription

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Build the extension
bun run build

# 3. Load in Chrome
#    Open chrome://extensions → enable Developer mode → "Load unpacked" → select this project root

# 4. Open any YouTube video and click the extension icon to configure
```

## Configuration

Open the extension popup on any YouTube tab to configure:

| Setting | Options | Default |
|---|---|---|
| Translation backend | `ollama` / `youtube-native` | `ollama` |
| Ollama host | URL | `http://localhost:11434` |
| Ollama model | any pulled model | `qwen2.5:3b` |
| Whisper provider | `whisper-cpp` / `groq` | `whisper-cpp` |
| Whisper host | URL | `http://localhost:8080` |
| Target language | BCP-47 tag | `zh-TW` |
| Font size | `small` / `medium` / `large` | `medium` |
| Opacity | 0.2 – 1.0 | `0.85` |

## Architecture

```
┌─────────────────────────────────┐
│         Content Script          │
│  ┌──────────────────────────┐   │
│  │  caption-source.ts       │   │
│  │  Layer 1: TimedText API  │   │
│  │  Layer 2: DOM Observer   │   │
│  │  Layer 3: Audio Capture  │   │
│  └───────────┬──────────────┘   │
│              │ raw text         │
│  ┌───────────▼──────────────┐   │
│  │  overlay.ts              │   │
│  │  Subtitle overlay UI     │   │
│  └──────────────────────────┘   │
└──────────────┬──────────────────┘
               │ chrome.runtime message
┌──────────────▼──────────────────┐
│         Background SW           │
│  ┌──────────────────────────┐   │
│  │  translator.ts + cache   │   │
│  │  ┌────────┬────────────┐ │   │
│  │  │ Ollama │ YT Native  │ │   │
│  │  │        │ Whisper    │ │   │
│  │  └────────┴────────────┘ │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
               │
┌──────────────▼──────────────────┐
│           Popup                 │
│  popup.html / popup.ts          │
│  Settings UI                    │
└─────────────────────────────────┘
```

### Three-layer caption degradation

1. **TimedText API** — fetches timed captions directly from YouTube's internal API (most accurate, lowest latency)
2. **DOM Observer** — watches the YouTube caption DOM for text changes (fallback when TimedText is unavailable)
3. **Audio Capture + Whisper** — captures tab audio and sends to Whisper STT (last resort for captionless videos)

## Project Structure

```
src/
├── background/
│   ├── backends/
│   │   ├── ollama.ts         # Ollama streaming translation
│   │   ├── types.ts          # TranslationBackend interface
│   │   └── youtube-native.ts # YouTube caption pass-through
│   ├── cache.ts              # Translation LRU cache
│   ├── cache.test.ts
│   ├── dnr.ts                # DeclarativeNetRequest rules
│   ├── index.ts              # Service worker entry
│   ├── translator.ts         # Backend dispatcher
│   └── whisper.ts            # Whisper STT client
├── content/
│   ├── audio-capture.ts      # Tab audio → Whisper
│   ├── caption-source.ts     # Three-layer caption source
│   ├── content.css
│   ├── dom-observer.ts       # YouTube caption DOM watcher
│   ├── index.ts              # Content script entry
│   ├── overlay.ts            # Translated subtitle overlay
│   ├── timedtext-fetcher.ts  # YouTube TimedText API client
│   └── timedtext-fetcher.test.ts
├── popup/
│   ├── popup.css
│   ├── popup.html
│   └── popup.ts              # Settings UI logic
├── types/
│   ├── index.ts
│   ├── messages.ts           # Chrome message types
│   └── settings.ts           # Settings schema + defaults
└── utils/
    ├── abort.ts
    ├── debounce.ts
    ├── debounce.test.ts
    └── messaging.ts          # chrome.runtime helpers
```

## Development

```bash
# Install dependencies
bun install

# One-off build (outputs to dist/)
bun run build

# Watch mode (rebuilds on file changes)
bun run watch

# Run tests (19 tests: cache, debounce, timedtext-fetcher)
bun test
```

After each build, reload the extension in `chrome://extensions` by clicking the refresh icon.

## How It Works

1. The content script intercepts YouTube's `TimedText` API responses via a fetch hook to get caption text with precise timing.
2. If TimedText is unavailable, `dom-observer.ts` watches the `.ytp-caption-segment` DOM nodes for text changes.
3. If no captions exist at all, `audio-capture.ts` captures tab audio via `chrome.tabCapture`, encodes it, and sends it to the configured Whisper endpoint for transcription.
4. Raw caption text is sent via `chrome.runtime.sendMessage` to the background service worker.
5. The background worker checks its LRU cache; on miss, it calls the configured translation backend.
6. For Ollama, translation streams token-by-token back to the content script so the overlay updates progressively.
7. The translated text is rendered in `overlay.ts` as a fixed-position element above the YouTube player.

## whisper.cpp Setup

whisper.cpp is needed only when you want to translate videos that have **no captions at all**. The extension captures tab audio and sends it to a local HTTP server for transcription.

Two setup options are available: a **container** approach (no compilation required) or **building from source**.

---

### Using Podman / Docker

> **Quick start with just:** If you have [just](https://github.com/casey/just) installed:
> ```bash
> just whisper-build   # build container
> just whisper-run     # download model + start server
> ```

The official whisper.cpp container image includes curl and ffmpeg. Replace `podman` with `docker` if you are using Docker.

#### 1. Download a model

```bash
# With just (recommended)
just model          # downloads ggml-small.bin
just model base.en  # downloads a specific model

# Manually
mkdir -p models
curl -L -o models/ggml-small.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
```

#### 2. Start the server

```bash
podman run --rm -p 8080:8080 \
  -v ./models:/models \
  ghcr.io/ggml-org/whisper.cpp:main \
  /app/build/bin/whisper-server \
  --model /models/ggml-small.bin \
  --host 0.0.0.0 --port 8080
```

#### 3. Verify it is running

```bash
curl http://localhost:8080/inference -F "file=@/dev/null" -F "response_format=json"
# Expected: JSON response (possibly empty text), not a connection error
```

#### NVIDIA GPU acceleration (Linux / Windows WSL2)

**Prerequisites:**

1. Confirm the host (or WSL2) can see the GPU:
   ```bash
   nvidia-smi
   ```

2. Install NVIDIA Container Toolkit inside WSL2 / Linux:
   ```bash
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
     sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
     sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
   sudo apt update && sudo apt install -y nvidia-container-toolkit
   ```

3. Generate the CDI spec:
   ```bash
   sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
   nvidia-ctk cdi list   # should show nvidia.com/gpu=0, nvidia.com/gpu=all, etc.
   ```

4. Verify GPU passthrough works (requires Podman 4.1.0+):
   ```bash
   podman run --rm --device nvidia.com/gpu=all \
     ghcr.io/ggml-org/whisper.cpp:main-cuda \
     nvidia-smi
   ```
   If the GPU model and driver version are printed, the full chain is working.

**Start the server with GPU:**

```bash
podman run --rm -p 8080:8080 \
  --device nvidia.com/gpu=all \
  -v ./models:/models \
  ghcr.io/ggml-org/whisper.cpp:main-cuda \
  /app/build/bin/whisper-server \
  --model /models/ggml-small.bin \
  --host 0.0.0.0 --port 8080
```

> **Apple Silicon note**: Metal is not available inside Linux containers. macOS users should use the **Building from source** method below with `-DGGML_METAL=1`.

---

### Building from source

#### 1. Build whisper.cpp

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
cmake -B build
cmake --build build --config Release -j$(nproc)
```

#### 2. Download a model

```bash
# Recommended: small model — good balance of speed and accuracy
bash ./models/download-ggml-model.sh small

# Lighter alternative
bash ./models/download-ggml-model.sh base.en
```

Models are saved to `models/ggml-<name>.bin`.

#### 3. Start the server

```bash
./build/bin/whisper-server \
  --model models/ggml-small.bin \
  --host 0.0.0.0 \
  --port 8080
```

The server exposes `POST /inference` and accepts multipart form uploads — exactly what this extension sends (`audio.webm` + `response_format=json`).

#### 4. Verify it is running

```bash
curl http://localhost:8080/inference -F "file=@/dev/null" -F "response_format=json"
# Expected: JSON response (possibly empty text), not a connection error
```

#### GPU acceleration (optional)

```bash
# CUDA
cmake -B build -DGGML_CUDA=1
cmake --build build --config Release -j$(nproc)

# Metal (macOS)
cmake -B build -DGGML_METAL=1
cmake --build build --config Release -j$(nproc)
```

### Notes

- The extension sends audio as `audio/webm` (captured via `chrome.tabCapture`). whisper.cpp server handles this format natively via ffmpeg; ensure your build includes ffmpeg support or convert to WAV if transcription fails.
- For a simpler cloud alternative, use **Groq** instead: set Whisper provider to `groq` in the popup and enter your Groq API key. No local server required.

## Release

Releases are automated via GitHub Actions. Pushing a `v*` tag triggers the release workflow: runs tests, builds the extension, packages it as a zip, and creates a GitHub Release.

```bash
git tag v1.0.0
git push origin v1.0.0
```

> Note: `git push origin` without a tag name does **not** push tags and will not trigger the release workflow.

## License

MIT
