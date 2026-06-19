"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CredentialIssueResult } from "@/lib/credential";
import { truncateDid, walletStorageKey } from "@/lib/credential";

interface Props {
  credentialResult: CredentialIssueResult;
}

export function CreditCredentialCard({ credentialResult }: Props) {
  const { credential, mode, issuedInsideTee } = credentialResult;
  const [flipped, setFlipped] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showEntrance, setShowEntrance] = useState(false);

  const storageKey = walletStorageKey(credential.credentialSubject.loanReference);

  useEffect(() => {
    const t = setTimeout(() => setShowEntrance(true), 400);
    return () => clearTimeout(t);
  }, []);

  const handleSave = () => {
    // Demo interaction only — state resets each workflow run (no read-back from storage).
    localStorage.setItem(storageKey, "saved");
    localStorage.setItem(`${storageKey}_json`, JSON.stringify(credential));
    setSaved(true);
  };

  const tier = credential.credentialSubject.creditTier;
  const score = credential.credentialSubject.creditScore;
  const subjectDid = credential.credentialSubject.id;

  return (
    <AnimatePresence>
      {showEntrance && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.2 }}
          className="mt-8"
        >
          {/* Pitch */}
          <div className="text-center mb-5 px-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              Your credit is now a <span className="font-semibold text-purple-700">portable asset</span>.
              Present this VC at any institution — skip re-scoring entirely.
            </p>
          </div>

          {/* Card container with perspective */}
          <div className="relative mx-auto max-w-sm" style={{ perspective: 1200 }}>
            <motion.div
              className="relative w-full cursor-pointer"
              style={{ transformStyle: "preserve-3d" }}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.6, type: "spring", stiffness: 120 }}
              onClick={() => setFlipped((f) => !f)}
            >
              {/* Front */}
              <div
                className="relative rounded-2xl p-[2px] overflow-hidden shadow-2xl shadow-purple-500/20"
                style={{ backfaceVisibility: "hidden" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 animate-gradient-x opacity-80" />
                <div className="relative rounded-[14px] bg-slate-900/80 backdrop-blur-xl p-6 min-h-[220px] flex flex-col justify-between border border-white/10">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80 font-medium">
                        PrivaLend Verified Trust
                      </p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${
                        mode === "tee"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}>
                        {mode === "tee" ? "TEE-ISSUED" : "DEMO VC"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm5.089 7.981a.75.75 0 01-1.08.02L4.747 9.976a.75.75 0 111.064-1.058l2.094 2.093 3.473-4.425a.75.75 0 111.08 1.04l-4.243 5.417z" clipRule="evenodd" />
                      </svg>
                      <span className="text-[9px] font-semibold">Secured by T3N</span>
                    </div>
                  </div>

                  {/* Center score */}
                  <div className="text-center py-4">
                    <p className="text-4xl font-black bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                      Credit Tier: {tier}
                    </p>
                    <p className="text-lg text-white/70 font-mono mt-1">{score} pts</p>
                  </div>

                  {/* Footer */}
                  <div>
                    <p className="text-[10px] text-slate-400">Issued to</p>
                    <p className="text-xs font-mono text-slate-200 truncate">{truncateDid(subjectDid, 16, 8)}</p>
                  </div>

                  <p className="absolute bottom-3 right-4 text-[9px] text-slate-500">tap to flip →</p>
                </div>
              </div>

              {/* Back — JSON preview */}
              <div
                className="absolute inset-0 rounded-2xl bg-[#0a0e1a] border border-cyan-800/40 p-4 overflow-hidden"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">
                  W3C Verifiable Credential (JSON-LD)
                </p>
                <pre className="text-[9px] font-mono text-emerald-300/90 overflow-auto max-h-[180px] leading-relaxed scrollbar-thin">
                  {highlightVcJson(JSON.stringify(credential, null, 2))}
                </pre>
                {issuedInsideTee && (
                  <p className="text-[9px] text-cyan-500 mt-2">✓ Claims assembled inside Intel TDX enclave</p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Wallet button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-5 flex flex-col items-center gap-2"
          >
            <button
              onClick={handleSave}
              disabled={saved}
              className={`relative px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                saved
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 cursor-default"
                  : "bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 animate-pulse-subtle"
              }`}
            >
              {saved ? "✅ Saved to T3 Identity Wallet" : "+ Add to T3 Identity Wallet"}
            </button>
            <p className="text-[10px] text-slate-400 text-center max-w-xs">
              {mode === "tee"
                ? "Credential issued inside TEE. Cryptographic proof pending sign-sd-jwt-vc on T3N testnet."
                : "Spec-compliant demo VC. Live TEE signing activates when testnet host API is available."}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function highlightVcJson(json: string): ReactNode {
  const lines = json.split("\n");
  return lines.map((line, i) => {
    const isContext = line.includes('"@context"') || line.includes("w3.org/2018/credentials");
    const isProof = line.includes('"proof"') || line.includes("proofValue") || line.includes("proofPurpose") || line.includes('"jws"');
    const className = isContext
      ? "text-yellow-300 font-bold"
      : isProof
        ? "text-pink-300 font-bold"
        : "text-emerald-300/90";
    return (
      <span key={i} className={className}>
        {line}
        {"\n"}
      </span>
    );
  });
}
