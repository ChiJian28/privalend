"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LoanOffer } from "@/hooks/useWorkflow";
import { CreditCredentialCard } from "../CreditCredentialCard";
import type { CredentialIssueResult } from "@/lib/credential";

interface OffersProps {
  offers: LoanOffer[];
  onSelect: (id: string) => void;
  isLoading: boolean;
}

export function CanvasOffersPanel({ offers, onSelect, isLoading }: OffersProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute right-4 top-4 bottom-4 w-72 flex flex-col gap-2 overflow-y-auto scrollbar-thin z-20"
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">
        Loan Offers — Select to Apply
      </div>
      {offers.map((o, i) => (
        <button
          key={o.id}
          onClick={() => onSelect(o.id)}
          disabled={isLoading}
          className={`text-left p-3 rounded-xl border backdrop-blur-md transition disabled:opacity-50 ${
            i === 0
              ? "bg-blue-950/80 border-blue-600/50 hover:border-blue-400"
              : "bg-slate-900/80 border-slate-700 hover:border-slate-500"
          }`}
        >
          {i === 0 && <span className="text-[8px] text-blue-400 font-bold">BEST RATE</span>}
          <div className="text-sm font-semibold text-white">{o.lender}</div>
          <div className="text-xl font-bold text-blue-400">{o.interest_rate}%</div>
          <div className="text-[10px] text-slate-400">${o.monthly_payment}/mo × {o.term_months}</div>
          <div className="mt-2 text-[10px] text-green-400 font-medium">
            {isLoading ? "Submitting via TEE..." : "Apply →"}
          </div>
        </button>
      ))}
      <p className="text-[9px] text-slate-500 px-1">
        Agent sends {"{{profile.name}}"} — TEE resolves before Lender receives data.
      </p>
    </motion.div>
  );
}

interface RejectionProps {
  riskLevel?: string;
  onReset: () => void;
}

export function CanvasRejectionPanel({ riskLevel, onReset }: RejectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-4 flex items-center justify-center z-20 pointer-events-none"
    >
      <div className="pointer-events-auto max-w-sm w-full rounded-2xl bg-slate-900/95 border border-red-700/50 shadow-[0_0_40px_rgba(239,68,68,0.15)] backdrop-blur-md p-6 text-center">
        <span className="text-4xl mb-3 block">⛔</span>
        <h3 className="text-red-400 font-bold text-lg mb-2">Application Rejected</h3>
        <p className="text-slate-400 text-xs leading-relaxed mb-1">
          Cross-tenant fraud screening detected high-risk signals.
        </p>
        <p className="text-slate-500 text-[10px] leading-relaxed mb-4">
          Agent execution terminated by consortium policy.
          {riskLevel ? ` Risk level: ${riskLevel}.` : ""}
          <br />
          The consortium shares only a boolean flag — not why the user was flagged.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="w-full py-2.5 rounded-lg bg-red-950/80 border border-red-700 text-red-300 text-xs font-semibold hover:bg-red-900/80 transition"
        >
          ↺ Try Another Persona
        </button>
      </div>
    </motion.div>
  );
}

type SuccessUiState = "open" | "minimized" | "closed";

interface SuccessProps {
  result: { status: string; reference: string; lender: string };
  credential: CredentialIssueResult | null;
}

export function CanvasSuccessPanel({ result, credential }: SuccessProps) {
  const [uiState, setUiState] = useState<SuccessUiState>("open");

  useEffect(() => {
    setUiState("open");
  }, [result.reference]);

  return (
    <>
      {/* Minimized pill — top-right of canvas */}
      <AnimatePresence>
        {uiState === "minimized" && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            onClick={() => setUiState("open")}
            className="absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/95 border border-green-700/50 shadow-lg shadow-green-900/20 hover:border-green-500/60 hover:bg-slate-800/95 transition backdrop-blur-md"
          >
            <span className="text-base">🏆</span>
            <span className="text-[11px] font-semibold text-green-300">Application Approved</span>
            <span className="text-[9px] text-slate-500 hidden sm:inline">{result.lender}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Full panel */}
      <AnimatePresence>
        {uiState === "open" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-4 flex items-center justify-center z-20 pointer-events-none"
          >
            <div className="pointer-events-auto relative max-w-sm w-full rounded-2xl bg-slate-900/95 border border-green-700/40 shadow-[0_0_40px_rgba(34,197,94,0.15)] backdrop-blur-md overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">🏆</span>
                  <span className="text-xs font-semibold text-white truncate">Application Approved</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <WindowBtn label="Minimize" onClick={() => setUiState("minimized")}>−</WindowBtn>
                  <WindowBtn label="Close" onClick={() => setUiState("closed")} danger>×</WindowBtn>
                </div>
              </div>

              <div className="p-5 pt-4">
                <div className="text-center mb-4">
                  <p className="text-xs text-slate-400">{result.lender} · {result.reference}</p>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 text-[10px] font-medium border border-green-800/50">
                    {result.status.toUpperCase()}
                  </span>
                </div>
                {credential && (
                  <div className="scale-90 origin-top">
                    <CreditCredentialCard credentialResult={credential} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function WindowBtn({
  children, label, onClick, danger,
}: {
  children: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-sm font-medium transition ${
        danger
          ? "text-slate-400 hover:bg-red-950/80 hover:text-red-400"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}
