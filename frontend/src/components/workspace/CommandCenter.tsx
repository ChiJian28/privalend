"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StartOptions, UserProfile, WorkflowState, LoanOffer } from "@/hooks/useWorkflow";
import { PHASE_STATUS, type ChoreographyPhase } from "@/lib/graph-choreography";
import { AuditTrailButton } from "../AuditTrail";

const NATIONALITIES = [
  { value: "US", label: "United States" },
  { value: "SG", label: "Singapore" },
  { value: "UK", label: "United Kingdom" },
  { value: "JP", label: "Japan" },
  { value: "DE", label: "Germany" },
  { value: "AU", label: "Australia" },
  { value: "CN", label: "China" },
  { value: "IN", label: "India" },
] as const;

const PERSONAS = [
  {
    id: "alice" as const,
    emoji: "🧑‍💼",
    name: "Alice",
    detail: "$150K · Low debt",
    accent: "emerald",
    selectedBg: "bg-emerald-950/70",
    selectedBorder: "border-emerald-400",
    selectedRing: "ring-emerald-500/60",
    selectedGlow: "shadow-[0_0_20px_rgba(52,211,153,0.25)]",
    idleBorder: "border-emerald-800/40 hover:border-emerald-600/60",
  },
  {
    id: "bob" as const,
    emoji: "👨‍🔧",
    name: "Bob",
    detail: "Blacklisted",
    accent: "red",
    selectedBg: "bg-red-950/70",
    selectedBorder: "border-red-400",
    selectedRing: "ring-red-500/60",
    selectedGlow: "shadow-[0_0_20px_rgba(248,113,113,0.25)]",
    idleBorder: "border-red-800/40 hover:border-red-600/60",
  },
  {
    id: "charlie" as const,
    emoji: "👩‍🎓",
    name: "Charlie",
    detail: "$52K · Student",
    accent: "amber",
    selectedBg: "bg-amber-950/70",
    selectedBorder: "border-amber-400",
    selectedRing: "ring-amber-500/60",
    selectedGlow: "shadow-[0_0_20px_rgba(251,191,36,0.25)]",
    idleBorder: "border-amber-800/40 hover:border-amber-600/60",
  },
];

interface Props {
  workflow: WorkflowState;
  phase: ChoreographyPhase;
  selectedPersona: "alice" | "bob" | "charlie" | "custom" | null;
  onSelectPersona: (p: "alice" | "bob" | "charlie" | "custom" | null) => void;
  onExecute: (opts?: StartOptions) => void;
  onAttack: () => void;
  attackDisabled: boolean;
}

