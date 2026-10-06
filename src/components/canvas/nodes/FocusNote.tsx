"use client";

import { useEdges, useNodes, useReactFlow } from "@xyflow/react";
import { motion, type Variants } from "framer-motion";
import { useMemo } from "react";
import { catalog } from "@/lib/catalog";
import {
  CAPACITY_STEPS,
  HIT_SHARE_STEPS,
  TTL_STEPS,
  type LabEdge,
  type LabNode,
  type LabNodeType,
} from "@/lib/graph";
import { useLab, useScaled } from "../LabContext";
import { LoadGauge } from "./Readout";

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
  const data = useNodes<LabNode>().find((n) => n.id === nodeId)?.data;
  const { locked } = useLab();

  return (
    <motion.div
      data-sl-note
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

      <div className="flex flex-col gap-2.5 bg-gradient-to-r from-[#0c0c0b]/95 via-[#0c0c0b]/92 to-[#0c0c0b]/80 py-1 pl-4">
        <motion.div variants={row} className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent/80">
          N°{index} — {spec.role}
        </motion.div>

        <motion.p variants={row} className="font-sans text-[13.5px] leading-snug text-ink/85">
          {spec.summary}
        </motion.p>

        {spec.why && (
          <motion.div variants={row} className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Why it exists</span>
            <p className="font-mono text-[11px] leading-relaxed tracking-[0.04em] text-ink-soft">{spec.why}</p>
          </motion.div>
        )}

        {type === "loadbalancer" && (
          <motion.div variants={row}>
            <PoolComparison nodeId={nodeId} />
          </motion.div>
        )}

        {type === "cache" && (
          <motion.div variants={row}>
            <CacheInsight nodeId={nodeId} />
          </motion.div>
        )}

        {type === "cdn" && (
          <motion.div variants={row}>
            <CdnInsight nodeId={nodeId} />
          </motion.div>
        )}

        {type === "queue" && (
          <motion.div variants={row}>
            <QueueInsight nodeId={nodeId} />
          </motion.div>
        )}

        <motion.dl variants={row} className="flex flex-col gap-1 font-mono text-[11px] tracking-[0.08em]">
          {spec.properties.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="text-ink-faint">{label}</dt>
              <span className="flex-1 translate-y-[-2px] border-b border-dotted border-white/10" />
              <dd className="text-ink-soft">{value}</dd>
            </div>
          ))}
          {TUNABLES.map(({ field, ...t }) => {
            const value = data?.[field];
            return value === undefined || locked.includes(field) ? null : <StepperRow key={field} nodeId={nodeId} field={field} value={value} {...t} />;
          })}
        </motion.dl>

        <motion.div variants={row} className="flex flex-col gap-1 font-mono text-[11px] tracking-[0.08em]">
          <LinkRow direction="in" names={links.inbound} />
          <LinkRow direction="out" names={links.outbound} />
        </motion.div>

        <motion.div variants={row} className="flex gap-2 pt-0.5 font-mono text-[10.5px] leading-relaxed tracking-[0.06em] text-ink-faint">
          <span className="text-accent/70">△</span>
          <span>{spec.fragility}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

type Tunable = "capacity" | "hitShare" | "ttl";

/** The tunables a node's note offers, in display order. */
const TUNABLES: { field: Tunable; label: string; steps: readonly number[]; format?: (v: number) => string }[] = [
  { field: "capacity", label: "capacity", steps: CAPACITY_STEPS }, // a rate: formatted with the sheet's scale
  { field: "hitShare", label: "hit rate", steps: HIT_SHARE_STEPS, format: (v) => `${Math.round(v * 100)}%` },
  { field: "ttl", label: "ttl", steps: TTL_STEPS, format: (v) => `${v}s` },
];

