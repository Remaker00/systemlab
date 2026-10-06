"use client";

import { ViewportPortal } from "@xyflow/react";
import { useEffect, useState } from "react";
import { DROP_S, HOP_S, MAX_WAIT_S, type Particle, type Simulation } from "@/lib/sim/engine";

const SVG_NS = "http://www.w3.org/2000/svg";
const QUEUE_GAP = 4.5; // px between queued requests along the incoming link
const DROP_FALL = 28; // px a rejected request falls before vanishing

/**
 * Draws the simulation's requests as small particles riding the inked edge paths.
 * This runs imperatively every frame (no React state) and reads the edge geometry straight from
 * the edges' DOM paths (`data-sl-edge`), so particles follow links while nodes are dragged.
 */
export function ParticleLayer({ sim }: { sim: Simulation }) {
  // ViewportPortal mounts its target after the first render, so track the element
  // through a callback ref rather than reading a ref once on mount.
  const [group, setGroup] = useState<SVGGElement | null>(null);

  useEffect(() => {
    if (!group) return;
    const dots = new Map<number, SVGCircleElement>();
    let raf = 0;

    const draw = () => {
      const paths = new Map<string, SVGPathElement>();
      const pathFor = (id: string) => {
        if (!paths.has(id)) {
          const el = document.querySelector<SVGPathElement>(`path[data-sl-edge="${CSS.escape(id)}"]`);
          if (el) paths.set(id, el);
        }
        return paths.get(id);
      };

      // queue order per link: whoever leaves first stands at the front
      const queues = new Map<string, Particle[]>();
      for (const p of sim.particles) {
        if (p.state !== "waiting") continue;
        const edge = p.route[p.hop];
        if (!queues.has(edge)) queues.set(edge, []);
        queues.get(edge)!.push(p);
      }
      const slot = new Map<number, number>();
      for (const q of queues.values()) {
        q.sort((a, b) => a.hopStart + (a.waits[a.hop] ?? 0) - (b.hopStart + (b.waits[b.hop] ?? 0)));
        q.forEach((p, i) => slot.set(p.id, i));
      }

      const seen = new Set<number>();
      for (const p of sim.particles) {
        const path = pathFor(p.route[p.hop]);
        if (!path) continue;
        seen.add(p.id);

        let dot = dots.get(p.id);
        if (!dot) {
          dot = document.createElementNS(SVG_NS, "circle");
          dot.setAttribute("filter", "url(#sl-glow)");
          group.appendChild(dot);
          dots.set(p.id, dot);
        }

        const len = path.getTotalLength();
        const elapsed = sim.time - p.hopStart;
        let at = len;
        let dy = 0;
        let opacity = 1;
        let r = 1.7;
        let fill = "var(--accent)";

        if (p.state === "moving") {
          at = len * ease(Math.min(1, elapsed / HOP_S));
        } else if (p.state === "waiting") {
          const i = slot.get(p.id) ?? 0;
          at = Math.max(len * 0.2, len - 6 - i * QUEUE_GAP);
          // the longer the wait ahead, the hotter the dot
          opacity = 0.55 + 0.45 * Math.min(1, (p.waits[p.hop] ?? 0) / MAX_WAIT_S);
          r = 1.5;
        } else {
          const k = Math.min(1, elapsed / DROP_S);
          dy = DROP_FALL * k * k;
          opacity = 1 - k;
          fill = "var(--fault)";
          r = 1.9;
        }

        const pt = path.getPointAtLength(at);
        dot.setAttribute("cx", pt.x.toFixed(1));
        dot.setAttribute("cy", (pt.y + dy).toFixed(1));
        dot.setAttribute("r", String(r));
        dot.setAttribute("fill", fill);
        dot.setAttribute("opacity", opacity.toFixed(2));
      }

      for (const [id, dot] of dots) {
        if (!seen.has(id)) {
          dot.remove();
          dots.delete(id);
        }
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      dots.forEach((d) => d.remove());
    };
  }, [sim, group]);

  return (
    <ViewportPortal>
      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden>
        <g ref={setGroup} />
      </svg>
    </ViewportPortal>
  );
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
