"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { InspectorEvent } from "@/hooks/useWorkflow";

interface Props {
  events: InspectorEvent[];
  currentStep: number;
}

export function InspectorPanel({ events, currentStep }: Props) {
  const agentScrollRef = useRef<HTMLDivElement>(null);
  const teeScrollRef = useRef<HTMLDivElement>(null);

  const agentEvents = events.filter(
    (e) => e.type === "agent_action" || e.type === "agent_received" || e.type === "system" || e.type === "placeholder_before" || e.type === "audit_log" || e.type === "error"
  );
  const teeEvents = events.filter(
    (e) => e.type === "tee_simulated" || e.type === "cross_tenant" || e.type === "placeholder_after"
  );

  useEffect(() => {
    if (agentScrollRef.current) agentScrollRef.current.scrollTop = agentScrollRef.current.scrollHeight;
    if (teeScrollRef.current) teeScrollRef.current.scrollTop = teeScrollRef.current.scrollHeight;
  }, [events]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--inspector-border)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase text-[var(--inspector-text)]">
            🔍 T3N Data Exposure Dashboard
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--inspector-gray)]">
          <span>Step {currentStep}/4</span>
          <span>•</span>
          <span>TEE: Intel TDX</span>
        </div>
      </div>

      {/* Dual-Panel Grid */}
      <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        {/* LEFT: Agent View */}
        <div className="flex flex-col border-r border-[var(--inspector-border)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--inspector-border)] bg-[#1c2028]">
            <div className="flex items-center gap-2">
              <span className="text-xs">🤖</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Agent Memory
              </span>
            </div>
            <p className="text-[9px] text-gray-500 mt-0.5">Restricted — No PII access</p>
          </div>
          <div ref={agentScrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-1.5 bg-[#13161b]">
            {agentEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 text-center">
                <span className="text-2xl mb-2">🤖</span>
                <p className="text-[10px]">Agent is idle</p>
              </div>
            )}
            <AnimatePresence>
              {agentEvents.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AgentEventCard event={event} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT: TEE Enclave View */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--inspector-border)] bg-[#0a1628]">
            <div className="flex items-center gap-2">
              <span className="text-xs">🛡️</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                Intel TDX Secure Enclave
              </span>
            </div>
            <p className="text-[9px] text-emerald-600 mt-0.5">Hardware-isolated • Full data access</p>
          </div>
          <div ref={teeScrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-1.5 bg-[#050d1a]">
            {teeEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-blue-900 text-center">
                <span className="text-2xl mb-2">🔒</span>
                <p className="text-[10px] text-blue-700">Enclave standby</p>
              </div>
            )}
            <AnimatePresence>
              {teeEvents.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <TeeEventCard event={event} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--inspector-border)] text-[9px] text-[var(--inspector-gray)]">
        <span>🤖 Agent sees: scores, tiers, offers only</span>
        <span>🛡️ TEE sees: income, debt, PII, computations</span>
      </div>
    </div>
  );
}

function AgentEventCard({ event }: { event: InspectorEvent }) {
  const isError = event.type === "error" || event.highlight === "red";
  return (
    <div className={`rounded px-2 py-1.5 border-l-2 ${
      isError ? "border-red-500 bg-red-950/30" :
      event.highlight === "green" ? "border-green-600 bg-green-950/20" :
      event.highlight === "yellow" ? "border-yellow-600 bg-yellow-950/10" :
      "border-gray-600 bg-[#1a1e25]"
    }`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px]">{getAgentIcon(event)}</span>
        <span className={`text-[10px] font-semibold ${isError ? "text-red-400" : "text-gray-300"}`}>
          {event.title}
        </span>
      </div>
      <pre className={`text-[10px] whitespace-pre-wrap break-words leading-relaxed ${
        isError ? "text-red-300/80" :
        event.highlight === "green" ? "text-green-300/80" :
        "text-gray-400"
      }`}>
        {redactForAgent(event)}
      </pre>
    </div>
  );
}

function TeeEventCard({ event }: { event: InspectorEvent }) {
  return (
    <div className={`rounded px-2 py-1.5 border-l-2 ${
      event.type === "placeholder_after" ? "border-green-500 bg-green-950/20" :
      event.type === "cross_tenant" ? "border-yellow-500 bg-yellow-950/10" :
      "border-blue-600 bg-blue-950/20"
    }`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px]">{getTeeIcon(event)}</span>
        <span className={`text-[10px] font-semibold ${
          event.type === "placeholder_after" ? "text-green-400" :
          event.type === "cross_tenant" ? "text-yellow-400" :
          "text-blue-400"
        }`}>
          {event.title}
        </span>
      </div>
      <TypewriterText content={event.content} className={`text-[10px] whitespace-pre-wrap break-words leading-relaxed ${
        event.type === "placeholder_after" ? "text-green-300/90" : "text-emerald-300/80"
      }`} />
    </div>
  );
}

const typedContentCache = new Set<string>();

function TypewriterText({ content, className }: { content: string; className: string }) {
  const alreadyTyped = typedContentCache.has(content);
  const [displayText, setDisplayText] = useState(alreadyTyped ? content : "");
  const [done, setDone] = useState(alreadyTyped);

  useEffect(() => {
    if (alreadyTyped) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= content.length) {
        setDisplayText(content);
        setDone(true);
        typedContentCache.add(content);
        clearInterval(interval);
      } else {
        setDisplayText(content.slice(0, i));
      }
    }, 12);
    return () => clearInterval(interval);
  }, [content, alreadyTyped]);

  return (
    <pre className={className}>
      {displayText}
      {!done && <span className="animate-pulse text-green-400">▊</span>}
    </pre>
  );
}

function redactForAgent(event: InspectorEvent): string {
  const content = event.content;
  if (event.type === "placeholder_before") {
    return content;
  }
  if (event.highlight === "green" && event.type === "agent_received") {
    return content;
  }
  return content;
}

function getAgentIcon(event: InspectorEvent): string {
  if (event.type === "error") return "❌";
  if (event.type === "agent_received") return "📥";
  if (event.type === "agent_action") return "📤";
  if (event.type === "placeholder_before") return "🔴";
  if (event.type === "audit_log") return "📋";
  return "⚙️";
}

function getTeeIcon(event: InspectorEvent): string {
  if (event.type === "cross_tenant") return "🔗";
  if (event.type === "placeholder_after") return "✅";
  return "🔐";
}
