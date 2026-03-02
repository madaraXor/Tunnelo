"use client";

import { create } from "zustand";

export const useTunnelStore = create((set, get) => ({
  tunnels: [],
  selectedId: null,
  statuses: {},
  logs: {},
  runningIds: {},
  editingTunnel: null,
  formOpen: false,

  setSelectedId: (id) => set({ selectedId: id }),

  setFormOpen: (open, tunnel = null) =>
    set({ formOpen: open, editingTunnel: tunnel }),

  setRunningId: (tunnelIndex, runtimeId) =>
    set((state) => ({
      runningIds: { ...state.runningIds, [tunnelIndex]: runtimeId },
    })),

  setStatus: (id, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [id]: status },
    })),

  addLog: (id, message) =>
    set((state) => {
      const existing = state.logs[id] || [];
      const updated = [...existing, message].slice(-5);
      return { logs: { ...state.logs, [id]: updated } };
    }),

  addTunnel: (tunnel) =>
    set((state) => {
      const tunnels = [...state.tunnels, tunnel];
      get().saveTunnels(tunnels);
      return { tunnels, selectedId: tunnels.length - 1 };
    }),

  updateTunnel: (index, tunnel) =>
    set((state) => {
      const tunnels = [...state.tunnels];
      tunnels[index] = tunnel;
      get().saveTunnels(tunnels);
      return { tunnels };
    }),

  removeTunnel: (index) =>
    set((state) => {
      const tunnels = state.tunnels.filter((_, i) => i !== index);
      const selectedId =
        state.selectedId === index
          ? null
          : state.selectedId > index
            ? state.selectedId - 1
            : state.selectedId;
      get().saveTunnels(tunnels);
      return { tunnels, selectedId };
    }),

  getStatusForTunnel: (tunnelIndex) => {
    const state = get();
    const runtimeId = state.runningIds[tunnelIndex];
    if (!runtimeId) return null;
    return state.statuses[runtimeId] || null;
  },

  loadTunnels: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const configs = await invoke("load_tunnels");
      set({ tunnels: configs });

      // Reconcile with already-running tunnels (auto-start, tray start)
      const active = await invoke("list_active_tunnels");
      if (active.length > 0) {
        const runningIds = {};
        const statuses = {};
        for (const info of active) {
          const index = configs.findIndex((c) => c.name === info.config.name);
          if (index !== -1) {
            runningIds[index] = info.id;
            statuses[info.id] = info.status;
          }
        }
        set((state) => ({
          runningIds: { ...state.runningIds, ...runningIds },
          statuses: { ...state.statuses, ...statuses },
        }));
      }
    } catch (e) {
      console.error("Failed to load tunnels:", e);
    }
  },

  saveTunnels: async (tunnels) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_tunnels", { configs: tunnels });
    } catch (e) {
      console.error("Failed to save tunnels:", e);
    }
  },
}));
