import { useEffect, useCallback } from "react";
import type { UIMessage, PluginMessage } from "./types";

/** Send a typed message from UI → plugin sandbox */
export function postToPlugin(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, "*");
}

/** Listen for typed messages from plugin sandbox → UI */
export function usePluginMessage(handler: (msg: PluginMessage) => void) {
  const stableHandler = useCallback(
    (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg && typeof msg.type === "string") {
        handler(msg as PluginMessage);
      }
    },
    [handler]
  );

  useEffect(() => {
    window.addEventListener("message", stableHandler);
    return () => window.removeEventListener("message", stableHandler);
  }, [stableHandler]);
}
