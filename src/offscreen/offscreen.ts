import type { AudioChunkMessage, StartOffscreenCaptureMessage } from "../types/messages.js";

const CHUNK_INTERVAL_MS = 2000;

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let captureTabId: number | null = null;

chrome.runtime.onMessage.addListener((msg: unknown) => {
  const message = msg as { type: string };

  if (message.type === "START_OFFSCREEN_CAPTURE") {
    const { streamId, tabId } = message as StartOffscreenCaptureMessage;
    captureTabId = tabId;
    startCapture(streamId).catch((err) => {
      console.error("[Offscreen] Failed to start capture:", err);
    });
    return false;
  }

  if (message.type === "STOP_OFFSCREEN_CAPTURE") {
    stopCapture();
    return false;
  }
});

async function startCapture(streamId: string): Promise<void> {
  const capturedStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    } as MediaTrackConstraints,
    video: false,
  });

  stream = capturedStream;

  // Pipe audio through Web Audio to preserve playback
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(audioContext.destination);

  // Also capture for recording
  const destination = audioContext.createMediaStreamDestination();
  source.connect(destination);

  const mimeType = getSupportedMimeType();
  recorder = new MediaRecorder(destination.stream, { mimeType });

  recorder.start();

  intervalId = setInterval(() => {
    if (recorder?.state === "recording") {
      recorder.requestData();
      recorder.stop();
      recorder.start();
    }
  }, CHUNK_INTERVAL_MS);

  recorder.ondataavailable = async (event) => {
    if (event.data.size < 500) return;
    const wavBlob = await convertToWav(event.data);
    const base64 = await blobToBase64(wavBlob);
    const msg: AudioChunkMessage = {
      type: "AUDIO_CHUNK",
      audioData: base64,
      mimeType: "audio/wav",
      tabId: captureTabId ?? undefined,
    };
    chrome.runtime.sendMessage(msg);
  };
}

function stopCapture(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  recorder?.stop();
  recorder = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  audioContext?.close();
  audioContext = null;
  captureTabId = null;
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

async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  const numChannels = decoded.numberOfChannels;
  const sampleRate = decoded.sampleRate;
  const numSamples = decoded.length;
  const bytesPerSample = 2; // 16-bit PCM
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, decoded.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
