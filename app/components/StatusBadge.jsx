"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig = {
  stopped: { label: "Stopped", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  connecting: { label: "Connecting", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  active: { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  error: { label: "Error", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export function StatusBadge({ status }) {
  if (!status) {
    const cfg = statusConfig.stopped;
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  }

  const statusType = status.type || "stopped";
  const cfg = statusConfig[statusType] || statusConfig.stopped;
  const label = statusType === "error" ? `Error: ${status.message || "Unknown"}` : cfg.label;

  return <Badge className={cfg.className}>{label}</Badge>;
}
