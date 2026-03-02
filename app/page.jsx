"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./components/Sidebar";
import { TunnelCard } from "./components/TunnelCard";
import { TunnelForm } from "./components/TunnelForm";
import { useTunnelStore } from "./store/tunnelStore";
import { useTunnelEvents } from "./hooks/useTunnelEvents";

export default function Home() {
  const loadTunnels = useTunnelStore((s) => s.loadTunnels);

  useEffect(() => {
    loadTunnels();
  }, [loadTunnels]);

  useTunnelEvents();

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <TunnelCard />
      </div>
      <TunnelForm />
      <Toaster theme="dark" position="bottom-right" />
    </TooltipProvider>
  );
}
