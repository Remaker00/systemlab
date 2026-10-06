"use client";

import { createContext, useContext } from "react";
import { emptyMetrics, type Metrics } from "@/lib/sim/engine";

/**
 * Canvas-wide visual state.
 * - `running` means the request simulation is advancing. It also wakes up the node glyphs.
 * - `metrics` is the latest simulation snapshot (published ~8×/s).
 * - `focusedId` is the single selected node. Its neighbours and links stay lit,
 *   and everything else recedes.
 */
export type LabState = {
  running: boolean;
  focusedId: string | null;
  litNodes: ReadonlySet<string>;
  litEdges: ReadonlySet<string>;
  metrics: Metrics;
};

export const LabContext = createContext<LabState>({
  running: false,
  focusedId: null,
  litNodes: new Set(),
  litEdges: new Set(),
  metrics: emptyMetrics,
});

export const useLab = () => useContext(LabContext);

/** Whether an element should recede because something else is focused. */
export function useDimmed(kind: "node" | "edge", id: string): boolean {
  const { focusedId, litNodes, litEdges } = useLab();
  if (!focusedId) return false;
  return kind === "node" ? !litNodes.has(id) : !litEdges.has(id);
}
