"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { InspectorEvent } from "@/hooks/useWorkflow";
import { CodeBlock } from "./CodeBlock";

interface Props {
  events: InspectorEvent[];
  currentStep: number;
}

export function InspectorPanel({ events, currentStep }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--inspector-border)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase text-[var(--inspector-text)]">
            T3N Enclave Inspector
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--inspector-gray)]">
          <span>Step {currentStep}/4</span>
          <span>•</span>
          <span>TEE: Intel TDX</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--inspector-border)] text-[10px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> System</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Agent Call</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Received</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> TEE Internal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Placeholder</span>
      </div>

      {/* Events Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-2">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--inspector-gray)] text-center">
            <div className="text-3xl mb-3">🔒</div>
            <p className="text-sm">Waiting for workflow...</p>
            <p className="text-[10px] mt-1">Events will stream here in real-time</p>
          </div>
        )}

        <AnimatePresence>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <EventCard event={event} />
            </motion.div>
          ))}
        </AnimatePresence>

        {events.length > 0 && (
          <div className="typewriter-cursor text-[var(--inspector-gray)] text-[10px] pt-1" />
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: InspectorEvent }) {
  const borderColor = getBorderColor(event.type, event.highlight);
  const icon = getIcon(event.type);
  const labelColor = getLabelColor(event.highlight);

  return (
    <div className={`rounded border-l-2 ${borderColor} bg-[#161b22] px-3 py-2`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">{icon}</span>
        <span className={`text-[11px] font-semibold ${labelColor}`}>{event.title}</span>
        <span className="text-[9px] text-[var(--inspector-gray)] ml-auto">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <CodeBlock content={event.content} highlight={event.highlight} type={event.type} />
    </div>
  );
}

function getBorderColor(type: string, highlight?: string): string {
  if (highlight === "red") return "border-red-500";
  if (highlight === "green") return "border-green-500";
  if (highlight === "yellow") return "border-yellow-500";
  if (highlight === "blue") return "border-blue-500";
  if (highlight === "gray") return "border-gray-600";
  switch (type) {
    case "cross_tenant": return "border-yellow-500";
    case "tee_simulated": return "border-gray-600";
    case "agent_received": return "border-green-500";
    case "error": return "border-red-500";
    default: return "border-blue-500";
  }
}

function getIcon(type: string): string {
  switch (type) {
    case "system": return "⚙️";
    case "agent_action": return "🤖";
    case "agent_received": return "📥";
    case "tee_simulated": return "🔒";
    case "placeholder_before": return "📤";
    case "placeholder_after": return "✅";
    case "cross_tenant": return "🔗";
    case "audit_log": return "📋";
    case "error": return "❌";
    default: return "•";
  }
}

function getLabelColor(highlight?: string): string {
  switch (highlight) {
    case "red": return "text-red-400";
    case "green": return "text-green-400";
    case "yellow": return "text-yellow-400";
    case "blue": return "text-blue-400";
    case "gray": return "text-gray-400";
    default: return "text-[var(--inspector-text)]";
  }
}
