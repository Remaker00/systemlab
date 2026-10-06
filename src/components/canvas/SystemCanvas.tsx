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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_TRAFFIC,
  edgeId,
  initialEdges,
  initialNodes,
  linkLabel,
  type LabEdge,
  type LabNode,
} from "@/lib/graph";
import type { Metrics, SimGraph } from "@/lib/sim/engine";
import { useSimulation } from "@/lib/sim/useSimulation";
import { CanvasControls } from "./CanvasControls";
import { ConnectionLine } from "./edges/ConnectionLine";
import { SketchEdge } from "./edges/SketchEdge";
import { LabContext, type LabState } from "./LabContext";
import { ApiNode, DatabaseNode, UsersNode } from "./nodes/glyphs";
import { ParticleLayer } from "./ParticleLayer";
import { SketchDefs } from "./SketchDefs";

// Defined at module scope so React Flow doesn't re-register types each render.
const nodeTypes: NodeTypes = { users: UsersNode, api: ApiNode, database: DatabaseNode };
const edgeTypes: EdgeTypes = { sketch: SketchEdge };

const FIT = { padding: 0.35 };
const DELETE_KEYS = ["Backspace", "Delete"];

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
  const { fitView } = useReactFlow();

  // ── simulation: a structural view of the graph, rebuilt as links and capacities change ──
  const simGraph = useMemo<SimGraph>(
    () => ({
      nodes: nodes.map((n) => ({ id: n.id, type: n.type ?? "", capacity: n.data.capacity })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }),
    [nodes, edges],
  );
  const { sim, metrics, reset: resetSim } = useSimulation(running, traffic, simGraph);

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
    return { running, focusedId, litNodes, litEdges, metrics };
  }, [nodes, edges, running, metrics]);

  const edgeSelected = edges.some((e) => e.selected);

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

  const reset = useCallback(() => {
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
        </ReactFlow>
      </div>

      <div className="paper-vignette" />
      <div className="paper-grain" />

      <TitleBlock
        running={running}
        metrics={metrics}
        objects={nodes.length}
        links={edges.length}
        hint={
          lab.focusedId
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
      />
    </LabContext.Provider>
  );
}

type TitleBlockProps = {
  running: boolean;
  metrics: Metrics;
  objects: number;
  links: number;
  hint: string;
};

/** Corner annotations, in the manner of a drawing sheet's title block. */
function TitleBlock({ running, metrics, objects, links, hint }: TitleBlockProps) {
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
