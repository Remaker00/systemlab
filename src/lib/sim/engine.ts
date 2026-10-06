/**
 * SystemLab request simulation. It's local, deterministic in structure and random in arrivals.
 *
 * The model is intentionally small, so the concepts stay legible:
 * - Users emit requests as a Poisson process at `rate` req/s.
 * - Each request walks the current graph from Users along outgoing links
 *   (a random link is picked where there are several) until it reaches a node with no way out.
 * - Nodes with a `capacity` behave as a single FIFO server (service time = 1/capacity).
 *   Queueing makes latency rise without any extra rule as utilisation nears 100%.
 *   A request that would wait longer than MAX_WAIT_S is rejected (an error).
 * - Requests with no route out of Users fail at once (an error).
 *
 * Visual particles are a sampled view of the same requests. They travel each link in
 * HOP_S seconds and sit in a visible queue for exactly as long as the model says they wait.
 */

export type SimNode = { id: string; type: string; capacity?: number };
export type SimEdge = { id: string; source: string; target: string };
export type SimGraph = { nodes: SimNode[]; edges: SimEdge[] };

export const HOP_S = 0.9; // visual travel time per link
export const MAX_WAIT_S = 1.0; // queueing budget before a request is rejected
const NET_MS = 4; // per-link network cost
const LATENCY_FLOOR_MS: Record<string, number> = { database: 6 }; // fixed work at non-queueing nodes
const MAX_PARTICLES = 360;
const MAX_VISIBLE_RATE = 70; // above this, particles sample the traffic
export const DROP_S = 0.9; // how long a rejected particle takes to fall away

export type ParticleState = "moving" | "waiting" | "dropped";

export type Particle = {
  id: number;
  route: string[]; // edge ids
  hop: number; // index into route
  hopStart: number; // sim time the current hop (or wait/drop) began
  state: ParticleState;
  waits: Record<number, number>; // hop index → seconds to wait at that hop's target
  rejectAtHop: number | null; // dropped on arrival at this hop's target
};

export type NodeLoad = {
  capacity: number;
  /** arrivals in the last second divided by capacity. Can exceed 1. */
  load: number;
  queue: number;
  overloaded: boolean;
};

export type Metrics = {
  total: number;
  rps: number;
  latencyMs: number; // smoothed mean latency of successful requests
  errors: number;
  errorRate: number; // share of the last 2s of requests that failed
  arrivals: Record<string, number>; // node id → requests/s reaching it
  loads: Record<string, NodeLoad>;
};

export const emptyMetrics: Metrics = {
  total: 0,
  rps: 0,
  latencyMs: 0,
  errors: 0,
  errorRate: 0,
  arrivals: {},
  loads: {},
};

type Sample = { t: number; ok: boolean; latencyMs: number };

export class Simulation {
  time = 0;
  particles: Particle[] = [];

  private nextArrival = 0;
  private nextParticleId = 0;
  private busyUntil = new Map<string, number>();
  private samples: Sample[] = [];
  private nodeArrivals: { t: number; node: string }[] = [];
  private total = 0;
  private errors = 0;
  private latencyEma = 0;

  reset() {
    this.time = 0;
    this.particles = [];
    this.nextArrival = 0;
    this.busyUntil.clear();
    this.samples = [];
    this.nodeArrivals = [];
    this.total = 0;
    this.errors = 0;
    this.latencyEma = 0;
  }

  /** Advance by dt seconds. */
  step(dt: number, rate: number, graph: SimGraph) {
    this.time += dt;
    const now = this.time;

    if (rate > 0) {
      if (this.nextArrival < now - 1) this.nextArrival = now; // after a rate change from 0
      while (this.nextArrival <= now) {
        this.spawn(this.nextArrival, rate, graph);
        this.nextArrival += -Math.log(1 - Math.random()) / rate;
      }
    } else {
      this.nextArrival = now;
    }

    this.advanceParticles(now, graph);
    this.trim(now);
  }

