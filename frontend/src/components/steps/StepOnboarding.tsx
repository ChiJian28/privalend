"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { StartOptions, UserProfile } from "@/hooks/useWorkflow";

interface Props {
  onStart: (options?: StartOptions) => Promise<void>;
}

type Tab = "quick" | "custom";

const personas = [
  {
    id: "alice" as const,
    emoji: "🧑‍💼",
    name: "Alice",
    subtitle: "Premium Client",
    desc: "High income, low debt",
    detail: "$150K income · $10K debt",
    color: "from-emerald-500 to-teal-600",
    borderColor: "border-emerald-200 hover:border-emerald-400",
    bgColor: "bg-emerald-50",
  },
  {
    id: "bob" as const,
    emoji: "👨‍🔧",
    name: "Bob",
    subtitle: "Flagged User",
    desc: "Fraud blacklist member",
    detail: "$45K income · Blacklisted",
    color: "from-red-500 to-rose-600",
    borderColor: "border-red-200 hover:border-red-400",
    bgColor: "bg-red-50",
  },
  {
    id: "charlie" as const,
    emoji: "👩‍🎓",
    name: "Charlie",
    subtitle: "Fresh Graduate",
    desc: "Student loans, moderate income",
    detail: "$52K income · $28K debt",
    color: "from-amber-500 to-orange-600",
    borderColor: "border-amber-200 hover:border-amber-400",
    bgColor: "bg-amber-50",
  },
];

export function StepOnboarding({ onStart }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("quick");
  const [income, setIncome] = useState("");
  const [debt, setDebt] = useState("");
  const [nationality, setNationality] = useState("US");
  const [isSealing, setIsSealing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handlePersonaClick = (personaId: "alice" | "bob" | "charlie") => {
    onStart({ persona: personaId });
  };

  const handleCustomSubmit = async () => {
    const incomeNum = parseFloat(income);
    const debtNum = parseFloat(debt);
    if (!incomeNum || incomeNum <= 0) return;

    setIsSealing(true);

    // Seal animation
    await new Promise((r) => setTimeout(r, 800));
    setShowToast(true);

    // Hide toast and start workflow after brief pause
    await new Promise((r) => setTimeout(r, 2000));
    setShowToast(false);

    const profile: UserProfile = {
      annual_income: incomeNum,
      total_debt: debtNum || 0,
      nationality,
    };
    onStart({ profile });
    setIsSealing(false);
  };

  return (
    <div className="max-w-2xl mx-auto pt-8">
      {/* Hero */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-200 mb-4">
          <span className="text-2xl">🔐</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Apply for a Loan, Keep Your Privacy
        </h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Your AI agent finds the best rates inside a hardware-secured enclave — without ever seeing your data.
        </p>
      </motion.div>

      {/* Tab Switcher */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-6 max-w-md mx-auto">
        <button
          onClick={() => setActiveTab("quick")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "quick"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          ⚡ Quick Demo
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === "custom"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          ⚙️ Custom Profile
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "quick" ? (
          <motion.div
            key="quick"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-center text-xs text-slate-400 mb-4">
              Choose a persona to see how PrivaLend handles different risk profiles
            </p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {personas.map((p) => (
                <motion.button
                  key={p.id}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handlePersonaClick(p.id)}
                  className={`relative p-5 rounded-2xl border-2 ${p.borderColor} bg-white shadow-sm hover:shadow-md transition-all text-left group`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-3 shadow-sm`}>
                    <span className="text-xl">{p.emoji}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{p.name}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">{p.subtitle}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{p.desc}</p>
                  <div className={`mt-3 px-2 py-1 rounded-md ${p.bgColor} inline-block`}>
                    <span className="text-[10px] font-mono text-slate-600">{p.detail}</span>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="text-center">
              <p className="text-[10px] text-slate-400">
                💡 Try <strong>Bob</strong> to see the cross-tenant fraud blacklist in action
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="custom"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-sm mx-auto"
          >
            <p className="text-center text-xs text-slate-400 mb-5">
              Enter your financial profile — data is encrypted and sealed inside the T3N hardware enclave
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Annual Income (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    placeholder="85,000"
                    className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Total Outstanding Debt (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    value={debt}
                    onChange={(e) => setDebt(e.target.value)}
                    placeholder="12,000"
                    className="w-full pl-7 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nationality
                </label>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all bg-white"
                >
                  <option value="US">United States</option>
                  <option value="SG">Singapore</option>
                  <option value="UK">United Kingdom</option>
                  <option value="JP">Japan</option>
                  <option value="DE">Germany</option>
                  <option value="AU">Australia</option>
                  <option value="CN">China</option>
                  <option value="IN">India</option>
                </select>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCustomSubmit}
              disabled={isSealing || !income}
              className={`w-full mt-6 py-4 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                isSealing
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : !income
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-200 hover:shadow-xl"
              }`}
            >
              {isSealing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Encrypting & Sealing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Encrypt &amp; Seal in T3N Vault
                </>
              )}
            </motion.button>

            <p className="text-[10px] text-slate-400 text-center mt-3">
              Your data is encrypted client-side before transmission. The AI Agent never sees raw values.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-start gap-3 max-w-md">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Data sealed in T3N Hardware Enclave</p>
                <p className="text-xs text-slate-400 mt-1">
                  PrivaLend Agent currently has <strong className="text-slate-200">zero knowledge</strong> of your financial data. Only the TEE can process it.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-6 mt-8 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          TEE-Secured
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          GDPR Compliant
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          Merkle Audited
        </span>
      </div>
    </div>
  );
}
