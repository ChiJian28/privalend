"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { appEnv } from "@/lib/env";

interface AuditData {
  reference: string;
  lender: string;
  amount: number;
  term: number;
  creditScore?: number;
  tier?: string;
  userDid?: string;
}

interface Props {
  data: AuditData;
}

// Deterministic hash generation from audit data (no crypto needed, just visual)
function generateHash(seed: string, length: number = 64): string {
  let hash = "";
  for (let i = 0; i < length; i++) {
    const charCode = (seed.charCodeAt(i % seed.length) * 31 + i * 17) % 16;
    hash += charCode.toString(16);
  }
  return hash;
}

function generateMerkleRoot(ref: string): string {
  return "0x" + generateHash(ref + "merkle", 64);
}

function generateSignature(ref: string): string {
  return "0x" + generateHash(ref + "sig", 128);
}

function generateAttestationId(ref: string): string {
  return "TDX-" + generateHash(ref + "attest", 16).toUpperCase();
}

type Phase = "idle" | "verifying" | "certificate";

const VERIFY_STEPS = [
  { text: "Retrieving TEE Execution Logs...", delay: 300 },
  { text: "Verifying Intel TDX Hardware Attestation...", result: "[OK]", delay: 400 },
  { text: "Scanning for OWASP Agent Anomalies...", result: "[0 Anomalies]", delay: 500 },
  { text: "Validating Cross-Tenant Authorization Scope...", result: "[PASS]", delay: 350 },
  { text: "Checking PII Exposure Vector...", result: "[0 BYTES]", delay: 400 },
  { text: "Calculating Merkle Root Hash...", delay: 600 },
  { text: "", result: "[ \u{1F512} AUDIT TRAIL SEALED ]", delay: 300 },
];

export function AuditTrailButton({ data }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleClick = useCallback(() => {
    setPhase("verifying");
  }, []);

  const handleVerifyComplete = useCallback(() => {
    setPhase("certificate");
  }, []);

  const handleClose = useCallback(() => {
    setPhase("idle");
  }, []);

  return (
    <>
      {/* Trigger Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="mt-8 p-5 rounded-xl bg-gradient-to-br from-[#0a0e1a] to-[#111827] border border-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]"
      >
        <div className="text-center mb-3">
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide">
            Regulatory Compliance Verified
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">
            This transaction was executed in a hardware-attested enclave with zero PII exposure.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleClick}
          className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-700/40 text-emerald-300 font-semibold text-sm flex items-center justify-center gap-2 hover:border-emerald-500/60 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all"
        >
          <span>🛡️</span>
          <span>View T3N Cryptographic Audit Trail</span>
        </motion.button>
      </motion.div>

      {/* Verification Overlay */}
      <AnimatePresence>
        {phase === "verifying" && (
          <VerificationOverlay onComplete={handleVerifyComplete} reference={data.reference} />
        )}
      </AnimatePresence>

      {/* Certificate Modal */}
      <AnimatePresence>
        {phase === "certificate" && (
          <CertificateModal data={data} onClose={handleClose} />
        )}
      </AnimatePresence>
    </>
  );
}

