"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AnimatePresence, motion, type SVGMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import type { LabNode } from "@/lib/graph";
import { useDimmed, useLab } from "../LabContext";
import { FocusNote } from "./FocusNote";

export const GLYPH = 120; // glyph viewBox size (px)

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type FrameProps = {
  node: NodeProps<LabNode>;
  /** delay (s) before this node's ink starts drawing on first paint */
  delay: number;
  hasSource?: boolean;
  hasTarget?: boolean;
  /** live simulation annotation, set beside the glyph */
  readout?: ReactNode;
  /** the node is failing under load: corners turn to fault and the glyph trembles */
  alarm?: boolean;
  /** the node is dead (Break the System): the drawing fades and is struck through */
  down?: boolean;
  children: ReactNode;
};

/**
 * The shared "plotted object" shell: registration corners, a coordinate
 * annotation, the glyph, and a tiny title block underneath. No card, no box.
 */
export function NodeFrame({ node, delay, hasSource, hasTarget, readout, alarm = false, down = false, children }: FrameProps) {
  const { id, type, data, positionAbsoluteX: x, positionAbsoluteY: y, dragging } = node;
  const { running, focusedId, review } = useLab();
  const focused = focusedId === id;
  const mark = review?.nodes.get(id);
  const load = mark?.load ?? 0;
  const dimmed = useDimmed("node", id);
  const active = focused || dragging;

  return (
    // No transform animation on this root: React Flow measures handle positions on mount.
    // The intro fade (delayed) and the focus dimming (immediate) live on separate layers
    // so the intro delay never slows the dimming down.
    <motion.div
      className="group relative flex w-[150px] flex-col items-center select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, delay, ease: EASE_OUT }}
    >
      <motion.div
        className="flex w-full flex-col items-center"
        animate={{ opacity: dimmed ? 0.22 : 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        {/* coordinate annotation, like a surveyor's mark */}
        <div
          className="pointer-events-none absolute -top-5 left-0 right-0 flex justify-between font-mono text-[10px] tracking-[0.14em] text-ink-faint opacity-0 transition-opacity duration-500 group-hover:opacity-100 data-[on=true]:opacity-100"
          data-on={active}
        >
          <span>N°{data.index}</span>
          <span>
            {Math.round(x)} · {Math.round(y)}
          </span>
        </div>

        {/* glyph area with registration corners */}
        <div className="relative" style={{ width: GLYPH, height: GLYPH }}>
          <AnimatePresence>
            {focused && (
              <motion.div
                key="halo"
                className="pointer-events-none absolute -inset-10 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(232,163,90,0.09) 0%, transparent 65%)" }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
              />
            )}
          </AnimatePresence>
          <Corners active={!!active || alarm || down} focused={focused} alarm={alarm || down} />
          <motion.svg
            viewBox={`0 0 ${GLYPH} ${GLYPH}`}
            width={GLYPH}
            height={GLYPH}
            className="relative overflow-visible"
            style={{
              filter: alarm
                ? "drop-shadow(0 0 12px rgba(216,100,76,0.22))"
                : running
                  ? "drop-shadow(0 0 10px rgba(232,163,90,0.10))"
                  : "none",
              transition: "filter 1.2s ease",
            }}
            // a fine tremor, not a shake: the object is straining, not cartoon-broken
            animate={alarm && !down ? { x: [0, -0.7, 0.6, -0.4, 0] } : { x: 0 }}
            transition={alarm && !down ? { duration: 0.35, repeat: Infinity, repeatDelay: 0.25 } : { duration: 0.2 }}
          >
            <motion.g animate={{ opacity: down ? 0.3 : 1 }} transition={{ duration: 0.8 }}>
              <g filter="url(#sl-sketch)">{children}</g>
            </motion.g>
            <AnimatePresence>
              {down && (
                <motion.g key="strike" exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                  {/* struck through like a cancelled part on a drawing */}
                  <Ink d="M 18 22 L 102 98" stroke="var(--fault)" strokeWidth={1.1} duration={0.5} />
                  <Ink d="M 102 22 L 18 98" stroke="var(--fault)" strokeWidth={1.1} duration={0.5} delay={0.25} />
                </motion.g>
              )}
            </AnimatePresence>
          </motion.svg>

          {/* the workshop's review: a dashed lead with a "?" where a link is missing */}
          <AnimatePresence>
            {mark?.missingIn && hasTarget && <MissingLink key="in" side="in" text={mark.missingIn} />}
            {mark?.missingOut && hasSource && <MissingLink key="out" side="out" text={mark.missingOut} />}
          </AnimatePresence>

          <AnimatePresence>
            {readout && (
              <motion.div
                key="readout"
                className="pointer-events-none absolute left-full ml-3 whitespace-nowrap"
                style={{ bottom: GLYPH / 2 + 3 }}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT }}
              >
                {readout}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* title block */}
        <div className="mt-3 flex w-full flex-col items-center gap-1">
          <div
            className={`h-px transition-all duration-500 ${focused ? "w-16 bg-accent" : "w-8 bg-ink-faint group-hover:w-14"}`}
          />
          <div className="font-sans text-[15px] leading-none text-ink">{data.title}</div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">{data.meta}</div>
          <AnimatePresence>
            {(mark?.bottleneck || load >= 1) && (
              <motion.div
                key="bottleneck"
                className={`mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${load >= 1 ? "text-fault" : "text-accent/90"}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                ◆ {mark?.bottleneck ? "bottleneck" : "over capacity"} · {Math.round(load * 100)}%
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>{focused && <FocusNote key="note" nodeId={id} type={type} index={data.index} />}</AnimatePresence>

      {hasTarget && (
        <Handle type="target" position={Position.Left} className="sl-handle" style={{ top: GLYPH / 2, left: -2 }} />
      )}
      {hasSource && (
        <Handle type="source" position={Position.Right} className="sl-handle" style={{ top: GLYPH / 2, right: -2 }} />
      )}
    </motion.div>
  );
}

/** A missing link, drawn as an unfinished lead off the handle that ends in a question mark. */
function MissingLink({ side, text }: { side: "in" | "out"; text: string }) {
  const out = side === "out";
  const gap = (150 - GLYPH) / 2 + 6; // from the glyph's edge to just past the handle
  return (
    <motion.svg
      className="absolute overflow-visible"
      style={{ top: GLYPH / 2 - 8, ...(out ? { left: GLYPH + gap } : { right: GLYPH + gap }) }}
      width={46}
      height={16}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <title>{text}</title>
      <motion.path
        d={out ? "M 0 8 L 32 8" : "M 46 8 L 14 8"}
        stroke="var(--fault)"
        strokeOpacity={0.75}
        strokeWidth={0.9}
        strokeDasharray="2 3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
      />
      <circle cx={out ? 39 : 7} cy={8} r={6} fill="var(--paper)" stroke="var(--fault)" strokeOpacity={0.75} strokeWidth={0.8} />
      <text
        x={out ? 39 : 7}
        y={10.8}
        textAnchor="middle"
        fill="var(--fault)"
        style={{ font: "8px var(--font-mono), monospace" }}
      >
        ?
      </text>
    </motion.svg>
  );
}

function Corners({ active, focused, alarm }: { active: boolean; focused: boolean; alarm: boolean }) {
  const color = alarm ? "var(--fault)" : active ? "var(--accent)" : "var(--ink-faint)";
  // corners tighten in toward the glyph when focused, like a viewfinder locking on
  const inset = focused ? "-inset-2" : "-inset-3";
  const s = focused ? 10 : 7;
  const corner = "absolute transition-all duration-500";
  const style = { borderColor: color, width: s, height: s };
  return (
    <div
      className={`pointer-events-none absolute ${inset} opacity-30 transition-all duration-500 group-hover:opacity-100 data-[on=true]:opacity-100`}
      data-on={active}
    >
      <span className={`${corner} left-0 top-0 border-l border-t`} style={style} />
      <span className={`${corner} right-0 top-0 border-r border-t`} style={style} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} style={style} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} style={style} />
    </div>
  );
}

/** A stroke that draws itself in, like a plotter pen. */
export function Ink({
  delay = 0,
  duration = 1.4,
  faint,
  ...props
}: SVGMotionProps<SVGPathElement> & { delay?: number; duration?: number; faint?: boolean }) {
  return (
    <motion.path
      fill="none"
      stroke={faint ? "var(--ink-faint)" : "var(--ink)"}
      strokeWidth={faint ? 0.6 : 0.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ pathLength: { duration, delay, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.2, delay } }}
      {...props}
    />
  );
}
