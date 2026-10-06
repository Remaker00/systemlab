"use client";

import {
  addEdge,
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeTypes,
  type IsValidConnection,
  type NodeTypes,
  type OnConnect,
} from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createNode,
  DEFAULT_TRAFFIC,
  edgeId,
  initialEdges,
  initialNodes,
  linkLabel,
  type AddableType,
  type LabEdge,
  type LabNode,
} from "@/lib/graph";
import {
  BASELINE_S,
  experimentStage,
  scenarioByKind,
  type Experiment,
  type SystemShape,
} from "@/lib/experiments";
import { isFaultActive, type Fault, type FaultKind, type Metrics, type SimGraph } from "@/lib/sim/engine";
import type { LedgerRow } from "@/lib/sim/ledger";
import { useSimulation } from "@/lib/sim/useSimulation";
import { CanvasControls } from "./CanvasControls";
import { ConnectionLine } from "./edges/ConnectionLine";
import { SketchEdge } from "./edges/SketchEdge";
import { ExperimentNote } from "./ExperimentNote";
import { LabContext, type LabState } from "./LabContext";
import { ApiNode, CacheNode, DatabaseNode, LoadBalancerNode, UsersNode } from "./nodes/glyphs";
import { ParticleLayer } from "./ParticleLayer";
import { SketchDefs } from "./SketchDefs";

// Defined at module scope so React Flow doesn't re-register types each render.
const nodeTypes: NodeTypes = {
  users: UsersNode,
  api: ApiNode,
  database: DatabaseNode,
  loadbalancer: LoadBalancerNode,
  cache: CacheNode,
};
const edgeTypes: EdgeTypes = { sketch: SketchEdge };

const FIT = { padding: 0.35 };
const STRIP_CLEARANCE = 110; // px kept clear above the bottom control strip
const TITLE_CLEARANCE = 130; // px kept clear below the title block
const SIDE_CLEARANCE = 24;
const DELETE_KEYS = ["Backspace", "Delete"];

// rough footprint of a node incl. its title block, for finding free space
const FOOTPRINT = { w: 200, h: 210 };

/** First free spot scanning down (then right) from a preferred point. */
function freeSpot(nodes: LabNode[], preferred: { x: number; y: number }) {
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 8; row++) {
      const p = { x: preferred.x + col * FOOTPRINT.w, y: preferred.y + row * FOOTPRINT.h };
      const clear = nodes.every(
        (n) => Math.abs(n.position.x - p.x) >= FOOTPRINT.w || Math.abs(n.position.y - p.y) >= FOOTPRINT.h,
      );
      if (clear) return p;
    }
  }
  return preferred;
}

