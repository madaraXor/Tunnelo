"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusDot } from "./StatusDot";
import { useTunnelStore } from "../store/tunnelStore";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const tunnels = useTunnelStore((s) => s.tunnels);
  const selectedId = useTunnelStore((s) => s.selectedId);
  const setSelectedId = useTunnelStore((s) => s.setSelectedId);
  const setFormOpen = useTunnelStore((s) => s.setFormOpen);
  const statuses = useTunnelStore((s) => s.statuses);
  const runningIds = useTunnelStore((s) => s.runningIds);

  return (
    <div className="flex h-full w-[280px] flex-col border-r bg-card">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-bold tracking-tight">Tunnelo</h1>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {tunnels.map((tunnel, index) => {
            const runtimeId = runningIds[index];
            const status = runtimeId ? statuses[runtimeId] || null : null;
            const hasNotes = tunnel.notes && tunnel.notes.trim();

            const button = (
              <button
                key={index}
                onClick={() => setSelectedId(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selectedId === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <StatusDot status={status} />
                <span className="truncate">{tunnel.name || "Unnamed Tunnel"}</span>
              </button>
            );

            if (hasNotes) {
              return (
                <Tooltip key={index} delayDuration={300}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[250px]">
                    <p className="text-xs whitespace-pre-wrap">{tunnel.notes}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3">
        <Button
          onClick={() => setFormOpen(true, null)}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Tunnel
        </Button>
      </div>
    </div>
  );
}
