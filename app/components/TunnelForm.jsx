"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTunnelStore } from "../store/tunnelStore";
import { toast } from "sonner";

const defaultConfig = {
  name: "",
  ssh_host: "",
  ssh_port: 22,
  ssh_username: "",
  auth_method: "password",
  forwarding_direction: "local",
  local_port: 0,
  remote_host: "127.0.0.1",
  remote_port: 0,
  password: "",
  private_key_path: "",
  notes: "",
  auto_start: false,
};

export function TunnelForm() {
  const formOpen = useTunnelStore((s) => s.formOpen);
  const editingTunnel = useTunnelStore((s) => s.editingTunnel);
  const setFormOpen = useTunnelStore((s) => s.setFormOpen);
  const addTunnel = useTunnelStore((s) => s.addTunnel);
  const updateTunnel = useTunnelStore((s) => s.updateTunnel);
  const selectedId = useTunnelStore((s) => s.selectedId);
  const runningIds = useTunnelStore((s) => s.runningIds);
  const statuses = useTunnelStore((s) => s.statuses);
  const setRunningId = useTunnelStore((s) => s.setRunningId);

  const [config, setConfig] = useState(defaultConfig);
  const [testing, setTesting] = useState(false);

  const isEditing = editingTunnel !== null;

  useEffect(() => {
    if (formOpen) {
      if (editingTunnel !== null) {
        setConfig({ ...defaultConfig, ...editingTunnel });
      } else {
        setConfig({ ...defaultConfig });
      }
    }
  }, [formOpen, editingTunnel]);

  function handleOpenChange(open) {
    if (!open) {
      setFormOpen(false);
    }
  }

  function handleChange(field, value) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!config.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!config.ssh_host.trim()) {
      toast.error("SSH host is required");
      return;
    }

    const tunnelConfig = {
      ...config,
      ssh_port: Number(config.ssh_port),
      local_port: Number(config.local_port),
      remote_port: Number(config.remote_port),
      password: config.auth_method === "password" ? config.password : undefined,
      private_key_path: config.auth_method === "private_key" ? config.private_key_path : undefined,
      notes: config.notes || undefined,
      auto_start: config.auto_start || undefined,
    };

    if (isEditing && selectedId !== null) {
      const runtimeId = runningIds[selectedId];
      const wasActive = runtimeId && ["active", "connecting"].includes(statuses[runtimeId]?.type);

      if (wasActive) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("stop_tunnel", { id: runtimeId });
        } catch (_) {}
      }

      updateTunnel(selectedId, tunnelConfig);

      if (wasActive) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const newId = await invoke("start_tunnel", { config: tunnelConfig });
          setRunningId(selectedId, newId);
          toast.success("Tunnel updated and restarted");
        } catch (e) {
          toast.error(`Tunnel updated but failed to restart: ${e}`);
        }
      } else {
        toast.success("Tunnel updated");
      }
    } else {
      addTunnel(tunnelConfig);
      toast.success("Tunnel added");
    }
    setFormOpen(false);
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("test_connection", {
        config: {
          ...config,
          ssh_port: Number(config.ssh_port),
          local_port: Number(config.local_port),
          remote_port: Number(config.remote_port),
          password: config.auth_method === "password" ? config.password : undefined,
          private_key_path: config.auth_method === "private_key" ? config.private_key_path : undefined,
        },
      });
      toast.success("Connection successful!");
    } catch (e) {
      toast.error(`Connection failed: ${e}`);
    } finally {
      setTesting(false);
    }
  }

  async function handleBrowseKey() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({
        multiple: false,
        title: "Select Private Key",
      });
      if (file) {
        handleChange("private_key_path", file);
      }
    } catch (e) {
      console.error("File picker error:", e);
    }
  }

  return (
    <Dialog open={formOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Tunnel" : "Add Tunnel"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={config.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="My Tunnel" />
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <textarea
              value={config.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Optional notes about this tunnel..."
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>SSH Host</Label>
              <Input value={config.ssh_host} onChange={(e) => handleChange("ssh_host", e.target.value)} placeholder="example.com" />
            </div>
            <div>
              <Label>Port</Label>
              <Input type="number" value={config.ssh_port} onChange={(e) => handleChange("ssh_port", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Username</Label>
            <Input value={config.ssh_username} onChange={(e) => handleChange("ssh_username", e.target.value)} placeholder="root" />
          </div>

          <div className="grid gap-2">
            <Label>Auth Method</Label>
            <Select value={config.auth_method} onValueChange={(v) => handleChange("auth_method", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="private_key">Private Key</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.auth_method === "password" && (
            <div className="grid gap-2">
              <Label>Password</Label>
              <Input type="password" value={config.password} onChange={(e) => handleChange("password", e.target.value)} />
            </div>
          )}

          {config.auth_method === "private_key" && (
            <div className="grid gap-2">
              <Label>Private Key</Label>
              <div className="flex gap-2">
                <Input value={config.private_key_path} onChange={(e) => handleChange("private_key_path", e.target.value)} placeholder="/path/to/key" className="flex-1" />
                <Button variant="outline" size="sm" onClick={handleBrowseKey}>Browse</Button>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Direction</Label>
            <Select value={config.forwarding_direction} onValueChange={(v) => handleChange("forwarding_direction", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Forward (-L)</SelectItem>
                <SelectItem value="remote">Remote Forward (-R)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Local Port</Label>
              <Input type="number" value={config.local_port} onChange={(e) => handleChange("local_port", e.target.value)} />
            </div>
            <div>
              <Label>Remote Host</Label>
              <Input value={config.remote_host} onChange={(e) => handleChange("remote_host", e.target.value)} placeholder="127.0.0.1" />
            </div>
            <div>
              <Label>Remote Port</Label>
              <Input type="number" value={config.remote_port} onChange={(e) => handleChange("remote_port", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto_start"
              checked={!!config.auto_start}
              onChange={(e) => handleChange("auto_start", e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="auto_start">Start on app launch</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button onClick={handleSave}>
            {isEditing ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