export function SystemCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<LabNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LabEdge>(initialEdges);
  const [running, setRunning] = useState(false);
  const [traffic, setTraffic] = useState(DEFAULT_TRAFFIC);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  const experimentCount = useRef(0);
  const quietSince = useRef(0); // sim time the last fault was lifted
  const { fitView, fitBounds, getNodesBounds, getViewport, setViewport, screenToFlowPosition } = useReactFlow<
    LabNode,
    LabEdge
  >();

  // ── simulation: a structural view of the graph, rebuilt as links and capacities change ──
  const simGraph = useMemo<SimGraph>(
    () => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type ?? "",
        capacity: n.data.capacity,
        hitShare: n.data.hitShare,
        ttl: n.data.ttl,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }),
    [nodes, edges],
  );
  // an experiment ends by itself if the part it broke is removed from the sheet
  const live = experiment && nodes.some((n) => n.id === experiment.target) ? experiment : null;
  const fault = useMemo<Fault | null>(
    () => (live ? { kind: live.kind, target: live.target, from: live.breakAt } : null),
    [live],
  );
  const { sim, metrics, comparison, history, reset: resetSim } = useSimulation(running, traffic, simGraph, fault);
  const activeFault = isFaultActive(fault, metrics.time) ? fault : null;

  // ── focus: exactly one selected node ──────────────────────────────
  const lab = useMemo<LabState>(() => {
    const selected = nodes.filter((n) => n.selected);
    const focusedId = selected.length === 1 ? selected[0].id : null;
    const litNodes = new Set<string>();
    const litEdges = new Set<string>();
    if (focusedId) {
      litNodes.add(focusedId);
      for (const e of edges) {
        if (e.source === focusedId || e.target === focusedId) {
          litEdges.add(e.id);
          litNodes.add(e.source).add(e.target);
        }
      }
    }
    return { running, focusedId, litNodes, litEdges, metrics, traffic, fault: activeFault };
  }, [nodes, edges, running, metrics, traffic, activeFault]);

  const focusedRemovable = !!lab.focusedId && nodes.find((n) => n.id === lab.focusedId)?.deletable !== false;

  const edgeSelected = edges.some((e) => e.selected);

  // When the camera is mid-flight (fit after adding), reveal-panning must wait for it to land.
  const framingUntil = useRef(0);

  /** Pan just enough to bring an annotation fully into view, clear of the title block and the strip. */
  const revealLater = useCallback(
    (find: () => Element | null) => {
      const wait = Math.max(80, framingUntil.current - performance.now());
      const timer = setTimeout(() => {
        const r = find()?.getBoundingClientRect();
        if (!r) return;
        const top = TITLE_CLEARANCE;
        const bottom = window.innerHeight - STRIP_CLEARANCE;
        let dy = r.bottom > bottom ? bottom - r.bottom : 0;
        if (r.top + dy < top) dy = top - r.top; // the start of a note matters more than its end
        const right = window.innerWidth - SIDE_CLEARANCE;
        const dx = r.left < SIDE_CLEARANCE ? SIDE_CLEARANCE - r.left : r.right > right ? right - r.right : 0;
        if (!dx && !dy) return;
        const { x, y, zoom } = getViewport();
        setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 600 });
      }, wait);
      return () => clearTimeout(timer);
    },
    [getViewport, setViewport],
  );

  // A focused node's note must not hide under the strip.
  useEffect(() => {
    if (!lab.focusedId) return;
    return revealLater(() =>
      document.querySelector(`.react-flow__node[data-id="${CSS.escape(lab.focusedId!)}"] [data-sl-note]`),
    );
  }, [lab.focusedId, revealLater]);

  // Each new beat of an experiment must be readable *with* the drawing it describes: if the note
  // has outgrown the view, frame the note and the whole system together (zooming out if needed).
  const experimentBeat = live ? `${live.id}:${experimentStage(live, metrics.time)}` : null;
  useEffect(() => {
    if (!experimentBeat) return;
    const timer = setTimeout(() => {
      const r = document.querySelector("[data-sl-experiment]")?.getBoundingClientRect();
      if (!r) return;
      const fits =
        r.top >= TITLE_CLEARANCE &&
        r.bottom <= window.innerHeight - STRIP_CLEARANCE &&
        r.left >= SIDE_CLEARANCE &&
        r.right <= window.innerWidth - SIDE_CLEARANCE;
      if (fits) return;
      const a = screenToFlowPosition({ x: r.left, y: r.top });
      const b = screenToFlowPosition({ x: r.right, y: r.bottom });
      const sys = getNodesBounds(nodesRef.current);
      const x = Math.min(a.x, sys.x);
      const y = Math.min(a.y, sys.y);
      const width = Math.max(b.x, sys.x + sys.width) - x;
      const height = Math.max(b.y, sys.y + sys.height + 60) - y; // + title blocks under the glyphs
      // extra room above for the sheet's title block and below for the control strip
      fitBounds(
        { x, y: y - height * 0.14, width, height: height * 1.26 },
        { padding: 0.12, duration: 700 },
      );
    }, 120);
    return () => clearTimeout(timer);
  }, [experimentBeat, fitBounds, getNodesBounds, screenToFlowPosition]);

  const clearSelection = useCallback(() => {
    setNodes((ns) => (ns.some((n) => n.selected) ? ns.map((n) => ({ ...n, selected: false })) : ns));
    setEdges((es) => (es.some((e) => e.selected) ? es.map((e) => ({ ...e, selected: false })) : es));
  }, [setNodes, setEdges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && clearSelection();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  // ── linking ──────────────────────────────────────────────────────
  const isValidConnection = useCallback<IsValidConnection<LabEdge>>(
    (c) => c.source !== c.target && !edges.some((e) => e.source === c.source && e.target === c.target),
    [edges],
  );

  const onConnect = useCallback<OnConnect>(
    (c) => {
      const type = (id: string) => nodes.find((n) => n.id === id)?.type;
      const edge: LabEdge = {
        ...c,
        id: edgeId(c),
        type: "sketch",
        data: { label: linkLabel(type(c.source), type(c.target)), drawDelay: 0 },
      };
      setEdges((es) => addEdge(edge, es));
    },
    [nodes, setEdges],
  );

  // ── adding components: placed in free space, drawn in, and focused so their note explains them ──
  const addComponent = useCallback(
    (type: AddableType) => {
      setNodes((ns) => {
        const apis = ns.filter((n) => n.type === "api");
        const users = ns.find((n) => n.type === "users");
        const db = ns.find((n) => n.type === "database");
        // servers stack under the existing ones; a balancer goes below the Users → API span;
        // a cache goes *above* the API → Database span, so its link down to the database
        // leaves away from its readout (which sits above-right of every glyph)
        const midX = (a?: LabNode, b?: LabNode) => ((a?.position.x ?? 0) + (b?.position.x ?? 400)) / 2;
        const preferred =
          type === "api" && apis.length
            ? { x: apis[0].position.x, y: Math.max(...apis.map((n) => n.position.y)) + FOOTPRINT.h }
            : type === "cache"
              ? {
                  x: midX(apis[0], db),
                  y: Math.min(apis[0]?.position.y ?? 0, db?.position.y ?? 0) - FOOTPRINT.h - 20,
                }
              : { x: midX(users, apis[0]), y: (users?.position.y ?? 0) + FOOTPRINT.h };
        const node = { ...createNode(type, ns, freeSpot(ns, preferred)), selected: true };
        return [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), node];
      });
      // frame the whole sheet once the new node has been measured
      framingUntil.current = performance.now() + 60 + 800 + 50;
      setTimeout(() => fitView({ ...FIT, duration: 800 }), 60);
    },
    [setNodes, fitView],
  );

  // ── Break the System ─────────────────────────────────────────────
  const shape = useMemo<SystemShape>(() => {
    const type = (id: string) => nodes.find((n) => n.id === id)?.type;
    const fed = new Set(edges.filter((e) => type(e.target) === "api").map((e) => e.target));
    const balanced = edges.some((e) => type(e.source) === "loadbalancer" && type(e.target) === "api");
    const cached = edges.some((e) => type(e.source) === "cache" && type(e.target) === "database");
    return { servers: fed.size, balanced, cached };
  }, [nodes, edges]);

  const startExperiment = useCallback(
    (kind: FaultKind) => {
      const { anchor } = scenarioByKind(kind);
      const candidates = nodes.filter((n) => n.type === anchor);
      // break the busiest server, so the failure is felt
      const target = [...candidates].sort((a, b) => (metrics.arrivals[b.id] ?? 0) - (metrics.arrivals[a.id] ?? 0))[0];
      if (!target) return;
      // Break straight away only if the last BASELINE_S were normal, running operation, so "before"
      // never contains a previous experiment. Otherwise measure normal operation first.
      const normalFrom = Math.max(BASELINE_S, quietSince.current + BASELINE_S);
      const breakAt = running ? Math.max(metrics.time + 0.3, normalFrom) : metrics.time + BASELINE_S;
      const base = traffic || DEFAULT_TRAFFIC;
      if (!traffic) setTraffic(base);
      experimentCount.current += 1;
      setExperiment({
        id: experimentCount.current,
        kind,
        target: target.id,
        breakAt,
        traffic: base,
        choice: null,
      });
      setNodes((ns) => (ns.some((n) => n.selected) ? ns.map((n) => ({ ...n, selected: false })) : ns));
      setRunning(true);
    },
    [nodes, metrics, running, traffic, setNodes],
  );

  const restore = useCallback(() => {
    quietSince.current = metrics.time;
    setExperiment(null);
  }, [metrics.time]);

  const reset = useCallback(() => {
    setExperiment(null);
    quietSince.current = 0;
    setRunning(false);
    resetSim();
    setNodes(initialNodes);
    setEdges(initialEdges);
    // let the restored positions land before framing them
    requestAnimationFrame(() => fitView({ ...FIT, duration: 900 }));
  }, [setNodes, setEdges, fitView, resetSim]);

  return (
    <LabContext.Provider value={lab}>
      <div className="absolute inset-0">
        <SketchDefs />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          connectionLineComponent={ConnectionLine}
          connectionRadius={28}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={DELETE_KEYS}
          selectNodesOnDrag={false}
          fitView
          fitViewOptions={FIT}
          minZoom={0.3}
          maxZoom={2.5}
          colorMode="dark"
        >
          {/* fine drafting grid + sparse registration crosses */}
          <Background id="minor" variant={BackgroundVariant.Lines} gap={24} lineWidth={0.5} color="rgba(232,227,216,0.022)" />
          <Background id="major" variant={BackgroundVariant.Cross} gap={192} size={7} lineWidth={0.6} color="rgba(232,227,216,0.12)" />
          <ParticleLayer sim={sim} />
          <AnimatePresence>
            {live && (
              <ExperimentNote
                key={live.id}
                experiment={live}
                anchor={nodes.find((n) => n.id === live.target)!.position}
                now={metrics.time}
                history={history}
                shape={shape}
                onChoose={(choice) => setExperiment((e) => (e ? { ...e, choice } : e))}
                onRestore={restore}
              />
            )}
          </AnimatePresence>
        </ReactFlow>
      </div>

      <div className="paper-vignette" />
      <div className="paper-grain" />

      <TitleBlock
        running={running}
        metrics={metrics}
        comparison={comparison}
        objects={nodes.length}
        links={edges.length}
        hint={
          live
            ? "experiment — watch the drawing"
            : focusedRemovable
              ? "⌫ — remove · esc — release"
            : lab.focusedId
              ? "esc — release focus"
            : edgeSelected
              ? "⌫ or cut — remove link"
              : running
                ? "focus api server — tune capacity"
                : "drag ○ → ○ — draw a link"
        }
      />

      <CanvasControls
        running={running}
        onRun={() => setRunning((r) => !r)}
        onReset={reset}
        traffic={traffic}
        onTraffic={setTraffic}
        onAdd={addComponent}
        experimenting={!!live}
        onBreak={startExperiment}
        onRestore={restore}
      />
    </LabContext.Provider>
  );
}

