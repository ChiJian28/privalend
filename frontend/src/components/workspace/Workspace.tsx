"use client";

import { useState, useCallback } from "react";
import type { StartOptions, WorkflowState } from "@/hooks/useWorkflow";
import { deriveChoreographyPhase } from "@/lib/graph-choreography";
import { CommandCenter } from "./CommandCenter";
import { LivingGraph } from "./LivingGraph";
import { InspectorConsole } from "./InspectorConsole";
import { CanvasSuccessPanel, CanvasRejectionPanel } from "./CanvasOverlays";
import { isFraudRejected } from "@/lib/graph-choreography";
import { useResizableInspector, InspectorResizeHandle } from "./useResizableInspector";

interface Props {
  workflow: WorkflowState;
}

export function Workspace({ workflow }: Props) {
  const [selectedPersona, setSelectedPersona] = useState<"alice" | "bob" | "charlie" | "custom" | null>(null);
  const [maliciousMode, setMaliciousMode] = useState(false);
  const [attackPlaying, setAttackPlaying] = useState(false);
  const {
    height: inspectorHeight,
    collapsed: inspectorCollapsed,
    startDrag,
    toggleCollapse,
    doubleClickHandle,
  } = useResizableInspector();

  // Graph attack is visual-only (~4.2s). Inspector maliciousMode is separate and longer.
  const phase = deriveChoreographyPhase(
    workflow.step,
    workflow.isLoading,
    workflow.fraudResult,
    workflow.eligibility,
    attackPlaying,
    workflow.isApplying,
  );

  const rejected = isFraudRejected(workflow.fraudResult) && workflow.step >= 2;

  const handleExecute = useCallback((opts?: StartOptions) => {
    workflow.startWorkflow(opts);
  }, [workflow]);

  const handleSelectPersona = useCallback((p: "alice" | "bob" | "charlie" | "custom" | null) => {
    if (isFraudRejected(workflow.fraudResult) && workflow.step >= 2) workflow.reset();
    setSelectedPersona(p);
  }, [workflow]);

  const handleAttack = useCallback(() => {
    setMaliciousMode(true);
    setAttackPlaying(true);
  }, []);

  const handleAttackAnimDone = useCallback(() => {
    setAttackPlaying(false);
  }, []);

  const handleMaliciousComplete = useCallback(() => {
    setMaliciousMode(false);
    setAttackPlaying(false);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#06080d]">
      {/* Main workspace — grows/shrinks as inspector resizes */}
      <div className="flex flex-1 min-h-0">
        <div className="w-[25%] min-w-[240px] max-w-[320px] shrink-0">
          <CommandCenter
            workflow={workflow}
            phase={phase}
            selectedPersona={selectedPersona}
            onSelectPersona={handleSelectPersona}
            onExecute={handleExecute}
            onAttack={handleAttack}
            attackDisabled={maliciousMode || attackPlaying}
          />
        </div>

        <div className="flex-1 p-3 min-w-0 relative">
          <LivingGraph
            phase={phase}
            eligibility={workflow.eligibility}
            attackActive={attackPlaying}
            onAttackAnimDone={handleAttackAnimDone}
          />

          {rejected && !attackPlaying && (
            <CanvasRejectionPanel
              riskLevel={workflow.fraudResult?.risk_level}
              onReset={() => {
                workflow.reset();
                setSelectedPersona(null);
              }}
            />
          )}

          {workflow.step === 4 && workflow.applicationResult && !attackPlaying && (
            <CanvasSuccessPanel
              result={workflow.applicationResult}
              credential={workflow.credential}
            />
          )}
        </div>
      </div>

      {/* VS Code-style drag handle */}
      <InspectorResizeHandle
        onMouseDown={startDrag}
        onDoubleClick={doubleClickHandle}
        visible={!inspectorCollapsed}
      />

      {/* Bottom inspector — pixel height, user-resizable */}
      <div
        className="shrink-0 overflow-hidden"
        style={{ height: inspectorHeight }}
      >
        <InspectorConsole
          events={workflow.events}
          currentStep={workflow.step}
          maliciousMode={maliciousMode}
          onMaliciousComplete={handleMaliciousComplete}
          collapsed={inspectorCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </div>
    </div>
  );
}
