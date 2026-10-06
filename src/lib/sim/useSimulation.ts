"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyMetrics, isFaultActive, Simulation, type Fault, type Metrics, type SimGraph } from "./engine";
import { History } from "./history";
import { Ledger, type LedgerRow } from "./ledger";

const PUBLISH_MS = 125; // React only hears about metrics ~8×/s; particles are drawn imperatively

/**
 * Runs the simulation on requestAnimationFrame while `running`. Pausing freezes sim time,
 * so particles and metrics resume exactly where they stopped.
 */
/** A fixed rate, or a schedule of sim time (a challenge trial drives its own traffic). */
export type RateSource = number | ((time: number) => number);

export function useSimulation(running: boolean, rate: RateSource, graph: SimGraph, fault: Fault | null) {
  const [sim] = useState(() => new Simulation());
  const [ledger] = useState(() => new Ledger());
  const [history] = useState(() => new History());
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [comparison, setComparison] = useState<{ rows: LedgerRow[]; current: number | null }>({
    rows: [],
    current: null,
  });
  const rateRef = useRef(rate);
  const graphRef = useRef(graph);
  const faultRef = useRef(fault);

  useEffect(() => {
    rateRef.current = rate;
    graphRef.current = graph;
    faultRef.current = fault;
  }, [rate, graph, fault]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let published = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000); // a backgrounded tab must not dump a burst
      last = t;
      const source = rateRef.current;
      const r = typeof source === "function" ? source(sim.time) : source;
      sim.step(dt, r, graphRef.current, faultRef.current);
      if (t - published > PUBLISH_MS) {
        published = t;
        const snapshot = sim.snapshot(graphRef.current);
        history.push(snapshot);
        // a broken system isn't a pool-size data point: keep faults out of the comparison
        if (isFaultActive(faultRef.current, sim.time)) ledger.interrupt();
        else {
          const servers = new Set(graphRef.current.nodes.filter((n) => n.type === "api").map((n) => n.id));
          ledger.observe(snapshot, r, sim.time, structureOf(graphRef.current), servers);
        }
        setMetrics(snapshot);
        setComparison({ rows: ledger.rows, current: ledger.current });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, sim, ledger, history]);

  const reset = useCallback(() => {
    sim.reset();
    ledger.reset();
    history.reset();
    setMetrics(emptyMetrics);
    setComparison({ rows: [], current: null });
  }, [sim, ledger, history]);

  return { sim, metrics, comparison, history, reset };
}

/** Links and capacities as a string: changes whenever the system's shape does. */
function structureOf(graph: SimGraph): string {
  const caps = graph.nodes.map((n) => `${n.id}:${n.capacity ?? ""}:${n.hitShare ?? ""}:${n.ttl ?? ""}`);
  const links = graph.edges.map((e) => `${e.source}>${e.target}`);
  return [...caps, ...links].sort().join(",");
}
