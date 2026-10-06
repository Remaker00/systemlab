"use client";

import { motion } from "framer-motion";

export type ReadoutLine = {
  label: string;
  value: string;
  tone?: "accent" | "fault";
};

const TONE = { accent: "text-accent", fault: "text-fault" } as const;

/** A margin annotation of live figures, set in the same tiny mono as the rest of the sheet. */
export function Readout({ lines, load }: { lines: ReadoutLine[]; load?: number }) {
  return (
    <div className="flex flex-col gap-[3px] font-mono text-[8px] uppercase tracking-[0.16em]">
      {load !== undefined && <LoadGauge load={load} />}
      {lines.map(({ label, value, tone }) => (
        <div key={label} className="flex gap-2">
          <span className="w-9 text-ink-faint">{label}</span>
          <span className={`tabular-nums ${tone ? TONE[tone] : "text-ink-soft"}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

/** A hairline gauge with a tick at 100%. Past capacity, the overflow spills beyond the tick in fault red. */
export function LoadGauge({ load, width = 56 }: { load: number; width?: number }) {
  const W = width; // gauge length at 100%
  const within = Math.min(load, 1) * W;
  const over = Math.min(Math.max(load - 1, 0), 1) * W * 0.5;
  const tone = load >= 1 ? "var(--fault)" : load >= 0.75 ? "var(--accent)" : "var(--ink-soft)";
  return (
    <div className="relative mb-1 h-[5px]" style={{ width: W * 1.5 }}>
      <div className="absolute top-[2px] h-px bg-white/10" style={{ width: W }} />
      <div className="absolute -top-px h-[7px] w-px bg-ink-faint" style={{ left: W }} />
      <motion.div
        className="absolute top-[2px] h-px"
        style={{ background: tone }}
        animate={{ width: within }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <motion.div
        className="absolute top-[1.5px] h-[2px] bg-fault shadow-[0_0_6px_var(--fault-glow)]"
        style={{ left: W }}
        animate={{ width: over }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}
