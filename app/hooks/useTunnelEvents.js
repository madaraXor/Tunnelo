"use client";

import { useEffect } from "react";
import { useTunnelStore } from "../store/tunnelStore";

export function useTunnelEvents() {
  const setStatus = useTunnelStore((s) => s.setStatus);
  const addLog = useTunnelStore((s) => s.addLog);
  const setRunningId = useTunnelStore((s) => s.setRunningId);

  useEffect(() => {
    let unlistenStatus;
    let unlistenLog;
    let unlistenStarted;

    async function setup() {
      const { listen } = await import("@tauri-apps/api/event");

      unlistenStatus = await listen("tunnel:status_changed", (event) => {
        const { id, status } = event.payload;
        setStatus(id, status);
      });

      unlistenLog = await listen("tunnel:log", (event) => {
        const { id, message } = event.payload;
        addLog(id, message);
      });

      unlistenStarted = await listen("tunnel:started", (event) => {
        const { id, config } = event.payload;
        // Match the started tunnel to a stored tunnel by name and map the runtime ID
        const tunnels = useTunnelStore.getState().tunnels;
        const index = tunnels.findIndex((t) => t.name === config.name);
        if (index !== -1) {
          setRunningId(index, id);
        }
      });
    }

    setup();

    return () => {
      if (unlistenStatus) unlistenStatus();
      if (unlistenLog) unlistenLog();
      if (unlistenStarted) unlistenStarted();
    };
  }, [setStatus, addLog, setRunningId]);
}
