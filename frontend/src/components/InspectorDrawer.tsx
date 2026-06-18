"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { InspectorEvent } from "@/hooks/useWorkflow";
import { InspectorPanel } from "./InspectorPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  events: InspectorEvent[];
  currentStep: number;
}

export function InspectorDrawer({ open, onClose, events, currentStep }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[480px] max-w-[90vw] inspector-panel z-50 shadow-2xl shadow-black/40 border-l border-[var(--inspector-border)]"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md hover:bg-[#21262d] text-[var(--inspector-gray)] hover:text-white transition-colors z-10"
            >
              ✕
            </button>

            <InspectorPanel events={events} currentStep={currentStep} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
