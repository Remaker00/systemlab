"use client";

import { useEdges, useNodes, useReactFlow } from "@xyflow/react";
import { motion, type Variants } from "framer-motion";
import { useMemo } from "react";
import { catalog } from "@/lib/catalog";
import { CAPACITY_STEPS, type LabEdge, type LabNode, type LabNodeType } from "@/lib/graph";

type Props = {
  nodeId: string;
  type: LabNodeType;
  index: string;
};

const list: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.25 } },
  gone: { opacity: 0, transition: { duration: 0.2 } },
};

const row: Variants = {
  hidden: { opacity: 0, x: -4 },
  shown: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * The contextual layer for a focused node: a drafting-style callout that hangs
 * below the object on a leader line. It is a margin note on the drawing, not a modal.
 */
export function FocusNote({ nodeId, type, index }: Props) {
  const spec = catalog[type];
  const links = useLinks(nodeId);
  const capacity = useNodes<LabNode>().find((n) => n.id === nodeId)?.data.capacity;

  return (
    <motion.div
      className="nodrag nopan pointer-events-none absolute left-1/2 top-full z-10 mt-4 w-[232px] cursor-default"
      variants={list}
      initial="hidden"
      animate="shown"
      exit="gone"
    >
      {/* leader line: drops from the title, then the hairline spine of the note */}
      <svg className="absolute -top-4 left-0 overflow-visible" width="1" height="16" aria-hidden>
        <motion.line
          x1="0.5"
          y1="0"
          x2="0.5"
          y2="16"
          stroke="var(--accent)"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </svg>
      <motion.div
        className="absolute left-0 top-0 h-full w-px origin-top bg-ink-faint"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.65, 0, 0.35, 1] }}
      />
      <span className="absolute -left-[2.5px] -top-[2.5px] h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent-glow)]" />

      <div className="flex flex-col gap-2.5 bg-gradient-to-r from-[#0c0c0b]/90 via-[#0c0c0b]/70 to-transparent py-1 pl-4">
        <motion.div variants={row} className="font-mono text-[8px] uppercase tracking-[0.26em] text-accent/80">
          N°{index} — {spec.role}
        </motion.div>

        <motion.p variants={row} className="font-serif text-[13.5px] leading-snug text-ink/85 italic">
          {spec.summary}
        </motion.p>

        <motion.dl variants={row} className="flex flex-col gap-1 font-mono text-[9px] tracking-[0.08em]">
          {spec.properties.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="text-ink-faint">{label}</dt>
              <span className="flex-1 translate-y-[-2px] border-b border-dotted border-white/10" />
              <dd className="text-ink-soft">{value}</dd>
            </div>
          ))}
          {capacity !== undefined && <CapacityRow nodeId={nodeId} capacity={capacity} />}
        </motion.dl>

        <motion.div variants={row} className="flex flex-col gap-1 font-mono text-[9px] tracking-[0.08em]">
          <LinkRow direction="in" names={links.inbound} />
          <LinkRow direction="out" names={links.outbound} />
        </motion.div>

        <motion.div variants={row} className="flex gap-2 pt-0.5 font-mono text-[8.5px] leading-relaxed tracking-[0.06em] text-ink-faint">
          <span className="text-accent/70">△</span>
          <span>{spec.fragility}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** The one tunable in the note: how many requests/s this node can serve. */
function CapacityRow({ nodeId, capacity }: { nodeId: string; capacity: number }) {
  const { updateNodeData } = useReactFlow<LabNode, LabEdge>();
  const i = CAPACITY_STEPS.findIndex((c) => c >= capacity);
  const step = (d: -1 | 1) => {
    const next = CAPACITY_STEPS[Math.min(CAPACITY_STEPS.length - 1, Math.max(0, i + d))];
    if (next !== capacity) updateNodeData(nodeId, { capacity: next });
  };
  const btn =
    "pointer-events-auto flex h-4 w-4 cursor-pointer items-center justify-center border border-white/10 text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-ink-soft";
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <dt className="text-accent/80">capacity</dt>
      <span className="flex-1 translate-y-[-2px] border-b border-dotted border-accent/20" />
      <dd className="flex items-center gap-1.5">
        <button className={btn} onClick={() => step(-1)} disabled={i <= 0} aria-label="Lower capacity">
          −
        </button>
        <motion.span
          key={capacity}
          className="w-10 text-center tabular-nums text-ink"
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {capacity}/s
        </motion.span>
        <button
          className={btn}
          onClick={() => step(1)}
          disabled={i >= CAPACITY_STEPS.length - 1}
          aria-label="Raise capacity"
        >
          +
        </button>
      </dd>
    </div>
  );
}

function LinkRow({ direction, names }: { direction: "in" | "out"; names: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="w-6 text-ink-faint uppercase">{direction}</span>
      <span className="text-ink-faint">{direction === "in" ? "←" : "→"}</span>
      <span className={names.length ? "text-ink-soft" : "text-ink-faint/60"}>
        {names.length ? names.join(", ") : "nothing"}
      </span>
    </div>
  );
}

/** Live inbound/outbound neighbours, so the note updates as links are drawn or cut. */
function useLinks(nodeId: string) {
  const edges = useEdges<LabEdge>();
  const nodes = useNodes<LabNode>();
  return useMemo(() => {
    const title = (id: string) => nodes.find((n) => n.id === id)?.data.title ?? id;
    return {
      inbound: edges.filter((e) => e.target === nodeId).map((e) => title(e.source)),
      outbound: edges.filter((e) => e.source === nodeId).map((e) => title(e.target)),
    };
  }, [edges, nodes, nodeId]);
}
