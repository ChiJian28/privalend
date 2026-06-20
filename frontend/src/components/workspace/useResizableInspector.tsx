"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HEADER_H = 36;
const DEFAULT_H = 220;
const MIN_EXPANDED_H = 100;
const MAX_RATIO = 0.72;
const STORAGE_KEY = "privalend-inspector-height";

function clampHeight(h: number) {
  const max = Math.floor(window.innerHeight * MAX_RATIO);
  return Math.max(MIN_EXPANDED_H, Math.min(max, h));
}

export function useResizableInspector() {
  const [height, setHeight] = useState(HEADER_H);
  const [collapsed, setCollapsed] = useState(true);
  const lastExpanded = useRef(DEFAULT_H);
  const dragging = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (Number.isFinite(n) && n >= MIN_EXPANDED_H) {
        lastExpanded.current = clampHeight(n);
      }
    }
  }, []);

  const persist = useCallback((h: number) => {
    lastExpanded.current = h;
    localStorage.setItem(STORAGE_KEY, String(h));
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const wasCollapsed = collapsed;
    if (wasCollapsed) {
      setCollapsed(false);
      setHeight(lastExpanded.current);
    }
    dragging.current = true;
    const startY = e.clientY;
    const startH = wasCollapsed ? lastExpanded.current : height;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY - ev.clientY;
      const next = clampHeight(startH + delta);
      setHeight(next);
      if (wasCollapsed && next > HEADER_H + 20) setCollapsed(false);
    };

    const onUp = (ev: MouseEvent) => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const delta = startY - ev.clientY;
      const final = clampHeight(startH + delta);
      if (final <= HEADER_H + 24) {
        setCollapsed(true);
        setHeight(HEADER_H);
      } else {
        setCollapsed(false);
        setHeight(final);
        persist(final);
      }
    };

    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [collapsed, height, persist]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      if (c) {
        setHeight(lastExpanded.current);
        return false;
      }
      persist(height);
      setHeight(HEADER_H);
      return true;
    });
  }, [height, persist]);

  const doubleClickHandle = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      setHeight(lastExpanded.current);
      return;
    }
    const max = Math.floor(window.innerHeight * MAX_RATIO);
    const mid = Math.floor(window.innerHeight * 0.35);
    const next = height < mid ? max : DEFAULT_H;
    const clamped = clampHeight(next);
    setHeight(clamped);
    persist(clamped);
  }, [collapsed, height, persist]);

  const visibleHeight = collapsed ? HEADER_H : height;

  return {
    height: visibleHeight,
    collapsed,
    startDrag,
    toggleCollapse,
    doubleClickHandle,
    isResizable: true,
  };
}

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  visible?: boolean;
}

export function InspectorResizeHandle({ onMouseDown, onDoubleClick, visible = true }: ResizeHandleProps) {
  if (!visible) return null;
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize inspector panel"
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className="group relative h-[5px] shrink-0 flex items-center justify-center cursor-ns-resize hover:bg-blue-500/20 active:bg-blue-500/30 border-t border-slate-700/80 bg-[#0a0e14] transition-colors"
    >
      <div className="h-[3px] w-12 rounded-full transition-colors bg-slate-600 group-hover:bg-blue-500/60" />
    </div>
  );
}
