import type { AudioChunkMessage } from "../types/messages.js";

const CHUNK_INTERVAL_MS = 4000; // send audio every 4 seconds

type TranscriptCallback = (text: string) => void;

export class AudioCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callback: TranscriptCallback;

  constructor(callback: TranscriptCallback) {
    this.callback = callback;
  }

  async start(): Promise<void> {
    // Request tab audio capture via service worker relay
    const stream = await this.requestTabCapture();
    if (!stream) throw new Error("Tab capture not available");

    this.stream = stream;

    // Pipe audio through Web Audio to preserve playback
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.audioContext.destination); // play back to speakers

    // Also capture for recording
    this.destination = this.audioContext.createMediaStreamDestination();
    source.connect(this.destination);

    const mimeType = getSupportedMimeType();
    this.recorder = new MediaRecorder(this.destination.stream, { mimeType });

    this.recorder.start();

    this.intervalId = setInterval(() => {
      if (this.recorder?.state === "recording") {
        this.recorder.requestData();
        this.recorder.stop();
        this.recorder.start();
      }
    }, CHUNK_INTERVAL_MS);

    this.recorder.ondataavailable = async (event) => {
      if (event.data.size < 1000) return; // skip tiny/silent chunks
      const base64 = await blobToBase64(event.data);
      this.sendAudioChunk(base64, mimeType);
    };
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.recorder?.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioContext?.close();
    this.audioContext = null;
  }

  private async requestTabCapture(): Promise<MediaStream | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "REQUEST_TAB_CAPTURE" },
        (response: unknown) => {
          if (chrome.runtime.lastError || !response) {
            resolve(null);
            return;
          }
          const resp = response as { success: boolean; streamId?: string };
          if (!resp.success || !resp.streamId) {
            resolve(null);
            return;
          }
          // Use getUserMedia with chromeMediaSourceId
          navigator.mediaDevices
            .getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: "tab",
                  chromeMediaSourceId: resp.streamId,
                },
              } as MediaTrackConstraints,
              video: false,
            })
            .then((stream) => resolve(stream))
            .catch(() => resolve(null));
        }
      );
    });
  }

  private sendAudioChunk(audioData: string, mimeType: string): void {
    const msg: AudioChunkMessage = {
      type: "AUDIO_CHUNK",
      audioData,
      mimeType,
    };

    chrome.runtime.sendMessage(msg, (response: unknown) => {
      if (chrome.runtime.lastError) return;
      const resp = response as { success: boolean; data?: { text: string } };
      if (resp?.success && resp.data?.text) {
        this.callback(resp.data.text);
      }
    });
  }
}

function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
