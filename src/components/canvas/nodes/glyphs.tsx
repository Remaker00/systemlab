"use client";

import type { NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { LabNode } from "@/lib/graph";
import { useIsDown, useLab, useScaled } from "../LabContext";
import { Ink, NodeFrame } from "./NodeFrame";
import { Readout, type ReadoutLine } from "./Readout";


/*
 * Each glyph is drawn in a 120×120 viewBox using a technical-drawing
 * vocabulary: solid lines for visible edges, dotted faint lines for hidden
 * edges (as in orthographic drafting), and a single amber accent for life.
 */

const circle = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;

const figure = (cx: number, cy: number, s = 1) =>
  `${circle(cx, cy, 6 * s)} M ${cx - 13 * s} ${cy + 24 * s} Q ${cx} ${cy + 4 * s} ${cx + 13 * s} ${cy + 24 * s}`;

// ───────────────────────────── Users ─────────────────────────────

const ORBIT = "M 10 66 A 50 20 0 1 0 110 66 A 50 20 0 1 0 10 66";

export function UsersNode(props: NodeProps<LabNode>) {
  const { running, metrics, fault } = useLab();
  const scaled = useScaled();
  const spiking = fault?.kind === "spike";
  const readout = metrics.total > 0 && (
    <Readout
      lines={[
        { label: "out", value: scaled.rate(metrics.rps), tone: spiking ? "fault" : undefined },
        { label: "sent", value: scaled.count(metrics.total) },
      ]}
    />
  );
  return (
    <NodeFrame node={props} delay={0.2} hasSource readout={readout} alarm={running && spiking}>
      <Ink d={ORBIT} faint strokeDasharray="1 4" delay={0.2} duration={2} />
      <Ink d={figure(34, 56, 0.8)} faint delay={0.6} />
      <Ink d={figure(86, 56, 0.8)} faint delay={0.75} />
      <Ink d={figure(60, 44)} delay={0.4} />
      {running && (
        <>
          <OrbitDot dur="5s" begin="0s" />
          <OrbitDot dur="5s" begin="-1.7s" />
          <OrbitDot dur="5s" begin="-3.4s" />
        </>
      )}
    </NodeFrame>
  );
}

function OrbitDot({ dur, begin }: { dur: string; begin: string }) {
  return (
    <circle r="1.6" fill="var(--accent)" filter="url(#sl-glow)">
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={ORBIT} />
    </circle>
  );
}

// ──────────────────────────── API Server ────────────────────────────
// An isometric rack: three tiers, status LEDs on the left face.

const TIERS = [0, 17, 34];

/** Load gauge, queue, capacity and health for a capacity-bound compute node (API servers, workers). */
function useServerReadout(id: string) {
  const { running, metrics } = useLab();
  const stats = metrics.loads[id];
  const scaled = useScaled();
  const down = useIsDown(id);
  const overloaded = running && !down && !!stats?.overloaded;
  const readout = metrics.total > 0 && stats && (
    <Readout
      load={stats.load}
      lines={[
        {
          label: "load",
          value: `${Math.round(stats.load * 100)}%`,
          tone: stats.load >= 1 ? "fault" : stats.load >= 0.75 ? "accent" : undefined,
        },
        { label: "queue", value: scaled.count(stats.queue), tone: stats.queue > 0 ? "accent" : undefined },
        { label: "cap", value: scaled.rate(stats.capacity) },
        down ? { label: "health", value: "down", tone: "fault" } : health(stats.load, overloaded),
      ]}
    />
  );
  return { readout, overloaded, down };
}

export function ApiNode(props: NodeProps<LabNode>) {
  const { running } = useLab();
  const { readout, overloaded, down } = useServerReadout(props.id);
  return (
    <NodeFrame node={props} delay={0.5} hasSource hasTarget readout={readout} alarm={overloaded} down={down}>
      {/* hidden edges */}
      <Ink d="M 24 86 L 60 72 L 96 86 M 60 20 L 60 72" faint strokeDasharray="1 3" delay={0.9} />
      {/* visible silhouette */}
      <Ink d="M 60 20 L 96 34 L 60 48 L 24 34 Z" delay={0.6} />
      <Ink d="M 24 34 L 24 86 L 60 100 L 96 86 L 96 34 M 60 48 L 60 100" delay={0.8} duration={1.6} />
      {/* tier seams */}
      {TIERS.slice(1).map((k, i) => (
        <Ink key={k} d={`M 24 ${34 + k} L 60 ${48 + k} L 96 ${34 + k}`} faint delay={1.1 + i * 0.15} />
      ))}
      {/* vent lines on the right face */}
      {TIERS.map((k, i) => (
        <Ink key={`v${k}`} d={`M 70 ${50 + k} L 86 ${44 + k}`} faint delay={1.3 + i * 0.1} duration={0.6} />
      ))}
      {/* LEDs */}
      {TIERS.map((k, i) => (
        <motion.circle
          key={`led${k}`}
          cx={31}
          cy={43 + k}
          r={1.5}
          initial={{ opacity: 0 }}
          animate={
            overloaded
              ? { opacity: [0.2, 1, 0.2], fill: "var(--fault)" }
              : running
                ? { opacity: [0.35, 1, 0.35], fill: "var(--accent)" }
                : { opacity: 0.5, fill: "var(--ink-soft)" }
          }
          transition={
            overloaded
              ? { duration: 0.28 + i * 0.07, repeat: Infinity, ease: "easeInOut" }
              : running
                ? { duration: 0.9 + i * 0.35, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }
                : { duration: 0.6, delay: 1.6 + i * 0.1 }
          }
          filter={running ? "url(#sl-glow)" : undefined}
        />
      ))}
    </NodeFrame>
  );
}

/** One-word server health, read off utilisation. */
function health(load: number, overloaded: boolean): ReadoutLine {
  if (overloaded) return { label: "health", value: "overload", tone: "fault" };
  if (load >= 0.75) return { label: "health", value: "strained", tone: "accent" };
  if (load === 0) return { label: "health", value: "idle" };
  return { label: "health", value: "ok" };
}

// ─────────────────────────── Load Balancer ───────────────────────────
// A hub with one way in and a fan of ports out. The needle steps between ports in turn,
// which is round-robin in a single image.

const PORTS = [
  { d: "M 73 50 L 102 30", end: [104, 29] },
  { d: "M 76 60 L 106 60", end: [108, 60] },
  { d: "M 73 70 L 102 90", end: [104, 91] },
] as const;

export function LoadBalancerNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  // no readout: its fan of outgoing links occupies that side, and the particles already show the split
  const inbound = metrics.arrivals[props.id] ?? 0;
  return (
    <NodeFrame node={props} delay={0.1} hasSource hasTarget>
      {/* sweep range of the selector */}
      <Ink d="M 72 30 A 34 34 0 0 1 72 90" faint strokeDasharray="1 3" delay={0.5} />
      {/* inbound stub + hub */}
      <Ink d="M 10 60 L 32 60" delay={0.1} duration={0.6} />
      <Ink d={circle(54, 60, 22)} delay={0.3} />
      <Ink d={circle(54, 60, 2)} delay={0.8} duration={0.4} />
      {/* ports */}
      {PORTS.map((p, i) => (
        <g key={i}>
          <Ink d={p.d} delay={0.6 + i * 0.12} duration={0.7} />
          <Ink d={circle(p.end[0], p.end[1], 2.4)} faint delay={0.9 + i * 0.12} duration={0.5} />
        </g>
      ))}
      {/* selector needle; the transparent counterweight centres its box on the hub so it rotates in place */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={
          running && inbound > 0
            ? { opacity: 1, rotate: [-34, -34, 0, 0, 34, 34, -34] }
            : { opacity: 1, rotate: 0 }
        }
        transition={
          running && inbound > 0
            ? { rotate: { duration: 0.9, repeat: Infinity, ease: "linear", times: [0, 0.3, 0.33, 0.63, 0.66, 0.96, 1] } }
            : { opacity: { delay: 1, duration: 0.5 }, rotate: { duration: 0.4 } }
        }
      >
        <line x1={38} y1={60} x2={54} y2={60} stroke="transparent" />
        <line
          x1={54}
          y1={60}
          x2={70}
          y2={60}
          stroke={running ? "var(--accent)" : "var(--ink)"}
          strokeWidth={1}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          filter={running ? "url(#sl-glow)" : undefined}
        />
      </motion.g>
    </NodeFrame>
  );
}

// ───────────────────────────── Redis ─────────────────────────────
// A thin memory slab whose top face is a grid of key cells. Lit cells track the hit rate.
// The small clock is the TTL: its hand turns once per TTL while the cache runs.

const SLAB = { A: [60, 28], B: [100, 44], C: [60, 60], D: [20, 44] } as const;
const GRID = 4;
const onSlab = (u: number, v: number) => [
  SLAB.A[0] + u * (SLAB.B[0] - SLAB.A[0]) + v * (SLAB.D[0] - SLAB.A[0]),
  SLAB.A[1] + u * (SLAB.B[1] - SLAB.A[1]) + v * (SLAB.D[1] - SLAB.A[1]),
];
const SLAB_LINES = Array.from({ length: GRID - 1 }, (_, i) => {
  const k = (i + 1) / GRID;
  const [a1, a2] = onSlab(k, 0);
  const [b1, b2] = onSlab(k, 1);
  const [c1, c2] = onSlab(0, k);
  const [d1, d2] = onSlab(1, k);
  return `M ${a1} ${a2} L ${b1} ${b2} M ${c1} ${c2} L ${d1} ${d2}`;
}).join(" ");
// cells in a scattered (not row-by-row) order, so a partial grid looks like a real cache
const CELLS = [5, 10, 0, 15, 6, 3, 12, 9, 1, 14, 7, 4, 11, 2, 13, 8].map((i) =>
  onSlab((Math.floor(i / GRID) + 0.5) / GRID, ((i % GRID) + 0.5) / GRID),
);

/** Hit rate, what still goes past the cache, hit/miss speed and TTL (Redis and the CDN). */
function useCacheReadout(id: string, ttl: number, behind: string) {
  const { metrics } = useLab();
  const stats = metrics.caches[id];
  const scaled = useScaled();
  const readout = metrics.total > 0 && stats && stats.lookups > 0 && (
    <Readout
      lines={[
        { label: "hit", value: `${Math.round(stats.hitRate * 100)}%`, tone: "accent" },
        // what still reaches what's behind it, and how much the cache took off it
        {
          label: behind,
          value: `${scaled.rate(stats.lookups * (1 - stats.hitRate))} · −${Math.round(stats.hitRate * 100)}%`,
        },
        { label: "speed", value: `${fmtMs(stats.hitMs)} / ${fmtMs(stats.missMs)}` },
        { label: "ttl", value: `${ttl}s` },
      ]}
    />
  );
  return { readout, hitRate: stats?.hitRate ?? 0 };
}

export function CacheNode(props: NodeProps<LabNode>) {
  const { running } = useLab();
  const ttl = props.data.ttl ?? 0;
  const { readout, hitRate } = useCacheReadout(props.id, ttl, "to db");
  const lit = Math.round(hitRate * CELLS.length);
  return (
    <NodeFrame node={props} delay={0.1} hasSource hasTarget readout={readout}>
      {/* hidden underside */}
      <Ink d="M 20 56 L 60 40 L 100 56" faint strokeDasharray="1 3" delay={0.7} />
      {/* top face, grid, edges */}
      <Ink d={`M ${SLAB.A.join(" ")} L ${SLAB.B.join(" ")} L ${SLAB.C.join(" ")} L ${SLAB.D.join(" ")} Z`} delay={0.2} />
      <Ink d={SLAB_LINES} faint delay={0.6} duration={1} />
      <Ink d="M 20 44 L 20 56 L 60 72 L 100 56 L 100 44 M 60 60 L 60 72" delay={0.4} duration={1.2} />
      {/* key cells */}
      {CELLS.map(([cx, cy], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={1.3}
          initial={{ opacity: 0 }}
          animate={
            running && i < lit
              ? { opacity: [0.5, 1, 0.5], fill: "var(--accent)" }
              : { opacity: 0.35, fill: "var(--ink-soft)" }
          }
          transition={
            running && i < lit
              ? { duration: 0.8 + (i % 5) * 0.23, repeat: Infinity, ease: "easeInOut", delay: (i % 7) * 0.11 }
              : { duration: 0.5, delay: running ? 0 : 1 + i * 0.03 }
          }
          filter={running && i < lit ? "url(#sl-glow)" : undefined}
        />
      ))}
      {/* TTL clock */}
      <Ink d={circle(60, 94, 10)} faint delay={0.9} />
      <Ink d="M 60 84 L 60 86 M 70 94 L 68 94 M 60 104 L 60 102 M 50 94 L 52 94" faint delay={1.1} duration={0.4} />
      <motion.g
        key={running ? `run-${ttl}` : "idle"}
        animate={running && ttl ? { rotate: 360 } : { rotate: 0 }}
        transition={running && ttl ? { duration: ttl, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}
      >
        {/* transparent counterweight centres the box on the clock's middle */}
        <line x1={60} y1={94} x2={60} y2={102} stroke="transparent" />
        <line
          x1={60}
          y1={94}
          x2={60}
          y2={86}
          stroke={running ? "var(--accent)" : "var(--ink-soft)"}
          strokeWidth={1}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </motion.g>
    </NodeFrame>
  );
}

const fmtMs = (ms: number) => (ms < 10 ? `${ms.toFixed(1)}` : `${Math.round(ms)}`) + "ms";

// ──────────────────────────── Database ────────────────────────────

const BANDS = [50, 70];

/** Arrivals, and capacity/health when the sheet gives the store a capacity (databases, replicas). */
function useStoreReadout(id: string) {
  const { running, metrics } = useLab();
  const scaled = useScaled();
  const down = useIsDown(id);
  // a database only queues (and can overload) when the sheet gives it a capacity
  const stats = metrics.loads[id];
  const overloaded = running && !down && !!stats?.overloaded;
  const readout = metrics.total > 0 && (
    <Readout
      load={stats?.load}
      lines={[
        { label: "in", value: scaled.rate(metrics.arrivals[id] ?? 0) },
        ...(stats ? [{ label: "cap", value: scaled.rate(stats.capacity) }] : []),
        ...(down
          ? [{ label: "state", value: "down", tone: "fault" as const }]
          : stats
            ? [health(stats.load, overloaded)]
            : []),
      ]}
    />
  );
  return { readout, overloaded, down };
}

export function DatabaseNode(props: NodeProps<LabNode>) {
  const { running, workshop } = useLab();
  const { readout, overloaded, down } = useStoreReadout(props.id);
  return (
    // in the workshop a primary can feed replicas, so it gains a way out
    <NodeFrame node={props} delay={0.8} hasTarget hasSource={workshop} readout={readout} down={down} alarm={overloaded}>
      {/* hidden back half of the base */}
      <Ink d="M 26 92 A 34 10 0 0 1 94 92" faint strokeDasharray="1 3" delay={1.2} />
      {/* top ellipse + walls + base */}
      <Ink d="M 26 28 A 34 10 0 1 0 94 28 A 34 10 0 1 0 26 28" delay={0.9} />
      <Ink d="M 26 28 L 26 92 A 34 10 0 0 0 94 92 L 94 28" delay={1.05} duration={1.6} />
      {/* platter bands */}
      {BANDS.map((y, i) => (
        <Ink key={y} d={`M 26 ${y} A 34 10 0 0 0 94 ${y}`} faint delay={1.3 + i * 0.15} />
      ))}
      {/* write pulse: a band of accent that sweeps down the platters while running */}
      {running &&
        !down &&
        BANDS.concat(92).map((y, i) => (
          <motion.path
            key={`p${y}`}
            d={`M 26 ${y} A 34 10 0 0 0 94 ${y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            filter="url(#sl-glow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, repeatDelay: 0.6, ease: "easeInOut" }}
          />
        ))}
    </NodeFrame>
  );
}

// ─────────────────────────── API Gateway ───────────────────────────
// An arched gateway with a boom barrier across the opening. The barrier lifts while traffic is let through.

export function GatewayNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  const scaled = useScaled();
  const inbound = metrics.arrivals[props.id] ?? 0;
  const open = running && inbound > 0;
  const readout = metrics.total > 0 && <Readout lines={[{ label: "in", value: scaled.rate(inbound) }]} />;
  return (
    <NodeFrame node={props} delay={0.1} hasSource hasTarget readout={readout}>
      {/* ground, and the depth of the arch as hidden lines */}
      <Ink d="M 10 98 L 110 98" faint delay={0.1} />
      <Ink d="M 24 42 L 32 36 M 96 42 L 88 36" faint strokeDasharray="1 3" delay={0.8} />
      {/* outer and inner arch */}
      <Ink d="M 24 98 L 24 42 Q 60 6 96 42 L 96 98" delay={0.2} duration={1.6} />
      <Ink d="M 36 98 L 36 50 Q 60 24 84 50 L 84 98" delay={0.5} duration={1.4} />
      {/* keystone */}
      <Ink d="M 55 26 L 57 18 L 63 18 L 65 26" faint delay={1} duration={0.6} />
      {/* barrier post */}
      <Ink d="M 30 98 L 30 74" delay={0.9} duration={0.5} />
      {/* the boom pivots on its post: lifted while requests pass, down when idle */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, rotate: open ? -58 : 0 }}
        transition={{ opacity: { delay: 1.1, duration: 0.5 }, rotate: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
        style={{ transformBox: "view-box", transformOrigin: "30px 74px" }}
      >
        <line x1={30} y1={74} x2={90} y2={74} stroke={open ? "var(--accent)" : "var(--ink)"} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        {[42, 54, 66, 78].map((x) => (
          <line key={x} x1={x} y1={72} x2={x + 4} y2={76} stroke="var(--ink-faint)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
        ))}
      </motion.g>
      <circle cx={30} cy={74} r={1.8} fill={open ? "var(--accent)" : "var(--ink-soft)"} filter={open ? "url(#sl-glow)" : undefined} />
    </NodeFrame>
  );
}

// ─────────────────────────────── CDN ───────────────────────────────
// A wire globe with edge locations on it. Lit locations track the hit rate.

const POPS = [
  [44, 40],
  [76, 46],
  [36, 66],
  [64, 72],
  [84, 64],
  [56, 52],
] as const;

export function CdnNode(props: NodeProps<LabNode>) {
  const { running } = useLab();
  const ttl = props.data.ttl ?? 0;
  const { readout, hitRate } = useCacheReadout(props.id, ttl, "origin");
  const lit = Math.round(hitRate * POPS.length);
  return (
    <NodeFrame node={props} delay={0.1} hasSource hasTarget readout={readout}>
      <Ink d={circle(60, 58, 36)} delay={0.2} duration={1.6} />
      {/* meridian, and the equator's hidden back half */}
      <Ink d="M 60 22 A 15 36 0 1 0 60 94 A 15 36 0 1 0 60 22" faint delay={0.6} />
      <Ink d="M 24 58 A 36 9 0 0 0 96 58" faint delay={0.7} />
      <Ink d="M 24 58 A 36 9 0 0 1 96 58" faint strokeDasharray="1 3" delay={0.8} />
      <Ink d="M 31 38 A 30 6 0 0 0 89 38 M 31 78 A 30 6 0 0 0 89 78" faint delay={0.9} />
      {POPS.map(([cx, cy], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={1.8}
          initial={{ opacity: 0 }}
          animate={
            running && i < lit
              ? { opacity: [0.5, 1, 0.5], fill: "var(--accent)" }
              : { opacity: 0.5, fill: "var(--ink-soft)" }
          }
          transition={
            running && i < lit
              ? { duration: 0.9 + i * 0.2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.5, delay: running ? 0 : 1.1 + i * 0.08 }
          }
          filter={running && i < lit ? "url(#sl-glow)" : undefined}
        />
      ))}
    </NodeFrame>
  );
}

// ────────────────────────────── Queue ──────────────────────────────
// An open tray of slots. Filled slots show how close the queue is to refusing jobs.

const SLOTS = 6;
const SLOT_W = 94 / SLOTS;

export function QueueNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  const scaled = useScaled();
  const stats = metrics.queues[props.id];
  const full = running && !!stats?.full;
  const filled = stats && stats.depth > 0 ? Math.max(1, Math.ceil(stats.fill * SLOTS)) : 0;
  const readout = metrics.total > 0 && stats && (
    <Readout
      lines={[
        { label: "depth", value: scaled.count(stats.depth), tone: full ? "fault" : stats.depth > 0 ? "accent" : undefined },
        { label: "in", value: scaled.rate(stats.inRate) },
        { label: "out", value: scaled.rate(stats.outRate) },
        full
          ? { label: "state", value: "full", tone: "fault" }
          : { label: "wait", value: stats.lagS < 0.05 ? "none" : `${stats.lagS.toFixed(1)}s`, tone: stats.lagS > 2 ? "accent" : undefined },
        // jobs that failed after the caller was told "accepted": invisible to users, so shown here
        ...(stats.failed > 0 ? [{ label: "lost", value: scaled.rate(stats.failed), tone: "fault" as const }] : []),
      ]}
    />
  );
  return (
    <NodeFrame node={props} delay={0.1} hasSource hasTarget readout={readout} alarm={full}>
      {/* the tray: front face, top edge and side, with the far edge hidden */}
      <Ink d="M 8 54 L 102 54 L 102 76 L 8 76 Z" delay={0.2} />
      <Ink d="M 8 54 L 18 46 L 112 46 L 102 54 M 102 76 L 112 68 L 112 46" delay={0.4} duration={1.2} />
      <Ink d="M 18 46 L 18 68 L 8 76 M 18 68 L 112 68" faint strokeDasharray="1 3" delay={0.7} />
      {Array.from({ length: SLOTS - 1 }, (_, i) => (
        <Ink key={i} d={`M ${8 + SLOT_W * (i + 1)} 54 L ${8 + SLOT_W * (i + 1)} 76`} faint delay={0.8 + i * 0.06} duration={0.5} />
      ))}
      {/* first in, first out */}
      <Ink d="M 8 92 L 104 92 M 98 88 L 104 92 L 98 96" faint delay={1.1} />
      {/* jobs: fill from the front of the queue (the right, where workers take them) */}
      {Array.from({ length: SLOTS }, (_, i) => {
        const on = i >= SLOTS - filled;
        return (
          <motion.rect
            key={i}
            x={8 + SLOT_W * i + 3}
            y={58}
            width={SLOT_W - 6}
            height={14}
            initial={{ opacity: 0 }}
            animate={{ opacity: on ? 0.85 : 0, fill: full ? "var(--fault)" : "var(--accent)" }}
            transition={{ duration: 0.4 }}
            filter={on ? "url(#sl-glow)" : undefined}
          />
        );
      })}
    </NodeFrame>
  );
}

// ────────────────────────────── Worker ──────────────────────────────
// A gear that turns while it has jobs.

const GEAR = (() => {
  const teeth = 10;
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 < 2 ? 31 : 25;
    pts.push(`${(60 + r * Math.cos(a)).toFixed(1)} ${(56 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
})();

export function WorkerNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  const { readout, overloaded, down } = useServerReadout(props.id);
  const busy = running && !down && (metrics.loads[props.id]?.load ?? 0) > 0;
  return (
    <NodeFrame node={props} delay={0.2} hasSource hasTarget readout={readout} alarm={overloaded} down={down}>
      <Ink d="M 26 100 L 94 100" faint delay={0.1} />
      <Ink d="M 52 100 L 56 87 M 68 100 L 64 87" faint strokeDasharray="1 3" delay={0.9} />
      <motion.g
        animate={busy ? { rotate: 360 } : { rotate: 0 }}
        transition={busy ? { duration: 6, repeat: Infinity, ease: "linear" } : { duration: 0.6 }}
        style={{ transformBox: "view-box", transformOrigin: "60px 56px" }}
      >
        <Ink d={GEAR} delay={0.3} duration={1.8} />
        <Ink d={circle(60, 56, 11)} faint delay={0.8} />
        <Ink d="M 60 45 L 60 67 M 49 56 L 71 56" faint delay={1} duration={0.6} />
      </motion.g>
      <circle cx={60} cy={56} r={2} fill={busy ? (overloaded ? "var(--fault)" : "var(--accent)") : "var(--ink-soft)"} filter={busy ? "url(#sl-glow)" : undefined} />
    </NodeFrame>
  );
}

// ─────────────────────────── Read Replica ───────────────────────────
// The database cylinder traced again in dashes (a copy), with a small sync mark.

export function ReplicaNode(props: NodeProps<LabNode>) {
  const { running } = useLab();
  const { readout, overloaded, down } = useStoreReadout(props.id);
  return (
    <NodeFrame node={props} delay={0.3} hasTarget readout={readout} down={down} alarm={overloaded}>
      <Ink d="M 30 92 A 30 9 0 0 1 90 92" faint strokeDasharray="1 3" delay={0.9} />
      <Ink d="M 30 32 A 30 9 0 1 0 90 32 A 30 9 0 1 0 30 32" delay={0.4} />
      <Ink d="M 30 32 L 30 92 A 30 9 0 0 0 90 92 L 90 32" strokeDasharray="4 3" delay={0.6} duration={1.6} />
      {[52, 72].map((y, i) => (
        <Ink key={y} d={`M 30 ${y} A 30 9 0 0 0 90 ${y}`} faint delay={1 + i * 0.15} />
      ))}
      {/* sync: an arrow chasing its tail */}
      <motion.g
        animate={running && !down ? { rotate: -360 } : { rotate: 0 }}
        transition={running && !down ? { duration: 3, repeat: Infinity, ease: "linear" } : { duration: 0.4 }}
        style={{ transformBox: "view-box", transformOrigin: "100px 14px" }}
      >
        <Ink d="M 107 14 A 7 7 0 1 1 100 7 M 100 7 L 104 4 M 100 7 L 103 10.5" faint delay={1.2} duration={0.8} />
      </motion.g>
    </NodeFrame>
  );
}
