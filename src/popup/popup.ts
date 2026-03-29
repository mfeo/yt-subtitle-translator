import type { Settings } from "../types/settings.js";
import type { TranslationBackendName } from "../types/index.js";

type El<T extends HTMLElement = HTMLElement> = T | null;

function $(id: string): El {
  return document.getElementById(id);
}

function $input(id: string): El<HTMLInputElement> {
  return document.getElementById(id) as HTMLInputElement | null;
}

function $select(id: string): El<HTMLSelectElement> {
  return document.getElementById(id) as HTMLSelectElement | null;
}

async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (resp: unknown) => {
      const r = resp as { success: boolean; data: Settings };
      resolve(r?.data ?? ({} as Settings));
    });
  });
}

async function saveSettings(patch: Partial<Settings>): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: patch }, () => resolve());
  });
}

function setStatus(msg: string, ok?: boolean): void {
  const el = $("status-msg");
  if (!el) return;
  el.textContent = msg;
  el.className = ok === true ? "status-ok" : ok === false ? "status-err" : "status-neutral";
}

async function testConnection(backend: TranslationBackendName): Promise<void> {
  setStatus("測試連線中…");
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "TEST_CONNECTION", backend }, (resp: unknown) => {
      const r = resp as { success: boolean; data?: { available: boolean } };
      if (r?.success && r.data?.available) {
        setStatus("連線成功 ✓", true);
      } else {
        setStatus("連線失敗 — 請檢查設定", false);
      }
      resolve();
    });
  });
}

async function init(): Promise<void> {
  const s = await getSettings();

  // Enabled toggle
  const enabledToggle = $input("enabled");
  if (enabledToggle) enabledToggle.checked = s.enabled;

  // Target language
  const targetLangSel = $select("target-lang");
  if (targetLangSel) targetLangSel.value = s.targetLang;

  // Translation backend
  const backendSel = $select("backend");
  if (backendSel) backendSel.value = s.translationBackend;

  // Ollama config
  const ollamaHost = $input("ollama-host");
  const ollamaModel = $input("ollama-model");
  if (ollamaHost) ollamaHost.value = s.ollama.host;
  if (ollamaModel) ollamaModel.value = s.ollama.model;

  // Whisper config
  const whisperProvider = $select("whisper-provider");
  const whisperHost = $input("whisper-host");
  const groqKey = $input("groq-api-key");
  if (whisperProvider) whisperProvider.value = s.whisper.provider;
  if (whisperHost) whisperHost.value = s.whisper.host;
  if (groqKey) groqKey.value = s.whisper.groqApiKey;

  // Display
  const fontSizeSel = $select("font-size");
  const opacityInput = $input("opacity");
  if (fontSizeSel) fontSizeSel.value = s.display.fontSize;
  if (opacityInput) opacityInput.value = String(s.display.opacity);
  const opacityVal = $("opacity-val");
  opacityInput?.addEventListener("input", () => {
    if (opacityVal) opacityVal.textContent = opacityInput.value;
  });

  updateBackendVisibility(s.translationBackend);
  updateWhisperVisibility(s.whisper.provider);

  // Event listeners
  enabledToggle?.addEventListener("change", async () => {
    await saveSettings({ enabled: enabledToggle.checked });
  });

  backendSel?.addEventListener("change", () => {
    updateBackendVisibility(backendSel.value as TranslationBackendName);
  });

  whisperProvider?.addEventListener("change", () => {
    if (whisperProvider)
      updateWhisperVisibility(whisperProvider.value as Settings["whisper"]["provider"]);
  });

  $("save-btn")?.addEventListener("click", async () => {
    const patch: Partial<Settings> = {
      enabled: enabledToggle?.checked ?? true,
      targetLang: targetLangSel?.value ?? "zh-TW",
      translationBackend: (backendSel?.value ?? "ollama") as TranslationBackendName,
      ollama: {
        host: ollamaHost?.value ?? "http://localhost:11434",
        model: ollamaModel?.value ?? "qwen2.5:3b",
      },
      whisper: {
        provider: (whisperProvider?.value ?? "whisper-cpp") as Settings["whisper"]["provider"],
        host: whisperHost?.value ?? "http://localhost:8080",
        groqApiKey: groqKey?.value ?? "",
      },
      display: {
        fontSize: (fontSizeSel?.value ?? "medium") as Settings["display"]["fontSize"],
        opacity: parseFloat(opacityInput?.value ?? "0.85"),
      },
    };
    await saveSettings(patch);
    setStatus("設定已儲存 ✓", true);
  });

  $("test-btn")?.addEventListener("click", async () => {
    const backend = (backendSel?.value ?? "ollama") as TranslationBackendName;
    await testConnection(backend);
  });
}

function updateBackendVisibility(backend: TranslationBackendName): void {
  const ollamaSection = $("ollama-section");
  if (ollamaSection) ollamaSection.hidden = backend !== "ollama";
}

function updateWhisperVisibility(provider: Settings["whisper"]["provider"]): void {
  const hostRow = $("whisper-host-row");
  const groqRow = $("groq-key-row");
  if (hostRow) hostRow.hidden = provider === "groq";
  if (groqRow) groqRow.hidden = provider !== "groq";
}

document.addEventListener("DOMContentLoaded", init);
