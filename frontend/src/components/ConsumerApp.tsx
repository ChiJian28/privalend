"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { WorkflowState } from "@/hooks/useWorkflow";
import { StepOnboarding } from "./steps/StepOnboarding";
import { StepProcessing } from "./steps/StepProcessing";
import { StepOffers } from "./steps/StepOffers";
import { StepSuccess } from "./steps/StepSuccess";
import { MaliciousButton } from "./MaliciousMode";

interface Props {
  workflow: WorkflowState;
  onToggleInspector: () => void;
  inspectorOpen: boolean;
  maliciousMode: boolean;
  onTriggerMalicious: () => void;
}

export function ConsumerApp({ workflow, onToggleInspector, inspectorOpen, maliciousMode, onTriggerMalicious }: Props) {
  return (
    <div className={`flex flex-col h-full transition-all duration-500 ${
      maliciousMode ? "ring-4 ring-red-500/60 ring-inset" : ""
    }`}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">PL</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">PrivaLend</h1>
            <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
              Powered by Terminal 3 Network
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                workflow.connected
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${workflow.connected ? "bg-green-500" : "bg-amber-500"}`} />
                {workflow.connected ? "Live" : "Demo"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StepIndicator current={workflow.step} />

          {/* Malicious Mode Button */}
          {workflow.step >= 1 && !maliciousMode && (
            <MaliciousButton onTrigger={onTriggerMalicious} />
          )}

          {workflow.step > 0 && (
            <button
              onClick={workflow.reset}
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition"
            >
              Reset
            </button>
          )}
          <button
            onClick={onToggleInspector}
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition ${
              inspectorOpen
                ? "bg-[#0d1117] text-green-400 border-green-500/50"
                : "text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${inspectorOpen ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
            {inspectorOpen ? "Inspector" : "🔒 TEE Inspector"}
          </button>
        </div>
      </header>

      {/* Malicious Mode Warning Banner */}
      <AnimatePresence>
        {maliciousMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white px-8 py-2 text-center overflow-hidden"
          >
            <p className="text-xs font-medium">
              ⚠️ ROGUE AGENT SIMULATION ACTIVE — Demonstrating T3N security when an agent is compromised
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <AnimatePresence mode="wait">
          {workflow.step === 0 && (
            <FadeIn key="step0">
              <StepOnboarding onStart={(opts) => workflow.startWorkflow(opts)} />
            </FadeIn>
          )}
          {(workflow.step === 1 || workflow.step === 2) && (
            <FadeIn key="step12">
              <StepProcessing step={workflow.step} isLoading={workflow.isLoading} eligibility={workflow.eligibility} fraudResult={workflow.fraudResult} />
            </FadeIn>
          )}
          {workflow.step === 3 && (
            <FadeIn key="step3">
              <StepOffers offers={workflow.offers} onSelect={workflow.selectOffer} isLoading={workflow.isLoading} />
            </FadeIn>
          )}
          {workflow.step === 4 && (
            <FadeIn key="step4">
              <StepSuccess result={workflow.applicationResult} eligibility={workflow.eligibility} />
            </FadeIn>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  const steps = ["Connect", "Verify", "Offers", "Done"];
  return (
    <div className="flex items-center gap-1">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
            i + 1 <= current
              ? "bg-blue-600 text-white"
              : i + 1 === current + 1
                ? "bg-blue-100 text-blue-600 border border-blue-300"
                : "bg-slate-100 text-slate-400"
          }`}>
            {i + 1 <= current ? "✓" : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-4 h-px ${i + 1 < current ? "bg-blue-600" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}