type TitleBlockProps = {
  running: boolean;
  metrics: Metrics;
  comparison: { rows: LedgerRow[]; current: number | null };
  objects: number;
  links: number;
  hint: string;
};

/** Corner annotations, in the manner of a drawing sheet's title block. */
function TitleBlock({ running, metrics, comparison, objects, links, hint }: TitleBlockProps) {
  const overloaded = running && Object.values(metrics.loads).some((l) => l.overloaded);
  const status = running ? (overloaded ? "Overloaded" : "Flowing") : metrics.total > 0 ? "Paused" : "Idle";
  return (
    <>
      <motion.header
        className="pointer-events-none absolute left-5 top-6 sm:left-8 sm:top-7 z-10 select-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6 }}
      >
        <h1 className="font-serif text-[26px] leading-none text-ink">
          System<span className="italic">Lab</span>
        </h1>
        <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.3em] text-ink-faint">Learn by breaking systems</p>
      </motion.header>

      <motion.div
        className="pointer-events-none absolute right-8 top-8 z-10 hidden sm:block select-none text-right font-mono text-[8.5px] uppercase leading-[1.9] tracking-[0.24em] text-ink-faint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 0.4 }}
      >
        <div>Sheet 01 — Foundation</div>
        <div>
          {objects} objects · {links} {links === 1 ? "link" : "links"}
        </div>
        <div className="relative mt-2 h-4 overflow-hidden text-ink-faint/70">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={hint}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {hint}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute bottom-9 left-8 z-10 hidden sm:flex select-none flex-col items-start gap-3 font-mono text-[8.5px] uppercase tracking-[0.28em] text-ink-faint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 0.8 }}
      >
        <AnimatePresence>
          {comparison.rows.length > 0 && <ComparisonTable key="cmp" {...comparison} />}
        </AnimatePresence>
        <AnimatePresence>{metrics.total > 0 && <SimReadout key="sim" metrics={metrics} />}</AnimatePresence>
        <span className="flex items-center gap-2">
          <span
            className={`h-1 w-1 rounded-full transition-colors duration-700 ${
              overloaded
                ? "bg-fault shadow-[0_0_6px_var(--fault-glow)]"
                : running
                  ? "bg-accent shadow-[0_0_6px_var(--accent-glow)]"
                  : "bg-ink-faint"
            }`}
          />
          <span className={overloaded ? "text-fault" : undefined}>{status}</span>
        </span>
      </motion.div>
    </>
  );
}

