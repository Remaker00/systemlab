"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { TRAFFIC_STEPS } from "@/lib/graph";

type Props = {
  running: boolean;
  onRun: () => void;
  onReset: () => void;
  /** requests/s emitted by Users */
  traffic: number;
  onTraffic: (rps: number) => void;
};

/** The only chrome on the page: a hairline instrument strip at the bottom. */
export function CanvasControls({ running, onRun, onReset, traffic, onTraffic }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <motion.div
      className="absolute bottom-6 left-1/2 sm:bottom-8 z-10 flex -translate-x-1/2 items-center gap-1 border border-white/[0.06] bg-[#0e0e0d]/80 px-2 py-1.5 backdrop-blur-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.2, duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <Button onClick={onRun} label={running ? "Pause" : "Run"} active={running}>
        <span className="relative flex h-2 w-2 items-center justify-center">
          {running && <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />}
          <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-accent shadow-[0_0_8px_var(--accent-glow)]" : "border border-ink-soft"}`} />
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={running ? "pause" : "run"}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.2 }}
          >
            {running ? "Pause" : "Run"}
          </motion.span>
        </AnimatePresence>
      </Button>

      <Button onClick={onReset} label="Reset">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="0.9">
          <path d="M8.5 5a3.5 3.5 0 1 1-1-2.5M8.5 1v2h-2" strokeLinecap="round" />
        </svg>
        Reset
      </Button>

      <Divider />

      <TrafficControl value={traffic} onChange={onTraffic} running={running} />

      <Divider />

      <Button onClick={() => zoomOut({ duration: 300 })} label="Zoom out" square>
        −
      </Button>
      <button
        onClick={() => fitView({ duration: 700, padding: 0.35 })}
        aria-label="Fit to view"
        title="Fit to view"
        className="w-12 cursor-pointer text-center font-mono text-[9px] tabular-nums tracking-[0.1em] text-ink-faint transition-colors hover:text-ink"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button onClick={() => zoomIn({ duration: 300 })} label="Zoom in" square>
        +
      </Button>
    </motion.div>
  );
}

function Button({
  children,
  onClick,
  label,
  active,
  square,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  square?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 cursor-pointer items-center justify-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] transition-colors duration-300 ${
        square ? "w-7 text-[12px] tracking-normal" : "px-3"
      } ${active ? "text-accent" : "text-ink-soft hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function TrafficControl({ value, onChange, running }: { value: number; onChange: (v: number) => void; running: boolean }) {
  const index = Math.max(0, TRAFFIC_STEPS.findIndex((s) => s >= value));
  return (
    <label className="flex h-7 items-center gap-2.5 px-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint">
      <span>Traffic</span>
      <input
        type="range"
        className="sl-range w-20"
        min={0}
        max={TRAFFIC_STEPS.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(TRAFFIC_STEPS[Number(e.target.value)])}
        aria-label="Traffic volume, requests per second"
        aria-valuetext={`${value} requests per second`}
      />
      <span className={`w-9 tabular-nums tracking-[0.08em] transition-colors ${running ? "text-accent" : "text-ink-soft"}`}>
        {value}/s
      </span>
    </label>
  );
}

function Divider() {
  return <span className="mx-1 h-3.5 w-px bg-white/[0.08]" />;
}
