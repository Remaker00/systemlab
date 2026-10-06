"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { scenarios } from "@/lib/experiments";
import { TRAFFIC_STEPS, type AddableType } from "@/lib/graph";
import type { FaultKind } from "@/lib/sim/engine";
import { useScaled } from "./LabContext";

type Props = {
  running: boolean;
  onRun: () => void;
  onReset: () => void;
  /** requests/s emitted by Users */
  traffic: number;
  onTraffic: (rps: number) => void;
  /** a challenge trial is driving traffic: the slider shows it but can't be moved */
  trafficLocked?: boolean;
  onAdd: (type: AddableType) => void;
  experimenting: boolean;
  onBreak: (kind: FaultKind) => void;
  onRestore: () => void;
};

/** The only chrome on the page: a hairline instrument strip at the bottom. */
export function CanvasControls({
  running,
  onRun,
  onReset,
  traffic,
  onTraffic,
  trafficLocked = false,
  onAdd,
  experimenting,
  onBreak,
  onRestore,
}: Props) {
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

      <TrafficControl value={traffic} onChange={onTraffic} running={running} locked={trafficLocked} />

      <Divider />

      <Drawer
        label="Add component"
        trigger={
          <>
            <span className="text-[11px] leading-none tracking-normal">+</span>
            Add
          </>
        }
        items={ADDABLE}
        onPick={onAdd}
      />
      <BreakControl experimenting={experimenting} onBreak={onBreak} onRestore={onRestore} />

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
  tone = "accent",
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  square?: boolean;
  tone?: "accent" | "fault";
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 cursor-pointer items-center justify-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] transition-colors duration-300 ${
        square ? "w-7 text-[12px] tracking-normal" : "px-3"
      } ${
        active ? (tone === "fault" ? "text-fault" : "text-accent") : tone === "fault" ? "text-ink-soft hover:text-fault" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function TrafficControl({
  value,
  onChange,
  running,
  locked,
}: {
  value: number;
  onChange: (v: number) => void;
  running: boolean;
  locked: boolean;
}) {
  const scaled = useScaled();
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
        disabled={locked}
        aria-label="Traffic volume, requests per second"
        aria-valuetext={`${scaled.count(value)} requests per second`}
      />
      <span
        className={`min-w-9 tabular-nums tracking-[0.08em] transition-colors ${running ? "text-accent" : "text-ink-soft"}`}
      >
        {scaled.rate(value)}
      </span>
    </label>
  );
}

const ADDABLE: DrawerItem<AddableType>[] = [
  { value: "loadbalancer", label: "Load balancer", note: "spread traffic" },
  { value: "api", label: "API server", note: "add capacity" },
  { value: "cache", label: "Redis", note: "cache reads" },
];

const BREAKABLE: DrawerItem<FaultKind>[] = scenarios.map((s) => ({ value: s.kind, label: s.title, note: s.tag }));

/** Break opens the scenario drawer. While an experiment runs, the same spot restores the system. */
function BreakControl({
  experimenting,
  onBreak,
  onRestore,
}: {
  experimenting: boolean;
  onBreak: (kind: FaultKind) => void;
  onRestore: () => void;
}) {
  if (experimenting) {
    return (
      <Button onClick={onRestore} label="Restore the system">
        <span className="h-1.5 w-1.5 rounded-full bg-fault shadow-[0_0_8px_var(--fault-glow)]" />
        <span className="text-fault">Restore</span>
      </Button>
    );
  }
  return (
    <Drawer
      label="Break the system"
      trigger={
        <>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="0.9" aria-hidden>
            <path d="M5 1 L4 4.5 L6 5.5 L5 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Break
        </>
      }
      items={BREAKABLE}
      onPick={onBreak}
      tone="fault"
      heading="Run an experiment"
    />
  );
}

type DrawerItem<T> = { value: T; label: string; note: string };

/** A small drawer that opens upward out of the strip. Esc or a click elsewhere closes it. */
function Drawer<T extends string>({
  label,
  trigger,
  items,
  onPick,
  tone = "accent",
  heading,
}: {
  label: string;
  trigger: ReactNode;
  items: DrawerItem<T>[];
  onPick: (value: T) => void;
  tone?: "accent" | "fault";
  heading?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const hoverNote = tone === "fault" ? "group-hover:text-fault" : "group-hover:text-accent/80";
  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((o) => !o)} label={label} active={open} tone={tone}>
        {trigger}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={label}
            className="absolute bottom-full left-1/2 mb-4 flex w-56 -translate-x-1/2 flex-col border border-white/[0.06] bg-[#0e0e0d]/90 py-1.5 backdrop-blur-sm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {heading && (
              <span className="px-3 pb-1 pt-0.5 font-mono text-[8px] uppercase tracking-[0.26em] text-ink-faint/70">
                {heading}
              </span>
            )}
            {items.map(({ value, label: itemLabel, note }) => (
              <button
                key={value}
                role="menuitem"
                onClick={() => {
                  onPick(value);
                  setOpen(false);
                }}
                className="group flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="font-serif text-[14px] text-ink/85 italic transition-colors group-hover:text-ink">
                  {itemLabel}
                </span>
                <span className={`font-mono text-[8px] uppercase tracking-[0.2em] text-ink-faint transition-colors ${hoverNote}`}>
                  {note}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-3.5 w-px bg-white/[0.08]" />;
}
