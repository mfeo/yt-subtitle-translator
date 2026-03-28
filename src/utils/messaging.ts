import type { ExtensionMessage, MessageResponse } from "../types/messages.js";

export function sendToBackground<T = unknown>(
  message: ExtensionMessage
): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

export function sendToTab<T = unknown>(
  tabId: number,
  message: ExtensionMessage
): Promise<MessageResponse<T>> {
  return chrome.tabs.sendMessage(tabId, message) as Promise<MessageResponse<T>>;
}

export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ) => Promise<unknown> | unknown
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = handler(message as ExtensionMessage, sender);
    if (result instanceof Promise) {
      result
        .then((data) => sendResponse({ success: true, data }))
        .catch((err: unknown) =>
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      return true; // keep channel open
    }
    if (result !== undefined) {
      sendResponse({ success: true, data: result });
    }
    return false;
  });
}
