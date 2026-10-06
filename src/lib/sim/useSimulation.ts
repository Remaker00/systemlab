"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emptyMetrics, Simulation, type Metrics, type SimGraph } from "./engine";

const PUBLISH_MS = 125; // React only hears about metrics ~8×/s; particles are drawn imperatively

/**
 * Runs the simulation on requestAnimationFrame while `running`. Pausing freezes sim time,
 * so particles and metrics resume exactly where they stopped.
 */
export function useSimulation(running: boolean, rate: number, graph: SimGraph) {
  const [sim] = useState(() => new Simulation());
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const rateRef = useRef(rate);
  const graphRef = useRef(graph);

  useEffect(() => {
    rateRef.current = rate;
    graphRef.current = graph;
  }, [rate, graph]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let published = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000); // a backgrounded tab must not dump a burst
      last = t;
      sim.step(dt, rateRef.current, graphRef.current);
      if (t - published > PUBLISH_MS) {
        published = t;
        setMetrics(sim.snapshot(graphRef.current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, sim]);

  const reset = useCallback(() => {
    sim.reset();
    setMetrics(emptyMetrics);
  }, [sim]);

  return { sim, metrics, reset };
}
