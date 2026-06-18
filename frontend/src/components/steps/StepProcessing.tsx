"use client";

import { motion } from "framer-motion";

interface Props {
  step: number;
  isLoading: boolean;
  eligibility: { score: number; tier: string; max_loan_amount: number; approved: boolean } | null;
  fraudResult: { is_flagged: boolean; risk_level: string } | null;
}

export function StepProcessing({ step, isLoading, eligibility, fraudResult }: Props) {
  return (
    <div className="max-w-md mx-auto pt-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {step === 1 ? "Connecting to T3N..." : "Assessing Your Profile"}
        </h2>
        <p className="text-sm text-slate-500">
          {step === 1
            ? "Establishing secure enclave connection"
            : "Your data is processed inside the hardware enclave"}
        </p>
      </div>

      {/* Processing cards */}
      <div className="space-y-4">
        <ProcessingCard
          label="Secure Connection"
          status={step >= 1 ? "done" : "pending"}
          detail="Post-quantum encrypted channel"
        />
        <ProcessingCard
          label="Agent Authorization"
          status={step >= 2 ? "done" : step === 1 ? "active" : "pending"}
          detail="agent-auth-update with scoped permissions"
        />
        <ProcessingCard
          label="Industry Fraud Screening"
          status={fraudResult ? (fraudResult.is_flagged ? "error" : "done") : step === 2 ? "active" : "pending"}
          detail={fraudResult
            ? fraudResult.is_flagged
              ? `⚠️ FLAGGED — Risk: ${fraudResult.risk_level}`
              : `Risk: ${fraudResult.risk_level} — Not flagged ✓`
            : "Cross-tenant blacklist check"}
        />
        <ProcessingCard
          label="Credit Assessment"
          status={eligibility ? (eligibility.tier === "rejected" ? "error" : "done") : step === 2 && fraudResult ? "active" : "pending"}
          detail={eligibility
            ? eligibility.tier === "rejected"
              ? "Rejected — Fraud flag blocked assessment"
              : `Score: ${eligibility.score} (${eligibility.tier.toUpperCase()})`
            : "Computing inside TEE enclave"}
        />
      </div>

      {/* Score display */}
      {eligibility && eligibility.tier !== "rejected" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-center"
        >
          <div className="text-4xl font-bold text-green-700 mb-1">{eligibility.score}</div>
          <div className="text-sm text-green-600 font-medium">Credit Score ({eligibility.tier.toUpperCase()} Tier)</div>
          <div className="text-xs text-green-500 mt-1">Max Loan: ${eligibility.max_loan_amount.toLocaleString()}</div>
          <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-green-100 rounded-full text-[10px] text-green-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Computed inside TEE — Agent saw only this score
          </div>
        </motion.div>
      )}

      {/* Rejected display */}
      {eligibility && eligibility.tier === "rejected" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 text-center"
        >
          <div className="text-4xl mb-2">🚫</div>
          <div className="text-lg font-bold text-red-700 mb-1">Application Rejected</div>
          <div className="text-sm text-red-600">User flagged in cross-tenant fraud blacklist</div>
          <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-red-100 rounded-full text-[10px] text-red-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Consortium shared signal only — reason is private
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ProcessingCard({ label, status, detail }: { label: string; status: "pending" | "active" | "done" | "error"; detail: string }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      status === "done" ? "bg-green-50 border-green-200" :
      status === "error" ? "bg-red-50 border-red-200" :
      status === "active" ? "bg-blue-50 border-blue-200 glow-pulse" :
      "bg-slate-50 border-slate-100"
    }`}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center">
        {status === "done" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-600 text-lg">✓</motion.div>
        )}
        {status === "error" && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-red-600 text-lg">✗</motion.div>
        )}
        {status === "active" && (
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
        {status === "pending" && (
          <div className="w-3 h-3 rounded-full bg-slate-200" />
        )}
      </div>
      <div className="flex-1">
        <div className={`text-sm font-medium ${
          status === "done" ? "text-green-800" :
          status === "error" ? "text-red-800" :
          status === "active" ? "text-blue-800" :
          "text-slate-400"
        }`}>
          {label}
        </div>
        <div className={`text-[11px] ${
          status === "done" ? "text-green-600" :
          status === "error" ? "text-red-600" :
          status === "active" ? "text-blue-500" :
          "text-slate-400"
        }`}>
          {detail}
        </div>
      </div>
    </div>
  );
}