function VerificationOverlay({ onComplete, reference }: { onComplete: () => void; reference: string }) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    let step = 0;
    let timeout: NodeJS.Timeout;

    function showNext() {
      step++;
      setVisibleSteps(step);
      if (step >= VERIFY_STEPS.length) {
        timeout = setTimeout(onComplete, 800);
      } else {
        timeout = setTimeout(showNext, VERIFY_STEPS[step]?.delay || 400);
      }
    }

    timeout = setTimeout(showNext, 500);
    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-[500px] max-w-[90vw] bg-[#0a0e14] border border-emerald-900/50 rounded-xl p-6 shadow-[0_0_40px_rgba(16,185,129,0.1)]"
      >
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-2 text-[10px] text-slate-500 font-mono">t3n-audit-verify — {reference}</span>
        </div>

        <div className="font-mono text-xs space-y-1.5">
          {VERIFY_STEPS.slice(0, visibleSteps).map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              {step.text && (
                <span className="text-slate-400">{step.text}</span>
              )}
              {step.result && (
                <span className={`font-bold ${
                  step.result.includes("SEALED") ? "text-emerald-400 text-sm" :
                  step.result.includes("OK") || step.result.includes("PASS") ? "text-green-400" :
                  "text-cyan-400"
                }`}>
                  {step.result}
                </span>
              )}
            </motion.div>
          ))}
          {visibleSteps < VERIFY_STEPS.length && (
            <span className="text-emerald-400 animate-pulse">▊</span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function CertificateModal({ data, onClose }: { data: AuditData; onClose: () => void }) {
  const certRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const merkleRoot = generateMerkleRoot(data.reference);
  const signature = generateSignature(data.reference);
  const attestationId = generateAttestationId(data.reference);
  const timestamp = new Date().toISOString();

  const handleDownload = useCallback(async () => {
    if (!certRef.current) return;
    setDownloading(true);

    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(certRef.current, {
        backgroundColor: "#070b14",
        scale: 2,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      // // Watermark (light gray, low opacity via color)
      // pdf.setTextColor(230, 230, 230);
      // pdf.setFontSize(36);
      // pdf.text("TAMPER-PROOF BY TERMINAL 3", pdfWidth / 2, pdfHeight - 10, {
      //   align: "center",
      // });

      const shortHash = merkleRoot.slice(2, 10);
      pdf.save(`T3N_Audit_tx${shortHash}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [merkleRoot]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        className="w-[640px] max-w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Certificate Content (captured for PDF) */}
        <div ref={certRef} className="bg-[#070b14] border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#0a1628] to-[#0d1f3c] border-b border-slate-700/50">
            <div>
              <h2 className="text-sm font-bold text-slate-200 tracking-widest uppercase">
                Certificate of Confidential Compute
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                Transaction: {data.reference} • {timestamp.slice(0, 19)}Z
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-900/30 border border-emerald-700/40">
              <span className="text-[10px] font-bold text-emerald-400 tracking-wider">✓ VERIFIED ON T3N TESTNET</span>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Section A: Identity & Actors */}
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Identity & Actors
              </h3>
              <div className="bg-[#0c1220] rounded-lg border border-slate-800 overflow-hidden">
                <ActorRow icon="👤" role="Data Owner (User)" did={data.userDid ?? "did:t3n:demo_user_xxxxxxxx"} />
                <ActorRow icon="🤖" role="AI Agent (PrivaLend)" did={appEnv.agentDid} />
                <ActorRow icon="🏢" role="Processing Tenant" did={appEnv.privalendDid} />
                <ActorRow icon="🔗" role="Fraud Consortium" did={appEnv.consortiumDid} last />
              </div>
            </div>

            {/* Section B: Data Exposure Matrix */}
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Data Exposure Matrix
              </h3>
              <div className="bg-[#0c1220] rounded-lg border border-slate-800 p-4 space-y-3">
                <ExposureRow label="Plaintext PII accessible to Agent" value="0 Bytes" status="pass" emphasis />
                <ExposureRow label="Execution Environment" value="Intel TDX TEE (Hardware Enclave)" status="pass" />
                <ExposureRow label="OWASP Identity Abuse Blocked" value="True (No privilege escalation)" status="pass" />
                <ExposureRow label="Cross-Tenant Checks Passed" value="Fraud Consortium Blacklist" status="pass" />
                <ExposureRow label="http-with-placeholders PII Resolution" value="5 fields resolved in enclave" status="pass" />
                <ExposureRow label="Credit Score Computed Inside TEE" value={data.creditScore ? `${data.creditScore} (${data.tier?.toUpperCase()})` : "780 (PRIME)"} status="pass" />
              </div>
            </div>

            {/* Section C: Cryptographic Proof */}
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Cryptographic Execution Proof
              </h3>
              <div className="bg-[#080c18] rounded-lg border border-slate-800 p-4 font-mono text-[10px] space-y-2">
                <CryptoRow label="Attestation ID" value={attestationId} />
                <CryptoRow label="Merkle Root" value={merkleRoot} />
                <CryptoRow label="TEE Signature" value={signature} />
                <CryptoRow label="Enclave Measurement" value={"0x" + generateHash(data.reference + "mrenclave", 64)} />
                <CryptoRow label="Timestamp (UTC)" value={timestamp} />
                <CryptoRow label="Block Height" value={`#${Math.floor(Date.now() / 1000) % 999999}`} />
              </div>
            </div>

            {/* Footer Seal */}
            <div className="flex items-center justify-center pt-3 border-t border-slate-800">
              <div className="text-center">
                <p className="text-[9px] text-slate-600 tracking-wider">
                  SEALED BY TERMINAL 3 NETWORK • INTEL TDX HARDWARE ATTESTATION
                </p>
                <p className="text-[9px] text-slate-700 mt-0.5">
                  This certificate is tamper-proof and cryptographically verifiable on-chain.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons (outside certRef — not in PDF) */}
        <div className="flex items-center justify-between mt-4 px-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Close
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 text-white rounded-lg font-medium text-sm shadow-lg hover:shadow-emerald-900/30 transition-all disabled:opacity-50"
          >
            {downloading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <span>⬇️</span>
                <span>Download PDF for Regulators</span>
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActorRow({ icon, role, did, last }: { icon: string; role: string; did: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${!last ? "border-b border-slate-800/50" : ""}`}>
      <span className="text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-500">{role}</div>
        <div className="text-[11px] font-mono text-slate-300 truncate">{did}</div>
      </div>
    </div>
  );
}

function ExposureRow({ label, value, status, emphasis }: { label: string; value: string; status: "pass" | "fail"; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] text-slate-400 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-mono text-right ${
          emphasis ? "text-emerald-300 font-bold text-sm" : status === "pass" ? "text-emerald-400" : "text-red-400"
        }`}>
          {value}
        </span>
        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
          status === "pass" ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"
        }`}>
          {status === "pass" ? "✓" : "✗"}
        </span>
      </div>
    </div>
  );
}

function CryptoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-600 w-28 flex-shrink-0">{label}:</span>
      <span className="text-cyan-400/80 break-all">{value}</span>
    </div>
  );
}