/** Whole-system figures, stacked above the status word like a drawing's revision table. */
function SimReadout({ metrics }: { metrics: Metrics }) {
  const item = (label: string, value: string, tone?: string) => (
    <span className="flex gap-3">
      <span className="w-14 text-ink-faint/70">{label}</span>
      <span className={`tabular-nums tracking-[0.12em] ${tone ?? "text-ink-soft"}`}>{value}</span>
    </span>
  );
  const latencyTone = metrics.latencyMs >= 250 ? "text-fault" : metrics.latencyMs >= 60 ? "text-accent" : undefined;
  return (
    <motion.span
      className="flex flex-col gap-1.5 border-l border-white/[0.08] pl-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {item("req", metrics.total.toLocaleString("en-US"))}
      {item("rate", `${metrics.rps}/s`)}
      {item("latency", `${Math.round(metrics.latencyMs)} ms`, latencyTone)}
      {item(
        "errors",
        `${metrics.errors.toLocaleString("en-US")}${metrics.errorRate > 0 ? ` · ${Math.round(metrics.errorRate * 100)}%` : ""}`,
        metrics.errors > 0 && metrics.errorRate > 0 ? "text-fault" : undefined,
      )}
    </motion.span>
  );
}

/**
 * Measured behaviour per pool size, recorded by the ledger once each setup settles.
 * Running one server and then several fills in the comparison.
 */
