"use client";

import { ViewportPortal } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  BASELINE_S,
  experimentStage,
  OBSERVE_S,
  scenarioByKind,
  type Experiment,
  type SystemShape,
} from "@/lib/experiments";
import type { History, Sample } from "@/lib/sim/history";

type Props = {
  experiment: Experiment;
  anchor: { x: number; y: number }; // flow position of the target node
  now: number; // current sim time
  history: History;
  shape: SystemShape;
  onChoose: (choice: number) => void;
  onRestore: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE },
};

/**
 * An experiment written into the margin of the drawing, above the part being broken.
 * Its four beats appear on the system's own clock: the failure plays first, and the words come after.
 */
export function ExperimentNote({ experiment, anchor, now, history, shape, onChoose, onRestore }: Props) {
  const scenario = scenarioByKind(experiment.kind);
  const { breakAt, choice } = experiment;
  const stage = experimentStage(experiment, now);
  const broken = stage >= 1;
  const observed = stage >= 2;
  const asking = stage >= 3;
  const explained = stage === 4;

  const before = history.at(breakAt);
  const after = observed ? history.at(breakAt + OBSERVE_S) : undefined;

  return (
    <ViewportPortal>
      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{ transform: `translate(${anchor.x + 140}px, ${anchor.y - 34}px)` }}
      >
        <motion.div
          data-sl-experiment
          className="nodrag nopan nowheel absolute bottom-0 right-0 w-[292px] select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col gap-3 border-r border-fault/40 bg-gradient-to-l from-[#0c0c0b]/95 via-[#0c0c0b]/92 to-[#0c0c0b]/80 py-1 pr-4 text-right">
            <div className="font-mono text-[8px] uppercase tracking-[0.26em] text-fault">
              Experiment {String(experiment.id).padStart(2, "0")} · {scenario.title}
            </div>

            {!broken && (
              <Step n="0" label="Normal">
                <p className="text-ink-soft">Measuring the system before anything breaks…</p>
                <Progress from={breakAt - BASELINE_S} to={breakAt} now={now} tone="ink" />
              </Step>
            )}

            {broken && (
              <motion.div {...reveal}>
                <Step n="1" label="Change">
                  <p className="text-ink">{scenario.change(experiment.traffic)}</p>
                </Step>
              </motion.div>
            )}

            {broken && (
              <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.4 }}>
                <Step n="2" label="Result">
                  {!observed ? (
                    <>
                      <p className="text-ink-faint">Watch the drawing…</p>
                      <Progress from={breakAt} to={breakAt + OBSERVE_S} now={now} tone="fault" />
                    </>
                  ) : (
                    <motion.div className="flex flex-col gap-2" {...reveal}>
                      <Delta before={before} after={after} />
                      <p className="font-serif text-[13px] leading-snug text-ink/85 normal-case italic tracking-normal">
                        {scenario.consequence(shape)}
                      </p>
                    </motion.div>
                  )}
                </Step>
              </motion.div>
            )}

            {asking && (
              <motion.div {...reveal}>
                <Step n="3" label="Your move">
                  <p className="font-serif text-[14px] leading-snug text-ink normal-case italic tracking-normal">
                    {scenario.question}
                  </p>
                  {!explained ? (
                    <div className="mt-1 flex flex-col items-end gap-1.5">
                      {scenario.options.map((o, i) => (
                        <Choice key={o.answer} onClick={() => onChoose(i)}>
                          {o.answer}
                        </Choice>
                      ))}
                      <button
                        onClick={() => onChoose(-1)}
                        className="pointer-events-auto mt-0.5 cursor-pointer text-ink-faint underline decoration-dotted underline-offset-4 transition-colors hover:text-ink-soft"
                      >
                        just explain
                      </button>
                    </div>
                  ) : (
                    choice! >= 0 && <p className="text-accent">— {scenario.options[choice!].answer}</p>
                  )}
                </Step>
              </motion.div>
            )}

            <AnimatePresence>
              {explained && (
                <motion.div key="why" {...reveal}>
                  <Step n="4" label="Why">
                    {choice! >= 0 && <p className="text-ink">{scenario.options[choice!].reply}</p>}
                    <p className="text-ink-soft">{scenario.why}</p>
                  </Step>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={onRestore}
              className="pointer-events-auto cursor-pointer self-end font-mono text-[8px] uppercase tracking-[0.26em] text-ink-faint transition-colors hover:text-accent"
            >
              ↺ restore the system
            </button>
          </div>

          {/* leader: from the note's corner down to the part being broken */}
          <svg className="absolute -bottom-[34px] right-0 overflow-visible" width="1" height="34" aria-hidden>
            <motion.line
              x1="0.5"
              y1="0"
              x2="0.5"
              y2="30"
              stroke="var(--fault)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4 }}
            />
            <circle cx="0.5" cy="31" r="2" fill="var(--fault)" filter="url(#sl-glow)" />
          </svg>
        </motion.div>
      </div>
    </ViewportPortal>
  );
}

