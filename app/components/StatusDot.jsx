"use client";

import { cn } from "@/lib/utils";

const dotColors = {
  stopped: "bg-gray-500",
  connecting: "bg-yellow-500 animate-pulse",
  active: "bg-green-500",
  error: "bg-red-500",
};

export function StatusDot({ status }) {
  const statusType = status?.type || "stopped";
  return (
    <span className={cn("inline-block h-2 w-2 rounded-full", dotColors[statusType] || dotColors.stopped)} />
  );
}
