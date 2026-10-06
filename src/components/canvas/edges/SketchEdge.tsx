"use client";

import { EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { LabEdge } from "@/lib/graph";
import { useDimmed, useLab } from "../LabContext";

const PEN = [0.65, 0, 0.35, 1] as const;

/**
 * A connection drawn twice, like a draughtsman's line: a faint dotted
 * construction curve that sags slightly, and the confident inked curve on top.
 * While the simulation runs, ParticleLayer moves requests along the inked curve
 * (found through `data-sl-edge`).
 * Selecting a link reveals a cut mark; cutting erases the ink before removal.
 */
export function SketchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<LabEdge>) {
  const { running, focusedId } = useLab();
  const dimmed = useDimmed("edge", id);
  const lit = !!focusedId && !dimmed;
  const { deleteElements } = useReactFlow();
  const [cutting, setCutting] = useState(false);
  const delay = data?.drawDelay ?? 0;

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.45,
  });

  // construction line: same endpoints, looser curve
  const [guide] = getBezierPath({
    sourceX,
    sourceY: sourceY + 3,
    targetX,
    targetY: targetY + 3,
    sourcePosition,
    targetPosition,
    curvature: 0.8,
  });

  const ink = selected ? "var(--accent)" : lit ? "var(--ink)" : "var(--ink-soft)";

  return (
    <>
      <motion.g animate={{ opacity: dimmed ? 0.15 : 1 }} transition={{ duration: 0.6 }}>
        <path d={guide} fill="none" stroke="var(--ink-ghost)" strokeWidth={1} strokeDasharray="1 5" />

        {/* wide invisible hit area */}
        <path d={path} fill="none" stroke="transparent" strokeWidth={18} className="react-flow__edge-interaction" />

        <motion.path
          data-sl-edge={id}
          d={path}
          fill="none"
          stroke={ink}
          strokeWidth={selected || lit ? 1.1 : 0.9}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: cutting ? 0 : 1 }}
          transition={cutting ? { duration: 0.45, ease: PEN } : { duration: delay ? 1.8 : 0.9, delay, ease: PEN }}
          onAnimationComplete={() => cutting && deleteElements({ edges: [{ id }] })}
          style={{ transition: "stroke 0.4s, stroke-width 0.4s" }}
        />

        {/* terminals: open ring at source, filled bead at target */}
        <circle cx={sourceX} cy={sourceY} r={2} fill="var(--paper)" stroke="var(--ink-faint)" strokeWidth={0.8} />
        <motion.circle
          cx={targetX}
          cy={targetY}
          r={2.2}
          fill={running ? "var(--accent)" : "var(--ink-soft)"}
          initial={{ opacity: 0 }}
          animate={{ opacity: cutting ? 0 : 1 }}
          transition={{ delay: cutting ? 0 : delay + 1.6, duration: 0.6 }}
        />

      </motion.g>

      <EdgeLabelRenderer>
        <motion.div
          className="nodrag nopan absolute flex flex-col items-center gap-1.5"
          style={{ transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 6}px)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: cutting ? 0 : dimmed ? 0.2 : 1 }}
          transition={{ delay: cutting || dimmed ? 0 : delay + 1.4, duration: cutting ? 0.3 : 0.8 }}
        >
          <AnimatePresence>
            {selected && !cutting && (
              <motion.button
                key="cut"
                onClick={() => setCutting(true)}
                aria-label="Cut link"
                title="Cut link  (⌫)"
                className="pointer-events-auto flex h-5 cursor-pointer items-center gap-1.5 border border-accent/30 bg-[#0c0c0b]/90 px-2 font-mono text-[8px] uppercase tracking-[0.24em] text-accent transition-colors hover:border-accent hover:shadow-[0_0_10px_var(--accent-glow)]"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.25 }}
              >
                <svg width="7" height="7" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1" aria-hidden>
                  <path d="M1 1l6 6M7 1L1 7" />
                </svg>
                cut
              </motion.button>
            )}
          </AnimatePresence>
          {data?.label && (
            <span
              className={`pointer-events-none font-mono text-[8px] uppercase tracking-[0.24em] transition-colors duration-700 ${
                running || selected ? "text-accent/80" : lit ? "text-ink-soft" : "text-ink-faint"
              }`}
            >
              {data.label}
            </span>
          )}
        </motion.div>
      </EdgeLabelRenderer>
    </>
  );
}