function ComparisonTable({ rows, current }: { rows: LedgerRow[]; current: number | null }) {
  const cell = "tabular-nums tracking-[0.12em]";
  return (
    <motion.div
      className="flex flex-col gap-1.5 border-l border-white/[0.08] pl-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <span className="text-ink-faint/70">Compare · by servers</span>
      <div className="grid grid-cols-[1.5rem_3.5rem_3.5rem_4rem_2.5rem] gap-x-3 gap-y-1.5">
        {["n", "cap", "traffic", "latency", "err"].map((h) => (
          <span key={h} className="text-ink-faint/50">
            {h}
          </span>
        ))}
        <AnimatePresence initial={false}>
          {rows.map((r) => {
            const now = r.servers === current;
            const latencyTone = r.latencyMs >= 250 ? "text-fault" : r.latencyMs >= 60 ? "text-accent" : "text-ink-soft";
            return (
              <motion.div
                key={r.servers}
                className="contents"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <span className={`${cell} flex items-center gap-1.5 ${now ? "text-accent" : "text-ink-soft"}`}>
                  {r.servers}
                  {now && <span className="h-1 w-1 rounded-full bg-accent shadow-[0_0_6px_var(--accent-glow)]" />}
                </span>
                <span className={`${cell} text-ink-soft`}>{r.capacity}/s</span>
                <span className={`${cell} text-ink-soft`}>{r.traffic}/s</span>
                <span className={`${cell} ${latencyTone}`}>{Math.round(r.latencyMs)} ms</span>
                <span className={`${cell} ${r.errorRate > 0.005 ? "text-fault" : "text-ink-soft"}`}>
                  {Math.round(r.errorRate * 100)}%
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {rows.length === 1 && (
        <span className="normal-case tracking-[0.08em] text-ink-faint/60">
          {rows[0].servers === 1 ? "add servers behind a balancer to compare" : "run one server to compare"}
        </span>
      )}
    </motion.div>
  );
}
