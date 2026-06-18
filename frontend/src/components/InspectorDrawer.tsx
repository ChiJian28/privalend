"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { InspectorEvent } from "@/hooks/useWorkflow";
import { InspectorPanel } from "./InspectorPanel";
import { MaliciousOverlay } from "./MaliciousMode";

interface Props {
  open: boolean;
  onClose: () => void;
  events: InspectorEvent[];
  currentStep: number;
  maliciousMode: boolean;
  onMaliciousComplete: () => void;
}

export function InspectorDrawer({ open, onClose, events, currentStep, maliciousMode, onMaliciousComplete }: Props) {
  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Drawer — always mounted, only translated off-screen when closed */}
      <div
        className={`fixed top-0 right-0 h-full w-[560px] max-w-[90vw] inspector-panel z-50 shadow-2xl shadow-black/40 border-l transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        } ${maliciousMode ? "border-red-500 shadow-red-900/30" : "border-[var(--inspector-border)]"}`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#21262d] text-[var(--inspector-gray)] hover:text-white transition-colors z-[60]"
        >
          ✕
        </button>

        {/* Normal Panel — always rendered, hidden when malicious */}
        <div className={maliciousMode ? "hidden" : "h-full"}>
          <InspectorPanel events={events} currentStep={currentStep} />
        </div>

        {/* Malicious Mode Overlay */}
        {maliciousMode && (
          <MaliciousOverlay active={maliciousMode} onComplete={onMaliciousComplete} />
        )}
      </div>
    </>
  );
}
