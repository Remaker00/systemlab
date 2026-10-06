"use client";

import { createContext, useContext } from "react";
import { emptyMetrics, type Fault, type Metrics } from "@/lib/sim/engine";

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
  /** requests/s Users are set to emit */
  traffic: number;
  /** the Break-the-System fault currently in effect (null before it lands or when none) */
  fault: Fault | null;
  /** real requests per simulated request on this sheet (1 in the sandbox, 50 in the surge challenge) */
  scale: number;
  /** node-data tunables this sheet doesn't let you change */
  locked: readonly string[];
};

export const LabContext = createContext<LabState>({
  running: false,
  focusedId: null,
  litNodes: new Set(),
  litEdges: new Set(),
  metrics: emptyMetrics,
  traffic: 0,
  fault: null,
  scale: 1,
  locked: [],
});

/** Formatters for quantities the sheet's scale applies to: request rates and request counts. */
export function useScaled() {
  const { scale } = useLab();
  const count = (v: number) => Math.round(v * scale).toLocaleString("en-US");
  return { count, rate: (v: number) => `${count(v)}/s` };
}

/** Whether the active fault has taken this node down. */
export function useIsDown(id: string): boolean {
  const { fault } = useLab();
  return !!fault && (fault.kind === "api-down" || fault.kind === "db-down") && fault.target === id;
}

export const useLab = () => useContext(LabContext);

/** Whether an element should recede because something else is focused. */
export function useDimmed(kind: "node" | "edge", id: string): boolean {
  const { focusedId, litNodes, litEdges } = useLab();
  if (!focusedId) return false;
  return kind === "node" ? !litNodes.has(id) : !litEdges.has(id);
}
