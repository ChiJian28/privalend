"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type ChoreographyPhase,
  type FlowId,
  type PartyId,
  type AttackAnimPhase,
  PARTY_META,
  activeFlows,
  frozenFlows,
  glowingParties,
} from "@/lib/graph-choreography";

const W = 900;
const H = 520;

/** Place node by anchor center (percent of canvas) */
function at(cxPct: number, cyPct: number, w: number, h: number) {
  const cx = (cxPct / 100) * W;
  const cy = (cyPct / 100) * H;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
}

/**
 * Coordinate map:
 * TEE hub 50%,50% | Agent 50%,15% | User 10%,50% | Lender 90%,50%
 * Vault 30%,85% | Fraud 70%,85%
 */
const NODES: Record<PartyId, { x: number; y: number; w: number; h: number }> = {
  tee:    at(50, 50, 210, 92),
  agent:  at(50, 15, 152, 58),
  user:   at(10, 50, 118, 52),
  lender: at(90, 50, 128, 52),
  vault:  at(30, 85, 136, 54),
  fraud:  at(70, 85, 136, 54),
};

function center(n: PartyId) {
  const b = NODES[n];
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

function pt(n: PartyId) {
  const b = NODES[n];
  const c = center(n);
  return { ...c, left: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h };
}

const PATHS: Record<FlowId, string> = {
  // 🟢 User ↘ Vault — data sealing (bypasses Agent)
  user_vault: `M ${pt("user").right - 8} ${pt("user").bottom} L ${pt("vault").cx} ${pt("vault").top}`,
  // 🔵 User ↗ Agent — intent only
  user_agent: `M ${pt("user").cx + 20} ${pt("user").top} L ${pt("agent").left} ${pt("agent").cy}`,
  // 🔵 Agent ⬇ TEE — vertical command (+0.1px avoids zero-width SVG bbox)
  agent_tee: `M ${pt("agent").cx} ${pt("agent").bottom} L ${pt("tee").cx + 0.1} ${pt("tee").top}`,
  // 🔵 TEE ↑ Agent — desensitized score return
  tee_agent: `M ${pt("tee").cx + 18} ${pt("tee").top} L ${pt("agent").cx + 18.1} ${pt("agent").bottom}`,
  // 🩵 TEE ↙ Vault — enclave read
  tee_vault: `M ${pt("tee").cx - 36} ${pt("tee").bottom} L ${pt("vault").cx + 20} ${pt("vault").top}`,
  // 🟡 Agent ↘ Fraud — cross-tenant blacklist check
  agent_fraud: `M ${pt("agent").cx + 28} ${pt("agent").bottom} Q ${(75/100)*W} ${(40/100)*H} ${pt("fraud").cx - 12} ${pt("fraud").top}`,
  // 🟢 TEE → Lender — horizontal safe output (+0.1px avoids zero-height SVG bbox)
  tee_lender: `M ${pt("tee").right} ${pt("tee").cy} L ${pt("lender").left} ${pt("lender").cy + 0.1}`,
  // 🔴 Attack: Agent jagged → Vault
  agent_vault: `M ${pt("agent").cx - 20} ${pt("agent").bottom} L ${pt("agent").cx - 50} ${280} L ${pt("agent").cx + 40} ${360} L ${pt("vault").cx} ${pt("vault").top}`,
};

const FLOW_STYLE: Record<FlowId, { color: string; width: number; glow: string }> = {
  user_vault:  { color: "#22C55E", width: 3,   glow: "green" },
  user_agent:  { color: "#3B82F6", width: 2.5, glow: "blue" },
  agent_tee:   { color: "#3B82F6", width: 2.5, glow: "blue" },
  tee_agent:   { color: "#3B82F6", width: 2,   glow: "blue" },
  tee_vault:   { color: "#22D3EE", width: 2.5, glow: "cyan" },
  agent_fraud: { color: "#EAB308", width: 2,   glow: "yellow" },
  tee_lender:  { color: "#22C55E", width: 3.5, glow: "green" },
  agent_vault: { color: "#EF4444", width: 3,   glow: "red" },
};

function flowMarker(id: FlowId, phase: ChoreographyPhase): string {
  if (id === "agent_vault") return "red";
  if (id === "agent_fraud") return "yellow";
  if (id === "tee_vault") return "cyan";
  if (id === "tee_lender" && phase === "apply") return "gold";
  const c = FLOW_STYLE[id].color;
  if (c === "#22C55E") return "green";
  if (c === "#3B82F6") return "blue";
  return "gray";
}

function flowGlowFilter(id: FlowId, phase: ChoreographyPhase, stroke: string): string | undefined {
  if (id === "agent_vault") return "url(#glow-red)";
  if (id === "tee_lender" && phase === "apply") return "url(#glow-gold)";
  if (id === "tee_vault") return "url(#glow-cyan)";
  if (stroke === "#22C55E") return "url(#glow-green)";
  return "url(#glow-blue)";
}

function FlowDefs({ idPrefix = "" }: { idPrefix?: string }) {
  const p = idPrefix;
  return (
    <defs>
      {([
        ["blue", "#3B82F6"], ["green", "#22C55E"], ["cyan", "#22D3EE"],
        ["yellow", "#EAB308"], ["gold", "#FBBF24"], ["red", "#EF4444"], ["gray", "#475569"],
      ] as const).map(([k, fill]) => (
        <marker key={k} id={`${p}arr-${k}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill={fill} />
        </marker>
      ))}
      <filter id={`${p}glow-green`} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id={`${p}glow-blue`} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id={`${p}glow-cyan`} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id={`${p}glow-gold`} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <filter id={`${p}glow-red`} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <style>{`
        @keyframes liquid { to { stroke-dashoffset: -30; } }
        .liquid-flow { animation: liquid 0.55s linear infinite; }
        .liquid-slow { animation: liquid 0.75s linear infinite; }
        .liquid-fast { animation: liquid 0.35s linear infinite; }
      `}</style>
    </defs>
  );
}

function resolveGlowFilter(id: FlowId, phase: ChoreographyPhase, stroke: string, idPrefix: string): string | undefined {
  const f = flowGlowFilter(id, phase, stroke);
  if (!f) return undefined;
  const name = f.replace("url(#glow-", "").replace(")", "");
  return `url(#${idPrefix}glow-${name})`;
}

function FlowPath({
  id, phase, active, frozen, markerPrefix = "",
}: {
  id: FlowId;
  phase: ChoreographyPhase;
  active: boolean;
  frozen?: boolean;
  markerPrefix?: string;
}) {
  const style = FLOW_STYLE[id];
  const marker = frozen ? "red" : flowMarker(id, phase);
  const stroke = frozen ? "#EF4444" : flowColor(id, phase, active);
  const glowFilter = (active || frozen)
    ? frozen
      ? resolveGlowFilter("agent_vault", phase, "#EF4444", markerPrefix)
      : resolveGlowFilter(id, phase, stroke, markerPrefix)
    : undefined;
  const liquidClass = active && !frozen
    ? id === "agent_fraud"
      ? "liquid-slow"
      : id === "tee_lender" && phase === "apply"
        ? "liquid-fast"
        : "liquid-flow"
    : "";

  return (
    <path
      d={PATHS[id]}
      fill="none"
      stroke={stroke}
      strokeWidth={active || frozen ? (frozen ? style.width : style.width) : 1.5}
      strokeDasharray={active && !frozen ? "10 8" : frozen ? "6 6" : undefined}
      className={liquidClass}
      opacity={active || frozen ? 1 : 0.9}
      markerEnd={active || frozen ? `url(#${markerPrefix}arr-${marker})` : undefined}
      filter={glowFilter}
    />
  );
}

function flowColor(id: FlowId, phase: ChoreographyPhase, active: boolean): string {
  if (!active) return "#1e293b";
  if (id === "tee_lender" && phase === "apply") return "#FBBF24";
  return FLOW_STYLE[id].color;
}

interface Props {
  phase: ChoreographyPhase;
  eligibility?: { score: number } | null;
  attackActive: boolean;
  onAttackAnimDone?: () => void;
}

export function LivingGraph({ phase, eligibility, attackActive, onAttackAnimDone }: Props) {
  const flows = activeFlows(phase, { eligibility });
  const frozen = frozenFlows(phase);
  const glow = glowingParties(phase);
  const isAttack = phase === "attack" || attackActive;
  const isRejected = phase === "rejected";
  const isOffersWait = phase === "offers_wait";
  const isSuccess = phase === "success";
  const [attackAnim, setAttackAnim] = useState<AttackAnimPhase>("idle");
  const [shieldBroken, setShieldBroken] = useState(false);

  useEffect(() => {
    if (!attackActive) {
      setAttackAnim("idle");
      setShieldBroken(false);
      return;
    }
    setAttackAnim("strike");
    const t1 = setTimeout(() => setAttackAnim("pulse"), 600);
    const t2 = setTimeout(() => setAttackAnim("shield"), 1100);
    const t3 = setTimeout(() => { setAttackAnim("shatter"); setShieldBroken(true); }, 1700);
    const t4 = setTimeout(() => setAttackAnim("safe"), 2600);
    const t5 = setTimeout(() => onAttackAnimDone?.(), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [attackActive, onAttackAnimDone]);

  const tee = center("tee");

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-xl border transition-colors duration-700 ${
      isAttack ? "border-red-900/60 bg-[#1a0508]" :
      isRejected ? "border-red-700/60 bg-[#140a0c]" :
      "border-slate-800 bg-[#0b0f17]"
    }`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-[900px] aspect-[900/520]">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(circle, #334155 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <AnimatePresence>
            {isAttack && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.15, 0.28, 0.12] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse" }}
                className="absolute inset-0 bg-red-950/40 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Layer 1 — inactive paths + TEE rings (under nodes) */}
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <FlowDefs />
            <circle cx={tee.cx} cy={tee.cy} r={72} fill="none" stroke="#22D3EE" strokeWidth="1" opacity="0.2" />
            <circle cx={tee.cx} cy={tee.cy} r={62} fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity="0.35" strokeDasharray="8 6">
              <animateTransform attributeName="transform" type="rotate" from={`0 ${tee.cx} ${tee.cy}`} to={`360 ${tee.cx} ${tee.cy}`} dur="12s" repeatCount="indefinite" />
            </circle>
            {(Object.keys(PATHS) as FlowId[]).map((id) => {
              if (id === "agent_vault" && !flows.includes("agent_vault")) {
                return null;
              }
              return flows.includes(id) || frozen.includes(id) ? null : (
                <FlowPath key={id} id={id} phase={phase} active={false} />
              );
            })}
            {attackAnim === "pulse" || attackAnim === "shield" || attackAnim === "shatter" ? (
              <circle cx={tee.cx} cy={tee.cy} r={60} fill="none" stroke="#3B82F6" strokeWidth="2" opacity="0.6">
                <animate attributeName="r" values="55;95;55" dur="0.8s" repeatCount="2" />
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="0.8s" repeatCount="2" />
              </circle>
            ) : null}
            {(phase === "tee_compute" || phase === "apply") && !isAttack && (
              <circle cx={tee.cx} cy={tee.cy} r={48} fill="none" stroke="#22D3EE" strokeWidth="1.5" opacity="0.5" strokeDasharray="4 3">
                <animateTransform attributeName="transform" type="rotate" from={`0 ${tee.cx} ${tee.cy}`} to={`360 ${tee.cx} ${tee.cy}`} dur="3s" repeatCount="indefinite" />
              </circle>
            )}
            {isSuccess && !isAttack && (
              <circle cx={tee.cx} cy={tee.cy} r={52} fill="none" stroke="#22D3EE" strokeWidth="2" opacity="0.55">
                <animate attributeName="r" values="48;58;48" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0.7;0.35" dur="3s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>

          {/* Layer 2 — HTML nodes */}
          {(["tee", "agent", "user", "lender", "vault", "fraud"] as PartyId[]).map((id) => (
            <GraphNode
              key={id}
              id={id}
              active={glow.includes(id)}
              softActive={isOffersWait && id === "user"}
              breathing={isSuccess && id === "tee"}
              isCore={id === "tee"}
              danger={isAttack && (id === "agent" || id === "vault") || (isRejected && (id === "agent" || id === "fraud"))}
              rogue={isAttack && id === "agent"}
            />
          ))}

          {/* Layer 3 — active flows above nodes (z-10) so agent_tee / tee_lender stay visible */}
          <svg className="absolute inset-0 w-full h-full z-[15] pointer-events-none" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <FlowDefs idPrefix="top-" />
            {flows.map((id) => (
              <FlowPath key={id} id={id} phase={phase} active markerPrefix="top-" />
            ))}
            {frozen.map((id) => (
              <FlowPath key={`frozen-${id}`} id={id} phase={phase} active={false} frozen markerPrefix="top-" />
            ))}
          </svg>

          <AnimatePresence>
            {(attackAnim === "shield" || attackAnim === "shatter") && !shieldBroken && (
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.85 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="absolute pointer-events-none text-6xl"
                style={{ left: `${(pt("vault").cx / W) * 100 - 4}%`, top: `${((pt("vault").top - 44) / H) * 100}%` }}
              >
                🛡️
              </motion.div>
            )}
            {shieldBroken && attackAnim !== "safe" && attackAnim !== "idle" && (
              <motion.div
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 1.4, rotate: 15 }}
                className="absolute pointer-events-none text-5xl grayscale"
                style={{ left: `${(pt("vault").cx / W) * 100 - 3}%`, top: `${((pt("vault").top - 20) / H) * 100}%` }}
              >
                💥
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {attackAnim === "safe" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-green-950/90 border border-green-600 text-green-300 text-xs font-mono"
              >
                ✓ 0 Bytes Leaked — Hypervisor blocked unauthorized KV access
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-black/50 border border-slate-700 text-[10px] text-slate-400 font-mono z-10">
            6 parties · 1 agent · {isRejected
              ? "rejected — flow frozen"
              : flows.length === 0
                ? (isOffersWait ? "idle — awaiting user" : isSuccess ? "complete" : "0 active flows")
                : `${flows.length} active flow${flows.length !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphNode({
  id, active, softActive, breathing, isCore, danger, rogue,
}: {
  id: PartyId;
  active: boolean;
  softActive?: boolean;
  breathing?: boolean;
  isCore?: boolean;
  danger?: boolean;
  rogue?: boolean;
}) {
  const n = NODES[id];
  const meta = PARTY_META[id];
  return (
    <motion.div
      animate={{
        boxShadow: danger
          ? "0 0 24px rgba(239,68,68,0.45)"
          : breathing
            ? [
                "0 0 28px rgba(34,211,238,0.45), 0 0 44px rgba(59,130,246,0.2)",
                "0 0 40px rgba(34,211,238,0.65), 0 0 56px rgba(59,130,246,0.3)",
                "0 0 28px rgba(34,211,238,0.45), 0 0 44px rgba(59,130,246,0.2)",
              ]
          : isCore && !breathing
            ? "0 0 32px rgba(34,211,238,0.35), 0 0 48px rgba(59,130,246,0.15)"
            : softActive
              ? [
                  "0 0 12px rgba(59,130,246,0.15)",
                  "0 0 18px rgba(59,130,246,0.28)",
                  "0 0 12px rgba(59,130,246,0.15)",
                ]
            : active
              ? "0 0 20px rgba(59,130,246,0.25)"
              : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={breathing || softActive
        ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
        : { duration: 0.7 }}
      className={`absolute flex items-center gap-2 px-2.5 rounded-xl border backdrop-blur-sm transition-colors ${
        isCore ? `${breathing ? "border-cyan-400/80" : "border-cyan-500/70"} bg-slate-900/95 z-10` :
        danger ? "border-red-500 bg-red-950/80" :
        softActive ? "border-blue-500/35 bg-slate-900/80" :
        active ? "border-blue-500/60 bg-slate-900/90" :
        "border-slate-700 bg-slate-900/70"
      }`}
      style={{
        left: `${(n.x / W) * 100}%`,
        top: `${(n.y / H) * 100}%`,
        width: `${(n.w / W) * 100}%`,
        height: `${(n.h / H) * 100}%`,
      }}
    >
      <span className={`${isCore ? "text-xl" : "text-lg"} ${rogue ? "grayscale contrast-150" : ""}`}>
        {rogue ? "💀" : meta.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`font-semibold truncate ${danger ? "text-red-300" : isCore ? "text-cyan-100" : "text-slate-100"} ${isCore ? "text-xs" : "text-[10px]"}`}>
          {meta.label}
        </div>
        <div className="text-[8px] text-slate-500 truncate">{meta.sub}</div>
      </div>
      {active && !softActive && <span className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${isCore ? "bg-cyan-400" : "bg-blue-400"}`} />}
      {softActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />}
    </motion.div>
  );
}
