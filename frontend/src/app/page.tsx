"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConsumerApp } from "@/components/ConsumerApp";
import { InspectorDrawer } from "@/components/InspectorDrawer";
import { useWorkflow } from "@/hooks/useWorkflow";

export default function Home() {
  const workflow = useWorkflow();
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Full-width Consumer App */}
      <ConsumerApp workflow={workflow} onToggleInspector={() => setInspectorOpen(!inspectorOpen)} inspectorOpen={inspectorOpen} />

      {/* Inspector Drawer (overlay from right) */}
      <InspectorDrawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        events={workflow.events}
        currentStep={workflow.step}
      />

      {/* Floating Inspector toggle (always visible) */}
      {!inspectorOpen && workflow.events.length > 0 && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setInspectorOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 bg-[#0d1117] text-green-400 rounded-full shadow-lg shadow-black/20 border border-[#21262d] hover:border-green-500/50 transition-colors text-xs font-mono z-40"
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>{workflow.events.length} events</span>
          <span className="text-[var(--inspector-gray)]">• Open Inspector</span>
        </motion.button>
      )}
    </div>
  );
}
