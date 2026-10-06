"use client";

import type { NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import type { LabNode } from "@/lib/graph";
import { useLab } from "../LabContext";
import { Ink, NodeFrame } from "./NodeFrame";
import { Readout } from "./Readout";

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
  const { running, metrics } = useLab();
  const readout = metrics.total > 0 && (
    <Readout
      lines={[
        { label: "out", value: `${fmt(metrics.rps)}/s` },
        { label: "sent", value: fmt(metrics.total) },
      ]}
    />
  );
  return (
    <NodeFrame node={props} delay={0.2} hasSource readout={readout}>
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
  const overloaded = running && !!stats?.overloaded;
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
        ...(overloaded ? [{ label: "state", value: "overload", tone: "fault" as const }] : []),
      ]}
    />
  );
  return (
    <NodeFrame node={props} delay={0.5} hasSource hasTarget readout={readout} alarm={overloaded}>
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

// ──────────────────────────── Database ────────────────────────────

const BANDS = [50, 70];

export function DatabaseNode(props: NodeProps<LabNode>) {
  const { running, metrics } = useLab();
  const readout = metrics.total > 0 && (
    <Readout lines={[{ label: "in", value: `${fmt(metrics.arrivals[props.id] ?? 0)}/s` }]} />
  );
  return (
    <NodeFrame node={props} delay={0.8} hasTarget readout={readout}>
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
