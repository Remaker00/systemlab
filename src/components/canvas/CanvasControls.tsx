"use client";

import { useReactFlow, useViewport } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { scenarios } from "@/lib/experiments";
import { deleteDesign, listDesigns, type SavedDesign } from "@/lib/designs";
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
  /** parts offered by + Add on this sheet */
  addable: readonly AddableType[];
  onAdd: (type: AddableType) => void;
  /** a part dragged out of the drawer and let go over the canvas, at this screen point */
  onDrop: (type: AddableType, point: { x: number; y: number }) => void;
  /** the workshop's saved designs (absent on other sheets) */
  designs?: DesignsProps;
  /** how the zoom % button frames the sheet */
  fit: { padding: number; maxZoom?: number };
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
  addable,
  onAdd,
  onDrop,
  designs,
  fit,
  experimenting,
  onBreak,
  onRestore,
}: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const strip = useRef<HTMLDivElement>(null);
  const { drag, startDrag } = useDragOut(strip, onDrop);
  const groups = new Set(addable.map((t) => PARTS[t].group)).size > 1;

  return (
    <>
    <motion.div
      ref={strip}
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
            <span className="text-[12px] leading-none tracking-normal">+</span>
            Add
          </>
        }
        items={addable.map((t) => ({ value: t, ...PARTS[t], group: groups ? PARTS[t].group : undefined }))}
        onPick={onAdd}
        onDragStart={startDrag}
        heading="Drag onto the sheet, or click"
      />
      <BreakControl experimenting={experimenting} onBreak={onBreak} onRestore={onRestore} />
      {designs && <DesignsControl {...designs} />}

      <Divider />

      <Button onClick={() => zoomOut({ duration: 300 })} label="Zoom out" square>
        −
      </Button>
      <button
        onClick={() => fitView({ ...fit, duration: 700 })}
        aria-label="Fit to view"
        title="Fit to view"
        className="w-12 cursor-pointer text-center font-mono text-[11px] tabular-nums tracking-[0.1em] text-ink-faint transition-colors hover:text-ink"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button onClick={() => zoomIn({ duration: 300 })} label="Zoom in" square>
        +
      </Button>
    </motion.div>
    <AnimatePresence>{drag?.moved && <DragGhost key="ghost" label={drag.label} x={drag.x} y={drag.y} />}</AnimatePresence>
    </>
  );
}

type Drag = { type: AddableType; label: string; x: number; y: number; startX: number; startY: number; moved: boolean };
const DRAG_THRESHOLD = 5;

/**
 * Dragging a part out of the + Add drawer: the drawer steps aside once the pointer moves, a ghost
 * follows it, and letting go anywhere but the strip places the part there. A press without movement
 * stays a click (the part goes to a free spot).
 */
function useDragOut(
  strip: React.RefObject<HTMLDivElement | null>,
  onDrop: (type: AddableType, point: { x: number; y: number }) => void,
) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const live = useRef<{ drag: Drag; close: () => void } | null>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => {
    dropRef.current = onDrop;
  }, [onDrop]);

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const cur = live.current;
      if (!cur) return;
      const moved = cur.drag.moved || Math.hypot(e.clientX - cur.drag.startX, e.clientY - cur.drag.startY) > DRAG_THRESHOLD;
      if (moved && !cur.drag.moved) cur.close();
      cur.drag = { ...cur.drag, x: e.clientX, y: e.clientY, moved };
      setDrag(cur.drag);
    };
    const up = (e: PointerEvent) => {
      const cur = live.current;
      live.current = null;
      setDrag(null);
      if (!cur?.drag.moved) return;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      if (over && strip.current?.contains(over)) return;
      dropRef.current(cur.drag.type, { x: e.clientX, y: e.clientY });
    };
    const cancel = () => {
      live.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragging, strip]);

  const startDrag = (type: AddableType, label: string, x: number, y: number, close: () => void) => {
    const d: Drag = { type, label, x, y, startX: x, startY: y, moved: false };
    live.current = { drag: d, close };
    setDrag(d);
  };
  return { drag, startDrag };
}