/** A tunable value in the note, stepped through fixed values with −/+. */
function StepperRow({
  nodeId,
  field,
  label,
  value,
  steps,
  format,
}: {
  nodeId: string;
  field: Tunable;
  label: string;
  value: number;
  steps: readonly number[];
  format?: (v: number) => string;
}) {
  const { updateNodeData } = useReactFlow<LabNode, LabEdge>();
  const scaled = useScaled();
  const show = format ?? scaled.rate;
  const i = steps.findIndex((c) => c >= value);
  const step = (d: -1 | 1) => {
    const next = steps[Math.min(steps.length - 1, Math.max(0, i + d))];
    if (next !== value) updateNodeData(nodeId, { [field]: next });
  };
  const btn =
    "pointer-events-auto flex h-4 w-4 cursor-pointer items-center justify-center border border-white/10 text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-ink-soft";
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <dt className="text-accent/80">{label}</dt>
      <span className="flex-1 translate-y-[-2px] border-b border-dotted border-accent/20" />
      <dd className="flex items-center gap-1.5">
        <button className={btn} onClick={() => step(-1)} disabled={i <= 0} aria-label={`Lower ${label}`}>
          −
        </button>
        <motion.span
          key={value}
          className="w-10 text-center tabular-nums text-ink"
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {show(value)}
        </motion.span>
        <button
          className={btn}
          onClick={() => step(1)}
          disabled={i >= steps.length - 1}
          aria-label={`Raise ${label}`}
        >
          +
        </button>
      </dd>
    </div>
  );
}

/**
 * One live sentence about this cache, chosen from what the simulation is showing right now.
 * Short and contextual: it names the effect on screen, not the theory.
 */
function CacheInsight({ nodeId }: { nodeId: string }) {
  const { metrics, running } = useLab();
  const edges = useEdges<LabEdge>();
  const nodes = useNodes<LabNode>();
  const type = (id: string) => nodes.find((n) => n.id === id)?.type;
  const fed = edges.some((e) => e.target === nodeId);
  const backed = edges.some((e) => e.source === nodeId && type(e.target) === "database");
  const stats = metrics.caches[nodeId];

  let line: string;
  let setup = false;
  if (!fed || !backed) {
    setup = true;
    line = "Route API → Redis → Database, then cut the direct API → Database link so every read asks Redis first.";
  } else if (!running || !stats || stats.lookups === 0) {
    line = "Run it: amber flashes at Redis are hits. Pale requests going on to the database are misses, and the ring coming back stores the answer.";
  } else if (stats.hitShare - stats.hitRate > 0.15) {
    line = `Only ${Math.round(stats.hitRate * 100)}% hit, not ${Math.round(stats.hitShare * 100)}%: entries expire before anyone asks again. Try a longer TTL.`;
  } else if (stats.hitRate >= 0.9) {
    line = "Nearly everything is answered from memory. The database is almost idle.";
  } else {
    line = `${Math.round(stats.hitRate * 100)}% of reads never reach the database. Raise the hit rate and watch the database link go quiet.`;
  }
  return <Insight line={line} setup={setup} />;
}

/** One live sentence, styled as a setup hint (amber rule) or as a reading of what's on screen. */
function Insight({ line, setup }: { line: string; setup: boolean }) {
  return (
    <p
      className={`border-l pl-2 font-mono text-[10.5px] leading-relaxed tracking-[0.06em] ${
        setup ? "border-accent/30 text-accent/80" : "border-white/10 text-ink-soft"
      }`}
    >
      {line}
    </p>
  );
}

function CdnInsight({ nodeId }: { nodeId: string }) {
  const { metrics, running } = useLab();
  const edges = useEdges<LabEdge>();
  const nodes = useNodes<LabNode>();
  const type = (id: string) => nodes.find((n) => n.id === id)?.type;
  const fromUsers = edges.some((e) => e.target === nodeId && type(e.source) === "users");
  const origin = edges.some((e) => e.source === nodeId);
  const stats = metrics.caches[nodeId];

  if (!fromUsers || !origin)
    return <Insight setup line="Put it first in line: Users → CDN → your front door (gateway, balancer or server). Cut Users' other links so every request asks the edge first." />;
  if (!running || !stats || stats.lookups === 0)
    return <Insight setup={false} line="Run it: flashes at the CDN are requests answered at the edge. Only the misses travel on to your servers." />;
  return (
    <Insight
      setup={false}
      line={`${Math.round(stats.hitRate * 100)}% of requests never reach your servers. Raise the hit rate to see how much of the load was static all along.`}
    />
  );
}

