"use client";

import { motion } from "framer-motion";

interface Props {
  result: { status: string; reference: string; lender: string } | null;
}

export function StepSuccess({ result }: Props) {
  if (!result) return null;

  return (
    <div className="max-w-md mx-auto pt-8 text-center">
      {/* Confetti-like animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-200"
      >
        <span className="text-4xl">🎉</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Approved!</h2>
        <p className="text-sm text-slate-500 mb-6">
          Your loan with {result.lender} has been submitted successfully.
        </p>
      </motion.div>

      {/* Approval card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-left mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-slate-500">Reference Number</span>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            {result.status.toUpperCase()}
          </span>
        </div>
        <div className="text-xl font-mono font-bold text-slate-900 mb-4">{result.reference}</div>

        <div className="space-y-2">
          <DetailRow label="Lender" value={result.lender} />
          <DetailRow label="Amount" value="$50,000" />
          <DetailRow label="Rate" value="4.30% APR" />
          <DetailRow label="Term" value="36 months" />
        </div>
      </motion.div>

      {/* Privacy highlight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="p-5 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100"
      >
        <h3 className="text-sm font-semibold text-blue-900 mb-3">Privacy Report</h3>
        <div className="grid grid-cols-2 gap-3 text-left">
          <PrivacyStat label="Data Exposed to Agent" value="0 bytes" good />
          <PrivacyStat label="PII Fields Resolved" value="5 fields" good />
          <PrivacyStat label="Cross-Tenant Calls" value="1 (Fraud Check)" good />
          <PrivacyStat label="Audit Trail" value="Merkle-sealed" good />
        </div>
      </motion.div>

      <p className="text-[10px] text-slate-400 mt-6">
        The entire application was processed without the AI agent ever accessing your name, ID number, or financial data.
        All PII was resolved inside the TEE at the final moment of submission.
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function PrivacyStat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${good ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
        {good ? "✓" : "✗"}
      </span>
      <div>
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-xs font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