  private spawn(t: number, rate: number, graph: SimGraph) {
    this.total++;
    const route = pickRoute(graph);
    if (!route.length) {
      this.record(t, false, 0);
      return;
    }

    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    const edges = new Map(graph.edges.map((e) => [e.id, e]));
    const waits: Record<number, number> = {};
    let latencyMs = 0;
    let rejectAtHop: number | null = null;

    for (let hop = 0; hop < route.length; hop++) {
      const target = nodes.get(edges.get(route[hop])!.target)!;
      latencyMs += NET_MS;
      this.nodeArrivals.push({ t, node: target.id });

      if (target.capacity) {
        const service = 1 / target.capacity;
        const busy = this.busyUntil.get(target.id) ?? 0;
        const wait = Math.max(0, busy - t);
        if (wait > MAX_WAIT_S) {
          rejectAtHop = hop;
          break;
        }
        this.busyUntil.set(target.id, Math.max(t, busy) + service);
        waits[hop] = wait;
        latencyMs += (wait + service) * 1000;
      } else {
        latencyMs += (LATENCY_FLOOR_MS[target.type] ?? 0) * (0.8 + Math.random() * 0.4);
      }
    }

    const ok = rejectAtHop === null;
    this.record(t, ok, latencyMs);

    // sample what we draw so heavy traffic stays legible
    const visible = rate <= MAX_VISIBLE_RATE || Math.random() < MAX_VISIBLE_RATE / rate;
    if (visible && this.particles.length < MAX_PARTICLES) {
      this.particles.push({
        id: this.nextParticleId++,
        route,
        hop: 0,
        hopStart: t,
        state: "moving",
        waits,
        rejectAtHop,
      });
    }
  }

  private record(t: number, ok: boolean, latencyMs: number) {
    this.samples.push({ t, ok, latencyMs });
    if (!ok) this.errors++;
    else this.latencyEma = this.latencyEma ? this.latencyEma * 0.94 + latencyMs * 0.06 : latencyMs;
  }

  private advanceParticles(now: number, graph: SimGraph) {
    const live = new Set(graph.edges.map((e) => e.id));
    this.particles = this.particles.filter((p) => {
      // a link was cut under this particle
      if (p.state !== "dropped" && !live.has(p.route[p.hop])) return false;

      const elapsed = now - p.hopStart;
      if (p.state === "dropped") return elapsed < DROP_S;
      if (p.state === "waiting") {
        if (elapsed < (p.waits[p.hop] ?? 0)) return true;
        return this.nextHop(p, p.hopStart + (p.waits[p.hop] ?? 0));
      }
      // moving
      if (elapsed < HOP_S) return true;
      const arrived = p.hopStart + HOP_S;
      if (p.rejectAtHop === p.hop) {
        p.state = "dropped";
        p.hopStart = arrived;
        return true;
      }
      if ((p.waits[p.hop] ?? 0) > 0) {
        p.state = "waiting";
        p.hopStart = arrived;
        return true;
      }
      return this.nextHop(p, arrived);
    });
  }

  private nextHop(p: Particle, at: number): boolean {
    p.hop++;
    if (p.hop >= p.route.length) return false;
    p.state = "moving";
    p.hopStart = at;
    return true;
  }

  private trim(now: number) {
    while (this.samples.length && this.samples[0].t < now - 2) this.samples.shift();
    while (this.nodeArrivals.length && this.nodeArrivals[0].t < now - 1) this.nodeArrivals.shift();
  }

  snapshot(graph: SimGraph): Metrics {
    const now = this.time;
    const lastSecond = this.samples.filter((s) => s.t >= now - 1).length;
    const failed = this.samples.filter((s) => !s.ok).length;

    const arrivals: Record<string, number> = {};
    for (const a of this.nodeArrivals) arrivals[a.node] = (arrivals[a.node] ?? 0) + 1;

    const loads: Record<string, NodeLoad> = {};
    for (const n of graph.nodes) {
      if (!n.capacity) continue;
      const load = (arrivals[n.id] ?? 0) / n.capacity;
      const backlog = Math.max(0, (this.busyUntil.get(n.id) ?? 0) - now);
      loads[n.id] = {
        capacity: n.capacity,
        load,
        queue: Math.round(backlog * n.capacity),
        // a little margin so the alarm doesn't flicker while hovering right at 100%
        overloaded: load >= 1.05 || backlog > MAX_WAIT_S * 0.8,
      };
    }

    return {
      total: this.total,
      rps: lastSecond,
      latencyMs: this.latencyEma,
      errors: this.errors,
      errorRate: this.samples.length ? failed / this.samples.length : 0,
      arrivals,
      loads,
    };
  }
}

/** Walk outgoing links from the Users node, choosing randomly at forks. Cycles are cut off. */
function pickRoute(graph: SimGraph): string[] {
  const start = graph.nodes.find((n) => n.type === "users");
  if (!start) return [];
  const route: string[] = [];
  const seen = new Set([start.id]);
  let at = start.id;
  for (;;) {
    const out = graph.edges.filter((e) => e.source === at && !seen.has(e.target));
    if (!out.length) return route;
    const next = out[Math.floor(Math.random() * out.length)];
    route.push(next.id);
    seen.add(next.target);
    at = next.target;
  }
}