function QueueInsight({ nodeId }: { nodeId: string }) {
  const { metrics, running } = useLab();
  const scaled = useScaled();
  const edges = useEdges<LabEdge>();
  const nodes = useNodes<LabNode>();
  const type = (id: string) => nodes.find((n) => n.id === id)?.type;
  const workers = edges.filter((e) => e.source === nodeId && type(e.target) === "worker").length;
  const fed = edges.some((e) => e.target === nodeId);
  const stats = metrics.queues[nodeId];

  if (!fed || !workers)
    return <Insight setup line="Publish to it from an API server, and link it to one or more workers. The caller is answered when the job is stored, not when it's done." />;
  if (!running || !stats || stats.inRate === 0)
    return <Insight setup={false} line="Run it: requests finish here, fast. The jobs wait in the tray until a worker is free." />;
  if (stats.full)
    return <Insight setup={false} line="Full: it holds as much work as it can, so new jobs are refused. Add workers, or make each one faster." />;
  if (stats.inRate > stats.outRate * 1.05)
    return (
      <Insight
        setup={false}
        line={`Jobs arrive at ${scaled.rate(stats.inRate)} and leave at ${scaled.rate(stats.outRate)}. The backlog grows, and every job waits longer than the last.`}
      />
    );
  return <Insight setup={false} line={`Workers keep up: jobs wait ${stats.lagS < 0.05 ? "no time at all" : `${stats.lagS.toFixed(1)}s`}, and callers never feel the slow part.`} />;
}

/**
 * One server versus the pool behind this balancer, at the current traffic.
 * It's simple arithmetic (load = traffic / capacity), so the effect reads before the simulation even runs.
 */
function PoolComparison({ nodeId }: { nodeId: string }) {
  const { traffic } = useLab();
  const scaled = useScaled();
  const edges = useEdges<LabEdge>();
  const nodes = useNodes<LabNode>();

  const pool = edges
    .filter((e) => e.source === nodeId)
    .map((e) => nodes.find((n) => n.id === e.target)?.data.capacity)
    .filter((c): c is number => c !== undefined);
  const fedByUsers = edges.some((e) => e.target === nodeId && nodes.find((n) => n.id === e.source)?.type === "users");

  if (!pool.length || !fedByUsers) {
    return (
      <p className="border-l border-accent/30 pl-2 font-mono text-[10.5px] leading-relaxed tracking-[0.06em] text-accent/80">
        Route Users → Load Balancer, then link it to each API server. Cut the direct Users → API link so every
        request passes through here.
      </p>
    );
  }

  const rows = [
    { label: "1 server", capacity: pool[0] },
    { label: `${pool.length} servers`, capacity: pool.reduce((a, b) => a + b, 0) },
  ];
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[11px] tracking-[0.08em]">
      <span className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">At {scaled.rate(traffic)}</span>
      {rows.map(({ label, capacity }) => {
        const load = traffic / capacity;
        const tone = load >= 1 ? "text-fault" : load >= 0.75 ? "text-accent" : "text-ink-soft";
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="w-16 text-ink-faint">{label}</span>
            <span className="w-14 tabular-nums text-ink-soft">{scaled.rate(capacity)}</span>
            <LoadGauge load={load} width={40} />
            <span className={`tabular-nums ${tone}`}>{Math.round(load * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

function LinkRow({ direction, names }: { direction: "in" | "out"; names: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="w-6 text-ink-faint uppercase">{direction}</span>
      <span className="text-ink-faint">{direction === "in" ? "←" : "→"}</span>
      <span className={names.length ? "text-ink-soft" : "text-ink-faint"}>
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