/** What follows the pointer while a part is dragged: amber registration corners around the part's name. */
function DragGhost({ label, x, y }: { label: string; x: number; y: number }) {
  const corner = "absolute h-2 w-2 border-accent";
  return (
    <motion.div
      className="pointer-events-none fixed z-50 flex flex-col items-center gap-2"
      style={{ left: x, top: y, transform: "translate(-50%, -30px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="relative h-[60px] w-[60px]">
        <span className={`${corner} left-0 top-0 border-l border-t`} />
        <span className={`${corner} right-0 top-0 border-r border-t`} />
        <span className={`${corner} bottom-0 left-0 border-b border-l`} />
        <span className={`${corner} bottom-0 right-0 border-b border-r`} />
        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]" />
      </div>
      <span className="whitespace-nowrap font-sans text-[15px] text-ink">{label}</span>
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
      className={`flex h-7 cursor-pointer items-center justify-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.14em] transition-colors duration-300 ${
        square ? "w-7 text-[13px] tracking-normal" : "px-3"
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
    <label className="flex h-7 items-center gap-2.5 px-2 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-faint">
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

/** How each part reads in the + Add drawer. Groups are shown when a sheet offers parts from more than one. */
const PARTS: Record<AddableType, { label: string; note: string; group: string }> = {
  cdn: { label: "CDN", note: "serve at the edge", group: "Edge" },
  gateway: { label: "API gateway", note: "one front door", group: "Edge" },
  loadbalancer: { label: "Load balancer", note: "spread traffic", group: "Edge" },
  api: { label: "API server", note: "add capacity", group: "Compute" },
  queue: { label: "Queue", note: "absorb bursts", group: "Compute" },
  worker: { label: "Worker", note: "do it later", group: "Compute" },
  cache: { label: "Redis", note: "cache reads", group: "Data" },
  database: { label: "Database", note: "keep the truth", group: "Data" },
  replica: { label: "Read replica", note: "spread reads", group: "Data" },
};

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

type DrawerItem<T> = { value: T; label: string; note: string; group?: string };

/** Open/close for a small popover in the strip. Esc or a click elsewhere closes it. */
function usePopover() {
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
  return { open, setOpen, ref };
}

const POPOVER =
  "absolute bottom-full left-1/2 mb-4 flex -translate-x-1/2 flex-col border border-white/[0.06] bg-[#0e0e0d]/90 py-1.5 backdrop-blur-sm";
const popoverMotion = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
};

/** A small drawer that opens upward out of the strip. Esc or a click elsewhere closes it. */
function Drawer<T extends string>({
  label,
  trigger,
  items,
  onPick,
  tone = "accent",
  heading,
  onDragStart,
}: {
  label: string;
  trigger: ReactNode;
  items: DrawerItem<T>[];
  onPick: (value: T) => void;
  tone?: "accent" | "fault";
  heading?: string;
  /** items can be dragged out; the drawer closes itself through `close` once the drag gets going */
  onDragStart?: (value: T, label: string, x: number, y: number, close: () => void) => void;
}) {
  const { open, setOpen, ref } = usePopover();

  const hoverNote = tone === "fault" ? "group-hover:text-fault" : "group-hover:text-accent/80";
  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen((o) => !o)} label={label} active={open} tone={tone}>
        {trigger}
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" aria-label={label} className={`${POPOVER} w-56`} {...popoverMotion}>
            {heading && (
              <span className="px-3 pb-1 pt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                {heading}
              </span>
            )}
            {items.map(({ value, label: itemLabel, note, group }, i) => (
              <div key={value} className="flex flex-col">
              {group && group !== items[i - 1]?.group && (
                <span className={`px-3 pb-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint ${i ? "pt-2" : ""}`}>
                  {group}
                </span>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  onPick(value);
                  setOpen(false);
                }}
                onPointerDown={
                  onDragStart && ((e) => e.button === 0 && onDragStart(value, itemLabel, e.clientX, e.clientY, () => setOpen(false)))
                }
                style={onDragStart ? { touchAction: "none" } : undefined}
                className={`group flex items-baseline justify-between gap-3 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.03] ${
                  onDragStart ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
              >
                <span className="font-sans text-[14px] text-ink/85 transition-colors group-hover:text-ink">
                  {itemLabel}
                </span>
                <span className={`font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint transition-colors ${hoverNote}`}>
                  {note}
                </span>
              </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type DesignsProps = {
  /** name of the design on the sheet, once it has been saved or opened */
  current: string | null;
  /** save the sheet under this name; false if the browser refused */
  onSave: (name: string) => boolean;
  onOpen: (design: SavedDesign) => void;
};

/** Save the workshop drawing by name, and reopen (or discard) saved ones. Kept in this browser. */
function DesignsControl({ current, onSave, onOpen }: DesignsProps) {
  const { open, setOpen, ref } = usePopover();
  const [list, setList] = useState<SavedDesign[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const toggle = () => {
    if (!open) {
      const saved = listDesigns();
      setList(saved);
      setName(current ?? `Design ${String(saved.length + 1).padStart(2, "0")}`);
      setStatus(null);
      setConfirming(null);
    }
    setOpen(!open);
  };

  const save = () => {
    const n = name.trim();
    if (!n) return;
    const ok = onSave(n);
    setStatus(ok ? { ok, text: `saved as “${n}”` } : { ok, text: "this browser won’t let it be stored" });
    if (ok) setList(listDesigns());
  };

  const discard = (d: SavedDesign) => {
    if (confirming !== d.id) return setConfirming(d.id);
    deleteDesign(d.id);
    setList(listDesigns());
    setConfirming(null);
  };

  return (
    <div ref={ref} className="relative">
      <Button onClick={toggle} label="Saved designs" active={open}>
        <svg width="10" height="9" viewBox="0 0 10 9" fill="none" stroke="currentColor" strokeWidth="0.9" aria-hidden>
          <path d="M1.5 2.5h6v6h-6z M3 1h6.5v6" strokeLinejoin="round" />
        </svg>
        Designs
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div aria-label="Saved designs" className={`${POPOVER} w-64 gap-1`} {...popoverMotion}>
            <span className="px-3 pt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Save this drawing</span>
            <form
              className="flex items-center gap-2 px-3 pb-1"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setStatus(null);
                }}
                maxLength={40}
                aria-label="Design name"
                className="min-w-0 flex-1 border-b border-white/10 bg-transparent py-1 font-sans text-[14px] text-ink outline-none transition-colors focus:border-accent/60"
              />
              <button
                type="submit"
                className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent transition-colors hover:text-ink"
              >
                Save
              </button>
            </form>
            {status && (
              <span className={`px-3 font-mono text-[10px] tracking-[0.12em] ${status.ok ? "text-ink-soft" : "text-fault"}`}>
                {status.text}
              </span>
            )}

            <span className="px-3 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">Open</span>
            {list.length === 0 && (
              <span className="px-3 pb-1 font-mono text-[10.5px] tracking-[0.08em] text-ink-faint">nothing saved yet</span>
            )}
            <div className="flex max-h-56 flex-col overflow-y-auto">
              {list.map((d) => (
                <div key={d.id} className="group flex items-baseline gap-2 px-3 py-1 transition-colors hover:bg-white/[0.03]">
                  <button
                    onClick={() => {
                      onOpen(d);
                      setOpen(false);
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-2 text-left"
                  >
                    <span
                      className={`truncate font-sans text-[14px] transition-colors ${
                        d.name === current ? "text-accent" : "text-ink/85 group-hover:text-ink"
                      }`}
                    >
                      {d.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      {d.nodes.length} parts · {ago(d.savedAt)}
                    </span>
                  </button>
                  <button
                    onClick={() => discard(d)}
                    aria-label={`Delete ${d.name}`}
                    className={`cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                      confirming === d.id ? "text-fault" : "text-ink-faint hover:text-fault"
                    }`}
                  >
                    {confirming === d.id ? "delete?" : "✕"}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ago(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Divider() {
  return <span className="mx-1 h-3.5 w-px bg-white/[0.08]" />;
}
