"use client";

import type { InspectorEvent } from "@/hooks/useWorkflow";

interface Props {
  content: string;
  highlight?: string;
  type: string;
}

export function CodeBlock({ content, highlight, type }: Props) {
  const isJson = content.trim().startsWith("{") || content.trim().startsWith("[");

  if (isJson && (type === "placeholder_before" || type === "placeholder_after")) {
    return <PlaceholderHighlight content={content} type={type} />;
  }

  return (
    <pre className="text-[11px] whitespace-pre-wrap break-words leading-relaxed text-[var(--inspector-text)] opacity-90">
      {content}
    </pre>
  );
}

function PlaceholderHighlight({ content, type }: { content: string; type: string }) {
  const lines = content.split("\n");

  return (
    <pre className="text-[11px] whitespace-pre-wrap break-words leading-relaxed">
      {lines.map((line, i) => {
        const hasPlaceholder = line.includes("{{profile.");
        const isResolvedPII = type === "placeholder_after" && (
          line.includes("Alan") ||
          line.includes("Turing") ||
          line.includes("alan@") ||
          line.includes("S1234567") ||
          line.includes("1912") ||
          line.includes("+65")
        );

        if (hasPlaceholder) {
          return (
            <span key={i} className="text-red-400 font-semibold">
              {line}{"\n"}
            </span>
          );
        }
        if (isResolvedPII) {
          return (
            <span key={i} className="text-green-400 font-semibold">
              {line}{"\n"}
            </span>
          );
        }
        return <span key={i} className="text-[var(--inspector-text)]">{line}{"\n"}</span>;
      })}
    </pre>
  );
}
