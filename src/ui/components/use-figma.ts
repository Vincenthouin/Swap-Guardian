import { useEffect, useCallback } from "react";
import type { UIMessage, PluginMessage } from "./types";

/**
 * Send a message to the Figma plugin sandbox (code.ts).
 */
export function postToPlugin(message: UIMessage) {
  parent.postMessage({ pluginMessage: message }, "*");
}

/**
 * Hook to listen for messages from the Figma plugin sandbox.
 * Automatically cleans up on unmount.
 */
export function usePluginMessage(
  handler: (message: PluginMessage) => void
) {
  const stableHandler = useCallback(
    (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg) {
        handler(msg);
      }
    },
    [handler]
  );

  useEffect(() => {
    window.addEventListener("message", stableHandler);
    return () => window.removeEventListener("message", stableHandler);
  }, [stableHandler]);
}
