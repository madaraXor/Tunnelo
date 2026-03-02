"use client";

import { Play, Square, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "./StatusBadge";
import { LogPanel } from "./LogPanel";
import { useTunnelStore } from "../store/tunnelStore";
import { toast } from "sonner";

export function TunnelCard() {
  const selectedId = useTunnelStore((s) => s.selectedId);
  const tunnels = useTunnelStore((s) => s.tunnels);
  const statuses = useTunnelStore((s) => s.statuses);
  const logs = useTunnelStore((s) => s.logs);
  const runningIds = useTunnelStore((s) => s.runningIds);
  const setRunningId = useTunnelStore((s) => s.setRunningId);
  const setFormOpen = useTunnelStore((s) => s.setFormOpen);
  const removeTunnel = useTunnelStore((s) => s.removeTunnel);

  if (selectedId === null || !tunnels[selectedId]) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>Select a tunnel or create a new one to get started.</p>
      </div>
    );
  }

  const tunnel = tunnels[selectedId];
  const runtimeId = runningIds[selectedId];
  const status = runtimeId ? statuses[runtimeId] || null : null;
  const tunnelLogs = runtimeId ? logs[runtimeId] || [] : [];

  const isActive = status?.type === "active";
  const isConnecting = status?.type === "connecting";

  async function handleStart() {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const id = await invoke("start_tunnel", { config: tunnel });
      setRunningId(selectedId, id);
      toast.success("Tunnel started");
    } catch (e) {
      toast.error(`Failed to start: ${e}`);
    }
  }

  async function handleStop() {
    if (!runtimeId) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("stop_tunnel", { id: runtimeId });
      toast.success("Tunnel stopped");
    } catch (e) {
      toast.error(`Failed to stop: ${e}`);
    }
  }

  function handleEdit() {
    setFormOpen(true, tunnel);
  }

  function handleDelete() {
    if (isActive && runtimeId) {
      handleStop();
    }
    removeTunnel(selectedId);
    toast.success("Tunnel deleted");
  }

  const directionLabel = tunnel.forwarding_direction === "local" ? "Local (-L)" : "Remote (-R)";
  const directionColor = tunnel.forwarding_direction === "local" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-purple-500/20 text-purple-400 border-purple-500/30";

  return (
    <div className="flex-1 p-6 overflow-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{tunnel.name || "Unnamed Tunnel"}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={directionColor}>{directionLabel}</Badge>
              <StatusBadge status={status} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isActive && !isConnecting && (
              <Button size="sm" onClick={handleStart}>
                <Play className="mr-1 h-4 w-4" /> Start
              </Button>
            )}
            {(isActive || isConnecting) && (
              <Button size="sm" variant="destructive" onClick={handleStop}>
                <Square className="mr-1 h-4 w-4" /> Stop
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">SSH Host</p>
              <p className="font-mono">{tunnel.ssh_host}:{tunnel.ssh_port}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Username</p>
              <p className="font-mono">{tunnel.ssh_username}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Auth Method</p>
              <p className="capitalize">{tunnel.auth_method === "private_key" ? "Private Key" : "Password"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Direction</p>
              <p>{directionLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Local Port</p>
              <p className="font-mono">{tunnel.local_port}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remote</p>
              <p className="font-mono">{tunnel.remote_host}:{tunnel.remote_port}</p>
            </div>
            {tunnel.auto_start && (
              <div>
                <p className="text-muted-foreground">Auto-start</p>
                <Badge variant="outline" className="text-green-400 border-green-500/30">Enabled</Badge>
              </div>
            )}
          </div>
          {tunnel.notes && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{tunnel.notes}</p>
              </div>
            </>
          )}
          <Separator />
          <LogPanel logs={tunnelLogs} />
        </CardContent>
      </Card>
    </div>
  );
}