export function CommandCenter({
  workflow, phase, selectedPersona, onSelectPersona, onExecute, onAttack, attackDisabled,
}: Props) {
  const [tab, setTab] = useState<"quick" | "custom">("quick");
  const [income, setIncome] = useState("85000");
  const [debt, setDebt] = useState("12000");
  const [nationality, setNationality] = useState("SG");

  const rejected = workflow.fraudResult?.is_flagged === true && workflow.step >= 2;
  const showOffers = workflow.step === 3 && workflow.offers.length > 0 && !rejected;
  const showPersona = !showOffers && workflow.step < 4 && !rejected;
  const canExecute = workflow.step === 0 && !workflow.isLoading && selectedPersona !== null;
  const busy = workflow.isLoading || (workflow.step > 0 && !rejected);

  const handleExecute = () => {
    if (!selectedPersona) return;
    if (selectedPersona === "custom") {
      const profile: UserProfile = {
        annual_income: parseFloat(income) || 85000,
        total_debt: parseFloat(debt) || 0,
        nationality,
      };
      onExecute({ profile });
    } else {
      onExecute({ persona: selectedPersona });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-r border-slate-800 text-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold">PL</div>
          <div>
            <h1 className="text-sm font-bold text-white">PrivaLend</h1>
            <p className="text-[9px] text-slate-500 flex items-center gap-1">
              T3N Workspace
              <span className={`px-1 py-0.5 rounded text-[8px] ${workflow.connected ? "bg-green-900/50 text-green-400" : "bg-amber-900/50 text-amber-400"}`}>
                {workflow.connected ? "LIVE" : "DEMO"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* User terminal — persona picker or offer selection */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
        <AnimatePresence mode="wait">
          {showOffers ? (
            <motion.div
              key="offers"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">User Client</p>
                <h3 className="text-sm font-bold text-white mt-1">Select an Offer</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                  Authorize Agent to submit via TEE — watch the infra graph on the right.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {workflow.offers.map((offer, i) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    isBest={i === 0}
                    isSubmitting={workflow.submittingOfferId === offer.id}
                    isBusy={workflow.isApplying}
                    onApply={() => workflow.selectOffer(offer.id)}
                  />
                ))}
              </div>

              <p className="text-[9px] text-slate-600 leading-relaxed px-0.5">
                Agent sends {"{{profile.*}}"} placeholders only. TEE resolves PII before Lender receives data.
              </p>
            </motion.div>
          ) : showPersona ? (
            <motion.div
              key="persona"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Persona</p>

        <div className="flex gap-1 p-0.5 bg-slate-900 rounded-lg">
          {(["quick", "custom"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                if (t === "custom") onSelectPersona("custom");
                else if (selectedPersona === "custom") onSelectPersona(null);
              }}
              className={`flex-1 py-1.5 text-[10px] rounded-md transition font-medium ${
                tab === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "quick" ? "Quick" : "Custom"}
            </button>
          ))}
        </div>

        {tab === "quick" && (
          <div className="space-y-2">
            {PERSONAS.map((p) => {
              const isSelected = selectedPersona === p.id;
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  layout
                  onClick={() => onSelectPersona(p.id)}
                  disabled={busy}
                  whileTap={{ scale: busy ? 1 : 0.98 }}
                  className={`relative w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 disabled:opacity-40 ${
                    isSelected
                      ? `${p.selectedBg} ${p.selectedBorder} ${p.selectedGlow} ring-2 ${p.selectedRing}`
                      : `bg-slate-900/40 ${p.idleBorder}`
                  }`}
                >
                  <span className={`text-xl shrink-0 ${isSelected ? "scale-110" : ""} transition-transform`}>
                    {p.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${isSelected ? "text-white" : "text-slate-200"}`}>
                      {p.name}
                    </div>
                    <div className={`text-[10px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      {p.detail}
                    </div>
                  </div>
                  {/* {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-lg"
                    >
                      ✓
                    </motion.span>
                  )} */}
                </motion.button>
              );
            })}
          </div>
        )}

        {tab === "custom" && (
          <div className={`space-y-2 text-[10px] p-3 rounded-xl border-2 transition-all ${
            selectedPersona === "custom"
              ? "bg-violet-950/50 border-violet-500 ring-2 ring-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
              : "border-slate-800 bg-slate-900/30"
          }`}>
            {selectedPersona === "custom" && (
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-violet-400">Custom Selected</span>
                <span className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px]">✓</span>
              </div>
            )}
            <Field label="Annual Income ($)" value={income} onChange={setIncome} active={selectedPersona === "custom"} />
            <Field label="Total Debt ($)" value={debt} onChange={setDebt} active={selectedPersona === "custom"} />
            <SelectField
              label="Nationality"
              value={nationality}
              onChange={setNationality}
              options={NATIONALITIES}
              active={selectedPersona === "custom"}
            />
          </div>
        )}

            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Status — always visible */}
        <div className={`p-2.5 rounded-lg border ${
          rejected ? "bg-red-950/40 border-red-800" : "bg-slate-900/80 border-slate-800"
        }`}>
          <p className="text-[9px] text-slate-500 uppercase mb-1">Status</p>
          <p className={`text-[11px] font-mono leading-snug ${
            rejected ? "text-red-400" : "text-blue-300"
          }`}>{PHASE_STATUS[phase]}</p>
          {rejected && workflow.fraudResult && (
            <p className="text-[10px] text-red-400/80 mt-1">
              Risk: {workflow.fraudResult.risk_level} — workflow frozen at step {workflow.step}
            </p>
          )}
          {workflow.eligibility && workflow.step >= 2 && !rejected && workflow.eligibility.tier !== "rejected" && (
            <p className="text-[10px] text-green-400 mt-1">Score: {workflow.eligibility.score} ({workflow.eligibility.tier})</p>
          )}
          {workflow.step === 4 && workflow.applicationResult && (
            <p className="text-[10px] text-green-400 mt-1">
              Approved · {workflow.applicationResult.lender}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <button
          onClick={handleExecute}
          disabled={!canExecute}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition"
        >
          {workflow.isLoading && workflow.step === 0 ? "Starting..." : "▶ Execute Agent Workflow"}
        </button>

        <button
          onClick={onAttack}
          disabled={attackDisabled || workflow.step === 0 || rejected}
          className="w-full py-2 rounded-lg border border-red-800 bg-red-950/50 text-red-400 text-[11px] font-medium disabled:opacity-30 hover:bg-red-950 transition"
        >
          😈 Simulate Rogue Attack
        </button>

        {workflow.step === 4 && workflow.applicationResult && (
          <AuditTrailButton data={{
            reference: workflow.applicationResult.reference,
            lender: workflow.applicationResult.lender,
            amount: 50000,
            term: 36,
            creditScore: workflow.eligibility?.score,
            tier: workflow.eligibility?.tier,
          }} />
        )}

        {rejected && (
          <button
            onClick={workflow.reset}
            className="w-full py-2.5 rounded-lg bg-red-950/80 border border-red-700 text-red-300 text-xs font-bold hover:bg-red-900/80 transition"
          >
            ↺ Try Another Persona
          </button>
        )}

        {workflow.step > 0 && !rejected && (
          <button onClick={workflow.reset} className="w-full py-1.5 text-[10px] text-slate-500 hover:text-slate-300">
            ↺ Reset Workspace
          </button>
        )}
      </div>
    </div>
  );
}

function OfferCard({
  offer, isBest, isSubmitting, isBusy, onApply,
}: {
  offer: LoanOffer;
  isBest: boolean;
  isSubmitting: boolean;
  isBusy: boolean;
  onApply: () => void;
}) {
  if (isBest) {
    return (
      <motion.div
        layout
        className="relative rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-950/50 via-blue-950/40 to-slate-900/60 p-3.5 shadow-[0_0_24px_rgba(251,191,36,0.18)] ring-1 ring-amber-400/30"
      >
        <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-[8px] font-black uppercase tracking-widest text-slate-900 shadow-md">
          ★ Best Rate
        </div>
        <div className="flex items-start justify-between gap-2 mt-1">
          <div className="min-w-0">
            <div className="font-bold text-white text-sm truncate">{offer.lender}</div>
            <div className="text-[10px] text-amber-200/70">
              ${offer.monthly_payment}/mo · {offer.term_months} mo
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black font-mono text-amber-300 leading-none">
              {offer.interest_rate}%
            </div>
            <div className="text-[8px] text-amber-400/80 uppercase tracking-wide">APR</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onApply}
          disabled={isBusy}
          className={`mt-3 w-full py-2 rounded-lg text-[11px] font-bold transition ${
            isSubmitting
              ? "bg-amber-600/80 text-white cursor-wait"
              : isBusy
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-900 hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-900/30"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-1.5">
              <span className="w-3 h-3 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              Submitting via TEE...
            </span>
          ) : "Apply Now →"}
        </button>
      </motion.div>
    );
  }

  return (
    <div className="p-3 rounded-lg border border-slate-700/80 bg-slate-800/40 hover:border-slate-600 transition">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-200 text-sm truncate">{offer.lender}</div>
          <div className="text-[10px] text-slate-500">
            ${offer.monthly_payment}/mo · {offer.term_months} mo
          </div>
        </div>
        <span className="text-emerald-400/90 font-mono font-semibold text-sm shrink-0">
          {offer.interest_rate}%
        </span>
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={isBusy}
        className={`mt-2.5 w-full py-1.5 rounded-md text-[11px] font-semibold transition ${
          isSubmitting
            ? "bg-blue-600/80 text-white cursor-wait"
            : isBusy
              ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
              : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-1.5">
            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Submitting via TEE...
          </span>
        ) : "Apply Now →"}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, active,
}: {
  label: string; value: string; onChange: (v: string) => void; active?: boolean;
}) {
  return (
    <label className="block">
      <span className={active ? "text-violet-300" : "text-slate-500"}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-0.5 w-full px-2 py-1.5 rounded bg-slate-950 border text-slate-200 outline-none transition ${
          active ? "border-violet-500 focus:border-violet-400 focus:ring-1 focus:ring-violet-500/40" : "border-slate-700 focus:border-blue-600"
        }`}
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options, active,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  active?: boolean;
}) {
  return (
    <label className="block">
      <span className={active ? "text-violet-300" : "text-slate-500"}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-0.5 w-full px-2 py-1.5 rounded bg-slate-950 border text-slate-200 outline-none transition appearance-none cursor-pointer ${
          active ? "border-violet-500 focus:border-violet-400 focus:ring-1 focus:ring-violet-500/40" : "border-slate-700 focus:border-blue-600"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-950">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
