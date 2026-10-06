"use client";

import { ViewportPortal } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import type { Issue, Review } from "@/lib/workshop";
import { useScaled } from "./LabContext";

type Props = {
  anchor: { x: number; y: number }; // flow position of the Users node
  review: Review;
  /** parts on the sheet besides Users */
  parts: number;
  traffic: number;
  bottleneckName: string | null;
  /** the design's name, once saved or opened */
  design: string | null;
  onPick: (issue: Issue) => void;
};

const SECTIONS: { kind: Issue["kind"]; label: string }[] = [
  { kind: "link", label: "Wrong links" },
  { kind: "missing", label: "Missing" },
  { kind: "load", label: "Under load" },
  { kind: "sheet", label: "On the sheet" },
];
const MAX_PER_SECTION = 4;

/**
 * The workshop's running review, written in the margin to the left of Users. It reads the drawing as
 * it's drawn: links that don't make sense, connections that are missing, and where the load piles up.
 * Each line points at its part: click it to focus that part.
 */
export function WorkshopNote({ anchor, review, parts, traffic, bottleneckName, design, onPick }: Props) {
  const scaled = useScaled();
  const count = review.issues.length;
  const summary =
    parts === 0
      ? "A blank sheet. Build what these users need, part by part."
      : count === 0
        ? `It holds together: every part is connected, and nothing runs past its limit at ${scaled.rate(traffic)}.`
        : `${count === 1 ? "One thing" : `${count} things`} to look at before it's sound.`;

  return (
    <ViewportPortal>
      <div className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${anchor.x - 48}px, ${anchor.y - 70}px)` }}>
        <motion.div
          data-sl-workshop
          className="nodrag nopan nowheel absolute right-0 top-0 w-[290px] select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <div className="flex flex-col gap-4 border-r border-white/[0.12] bg-gradient-to-l from-[#0c0c0b]/95 via-[#0c0c0b]/92 to-[#0c0c0b]/80 py-1 pr-4 text-right font-mono text-[11px] leading-relaxed tracking-[0.04em]">
            <div className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              Workshop · review{design && <span className="text-ink-soft"> · {design}</span>}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={summary}
                className="font-sans text-[15px] leading-snug text-ink normal-case tracking-normal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {summary}
              </motion.p>
            </AnimatePresence>

            {parts === 0 && (
              <p className="text-ink-faint">
                Drag parts out of + Add onto the sheet, then link them ○ → ○. This note checks the drawing as you go. Keep
                what you build under Designs.
              </p>
            )}

            {review.ceiling !== null && bottleneckName && (
              <div className="flex flex-col gap-1">
                <Fact name="holds up to about" value={scaled.rate(Math.floor(review.ceiling))} />
                <Fact name="first to give" value={bottleneckName} />
              </div>
            )}

            {SECTIONS.map(({ kind, label }) => {
              const items = review.issues.filter((i) => i.kind === kind);
              if (!items.length) return null;
              return (
                <div key={kind} className="flex flex-col gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                    {label} · {items.length}
                  </span>
                  <AnimatePresence initial={false}>
                    {items.slice(0, MAX_PER_SECTION).map((issue) => (
                      <motion.button
                        key={`${issue.kind}:${issue.node ?? issue.edge ?? issue.title}:${issue.text}`}
                        onClick={() => onPick(issue)}
                        disabled={!issue.node && !issue.edge}
                        className="group pointer-events-auto flex cursor-pointer flex-col items-end gap-0.5 text-right disabled:cursor-default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <span className="flex items-baseline gap-2">
                          <span className="font-sans text-[13px] text-ink/85 normal-case tracking-normal transition-colors group-hover:text-ink">
                            {issue.title}
                          </span>
                          <span className={kind === "load" ? "text-accent" : "text-fault/80"}>{kind === "load" ? "◆" : kind === "link" ? "✕" : "?"}</span>
                        </span>
                        <span className="text-ink-soft">{issue.text}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                  {items.length > MAX_PER_SECTION && (
                    <span className="text-ink-faint">and {items.length - MAX_PER_SECTION} more on the drawing</span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </ViewportPortal>
  );
}

function Fact({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-2">
      <span className="text-ink-faint">{name}</span>
      <span className="w-10 translate-y-[-2px] border-b border-dotted border-white/10" />
      <span className="tabular-nums text-ink-soft">{value}</span>
    </div>
  );
}
