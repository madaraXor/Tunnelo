"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";

export function LogPanel({ logs = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
        Logs ({logs.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-md bg-black/30 p-3 font-mono text-xs text-muted-foreground space-y-1 max-h-32 overflow-auto">
          {logs.length === 0 && <p>No logs yet.</p>}
          {logs.map((log, i) => (
            <p key={i}>{log}</p>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
