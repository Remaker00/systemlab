"use client";

import type { NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { LabNode } from "@/lib/graph";
import { useIsDown, useLab } from "../LabContext";
import { Ink, NodeFrame } from "./NodeFrame";
import { Readout, type ReadoutLine } from "./Readout";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

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
  const spiking = fault?.kind === "spike";
  const readout = metrics.total > 0 && (
    <Readout
      lines={[
        { label: "out", value: `${fmt(metrics.rps)}/s`, tone: spiking ? "fault" : undefined },
        { label: "sent", value: fmt(metrics.total) },
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

export function ApiNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  const stats = metrics.loads[props.id];
  const down = useIsDown(props.id);
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
        { label: "queue", value: fmt(stats.queue), tone: stats.queue > 0 ? "accent" : undefined },
        { label: "cap", value: `${stats.capacity}/s` },
        down ? { label: "health", value: "down", tone: "fault" } : health(stats.load, overloaded),
      ]}
    />
  );
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

export function CacheNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  const stats = metrics.caches[props.id];
  const ttl = props.data.ttl ?? 0;
  const lit = Math.round((stats?.hitRate ?? 0) * CELLS.length);
  const readout = metrics.total > 0 && stats && stats.lookups > 0 && (
    <Readout
      lines={[
        { label: "hit", value: `${Math.round(stats.hitRate * 100)}%`, tone: "accent" },
        // what still reaches the database, and how much the cache took off it
        {
          label: "to db",
          value: `${fmt(stats.lookups * (1 - stats.hitRate))}/s · −${Math.round(stats.hitRate * 100)}%`,
        },
        { label: "speed", value: `${fmtMs(stats.hitMs)} / ${fmtMs(stats.missMs)}` },
        { label: "ttl", value: `${ttl}s` },
      ]}
    />
  );
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

export function DatabaseNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  const down = useIsDown(props.id);
  const readout = metrics.total > 0 && (
    <Readout
      lines={[
        { label: "in", value: `${fmt(metrics.arrivals[props.id] ?? 0)}/s` },
        ...(down ? [{ label: "state", value: "down", tone: "fault" as const }] : []),
      ]}
    />
  );
  return (
    <NodeFrame node={props} delay={0.8} hasTarget readout={readout} down={down}>
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
