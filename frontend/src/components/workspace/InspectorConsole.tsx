"use client";

import type { InspectorEvent } from "@/hooks/useWorkflow";
import { InspectorPanel } from "../InspectorPanel";
import { MaliciousOverlay } from "../MaliciousMode";

interface Props {
  events: InspectorEvent[];
  currentStep: number;
  maliciousMode: boolean;
  onMaliciousComplete: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function InspectorConsole({
  events, currentStep, maliciousMode, onMaliciousComplete, collapsed, onToggleCollapse,
}: Props) {
  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {/* Tab bar — VS Code terminal style */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-slate-800 hover:bg-slate-900/60 transition select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
            🔍 T3N Data Exposure Dashboard
          </span>
          <span className="text-[9px] text-slate-600 shrink-0">{events.length} events</span>
          {collapsed && events.length > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-500 border border-green-800/40">
              click to open
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-slate-600 hidden sm:inline">Agent vs TEE</span>
          <span className="text-slate-500 text-[10px] w-4 text-center" title={collapsed ? "Expand panel" : "Collapse panel"}>
            {collapsed ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {!collapsed && (
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div className={`absolute inset-0 ${maliciousMode ? "hidden" : ""}`}>
            <InspectorPanel events={events} currentStep={currentStep} hideHeader />
          </div>
          {maliciousMode && (
            <MaliciousOverlay active={maliciousMode} onComplete={onMaliciousComplete} />
          )}
        </div>
      )}
    </div>
  );
}