function Step({ n, label, children }: { n: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-[9px] leading-relaxed tracking-[0.04em]">
      <div className="flex items-center justify-end gap-2 text-[8px] uppercase tracking-[0.26em] text-ink-faint">
        <span>{label}</span>
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink-faint/60 text-[7px] tracking-normal">
          {n}
        </span>
      </div>
      {children}
    </div>
  );
}

function Choice({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group pointer-events-auto flex cursor-pointer items-center gap-2 text-ink-soft transition-colors hover:text-ink"
    >
      <span>{children}</span>
      <span className="h-px w-3 bg-ink-faint transition-all duration-300 group-hover:w-6 group-hover:bg-accent" />
    </button>
  );
}

/** A hairline that fills as sim time passes, so the waiting has a visible end. */
function Progress({ from, to, now, tone }: { from: number; to: number; now: number; tone: "ink" | "fault" }) {
  const k = Math.min(1, Math.max(0, (now - from) / (to - from)));
  return (
    <div className="relative ml-auto h-px w-full bg-white/[0.06]">
      <motion.div
        className={`absolute right-0 top-0 h-px ${tone === "fault" ? "bg-fault" : "bg-ink-soft"}`}
        animate={{ width: `${k * 100}%` }}
        transition={{ duration: 0.15, ease: "linear" }}
      />
    </div>
  );
}

/** Before → after, measured: the visible consequence in numbers. */
function Delta({ before, after }: { before?: Sample; after?: Sample }) {
  const rows: { label: string; a?: number; b?: number; fmt: (v: number) => string; bad: (a: number, b: number) => boolean }[] = [
    { label: "rate", a: before?.rps, b: after?.rps, fmt: (v) => `${Math.round(v)}/s`, bad: () => false },
    {
      label: "latency",
      a: before?.latencyMs,
      b: after?.latencyMs,
      fmt: (v) => `${Math.round(v)} ms`,
      bad: (a, b) => b > a * 1.5 + 20,
    },
    {
      label: "errors",
      a: before?.errorRate,
      b: after?.errorRate,
      fmt: (v) => `${Math.round(v * 100)}%`,
      bad: (a, b) => b > a + 0.02,
    },
  ];
  return (
    <div className="flex flex-col gap-0.5 tabular-nums">
      {rows.map(({ label, a, b, fmt, bad }) => (
        <div key={label} className="flex justify-end gap-3">
          <span className="text-ink-faint">{label}</span>
          <span className="w-14 text-ink-soft">{a === undefined ? "—" : fmt(a)}</span>
          <span className="text-ink-faint">→</span>
          <span className={`w-14 ${a !== undefined && b !== undefined && bad(a, b) ? "text-fault" : "text-ink"}`}>
            {b === undefined ? "—" : fmt(b)}
          </span>
        </div>
      ))}
    </div>
  );
}
