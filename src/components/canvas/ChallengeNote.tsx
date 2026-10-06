"use client";

import { ViewportPortal } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  API_CAPACITY,
  DB_CAPACITY,
  PHASES,
  trialPhase,
  type Trial,
  type TrialResult,
} from "@/lib/challenge";
import { useScaled } from "./LabContext";

type Props = {
  anchor: { x: number; y: number }; // flow position of the Users node
  trial: Trial | null;
  result: TrialResult | null;
  attempts: { attempt: number; total: number }[];
  now: number;
  onStart: () => void;
  onStop: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: 0.6, ease: EASE },
};

/**
 * The challenge, written in the margin to the left of Users: a brief, a live trial log, and a
 * score. It never says what to build: the explanations describe what happened and end in a question.
 */
export function ChallengeNote({ anchor, trial, result, attempts, now, onStart, onStop }: Props) {
  const scaled = useScaled();
  const running = trial !== null && result === null;
  const phase = trial ? trialPhase(trial, now) : null;
  const t = trial ? now - trial.startedAt : 0;

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${anchor.x - 48}px, ${anchor.y - 70}px)` }}>
        <motion.div
          data-sl-challenge
          className="nodrag nopan nowheel absolute right-0 top-0 w-[300px] select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="flex flex-col gap-4 border-r border-accent/30 bg-gradient-to-l from-[#0c0c0b]/95 via-[#0c0c0b]/92 to-[#0c0c0b]/80 py-1 pr-4 text-right font-mono text-[11px] leading-relaxed tracking-[0.04em]">
            <div className="text-[10px] uppercase tracking-[0.16em] text-accent">Challenge 01 · The surge</div>

            <p className="font-sans text-[15px] leading-snug text-ink normal-case tracking-normal">
              Your application handles 1,000 requests a second. Tonight, without warning, it&rsquo;s 10,000.
            </p>

            <div className="flex flex-col gap-1">
              <Label>On the bench</Label>
              <Fact name="one API server" value={scaled.rate(API_CAPACITY)} />
              <Fact name="the database" value={scaled.rate(DB_CAPACITY)} />
              <Fact name="reads that repeat" value="about 80%" />
              <p className="mt-1 text-ink-faint">
                Build between Users and the database with + Add. Run it, push the traffic, break things. When you think
                it&rsquo;s ready, put it on trial.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {running && trial ? (
                <motion.div key="trial" {...reveal} className="flex flex-col gap-2">
                  <Label>Trial {String(trial.attempt).padStart(2, "0")}</Label>
                  {PHASES.map((p) => {
                    const k = Math.min(1, Math.max(0, (t - p.from) / (p.to - p.from)));
                    const active = phase?.key === p.key;
                    return (
                      <div key={p.key} className="flex flex-col gap-1">
                        <span className={active ? "text-ink" : k >= 1 ? "text-ink-soft" : "text-ink-faint"}>
                          {p.label}
                        </span>
                        <div className="relative ml-auto h-px w-full bg-white/[0.06]">
                          <motion.div
                            className={`absolute right-0 top-0 h-px ${p.key === "outage" ? "bg-fault" : "bg-accent"}`}
                            animate={{ width: `${k * 100}%` }}
                            transition={{ duration: 0.15, ease: "linear" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={onStop}
                    className="pointer-events-auto mt-1 cursor-pointer self-end text-[10px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-ink-soft"
                  >
                    stop the trial
                  </button>
                </motion.div>
              ) : result ? (
                <motion.div key={`result-${trial?.attempt}`} {...reveal} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-end gap-3">
                    <span className="font-sans text-[15px] text-ink/85 normal-case tracking-normal">
                      {result.verdict}
                    </span>
                    <motion.span
                      className="font-sans text-[44px] leading-none text-ink tabular-nums"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
                    >
                      {result.total}
                    </motion.span>
                  </div>
                  {result.criteria.map((c, i) => (
                    <motion.div
                      key={c.key}
                      className="flex flex-col gap-1"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.4 + i * 0.15 }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-ink-faint">{c.figure}</span>
                        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">{c.label}</span>
                        <Pips score={c.score} />
                      </div>
                      <p className="text-ink-soft">{c.why}</p>
                      {c.score < 20 && (
                        <p className="font-sans text-[13px] leading-snug text-accent/90 normal-case tracking-normal">
                          {c.question}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {!running && (
              <div className="flex flex-col items-end gap-2">
                {attempts.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-x-3 text-ink-faint">
                    {attempts.map((a) => (
                      <span key={a.attempt}>
                        {String(a.attempt).padStart(2, "0")} · <span className="text-ink-soft">{a.total}</span>
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={onStart}
                  className="group pointer-events-auto flex cursor-pointer items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-accent transition-colors hover:text-ink"
                >
                  {result ? "Change something, try again" : "Put it on trial"}
                  <span className="h-px w-4 bg-accent transition-all duration-300 group-hover:w-8" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </ViewportPortal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">{children}</span>;
}

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-2">
      <span className="text-ink-faint">{name}</span>
      <span className="w-14 translate-y-[-2px] border-b border-dotted border-white/10" />
      <span className="tabular-nums text-ink-soft">{value}</span>
    </div>
  );
}

/** Five marks, filled per 5 points: a drawn tally rather than a progress bar. */
function Pips({ score }: { score: number }) {
  const filled = Math.round(score / 5);
  const tone = score >= 20 ? "bg-accent" : score >= 10 ? "bg-ink-soft" : "bg-fault";
  return (
    <span className="flex gap-[3px]">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-[7px] w-px ${i < filled ? tone : "bg-white/10"}`} />
      ))}
    </span>
  );
}
