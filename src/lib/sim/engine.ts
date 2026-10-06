/**
 * SystemLab request simulation. It's local, deterministic in structure and random in arrivals.
 *
 * The model is intentionally small, so the concepts stay legible:
 * - Users emit requests as a Poisson process at `rate` req/s.
 * - Each request walks the current graph from Users along outgoing links until it reaches a
 *   node with no way out. A load balancer hands requests to its links in strict rotation
 *   (round-robin). Any other fork picks a link at random.
 * - Nodes with a `capacity` behave as a single FIFO server (service time = 1/capacity).
 *   Queueing makes latency rise without any extra rule as utilisation nears 100%.
 *   A request that would wait longer than MAX_WAIT_S is rejected (an error).
 * - Requests with no route out of Users fail at once (an error).
 *
 * Visual particles are a sampled view of the same requests. They travel each link in
 * HOP_S seconds and sit in a visible queue for exactly as long as the model says they wait.
 *
 * Caches (Redis) sit inline: API → cache → database. Each request asks for a key. With
 * probability `hitShare` it's one of HOT_KEYS popular keys, otherwise it's a key never seen before.
 * A cached, unexpired key is a hit: the request is answered at the cache. Anything else is a
 * miss: it continues to the database, and on success the key is stored for `ttl` seconds.
 * So the measured hit rate is the hit share minus whatever the TTL lets expire.
 *
 * Faults (Break the System) are applied inside the model from a given sim time:
 * - spike: Users emit SPIKE_FACTOR × the set rate
 * - api-down / db-down: the target node rejects every request that reaches it
 * - latency: every link costs SLOW_LINK_MS more, and particles cross links more slowly
 */

export type SimNode = {
  id: string;
  type: string;
  capacity?: number;
  hitShare?: number; // caches: share of requests for popular (cacheable) keys
  ttl?: number; // caches: seconds an entry lives
};
export type SimEdge = { id: string; source: string; target: string };
export type SimGraph = { nodes: SimNode[]; edges: SimEdge[] };

export const HOP_S = 0.9; // visual travel time per link
export const MAX_WAIT_S = 1.0; // queueing budget before a request is rejected
const NET_MS = 4; // per-link network cost
export const SPIKE_FACTOR = 10;
export const SLOW_LINK_MS = 300;
const SLOW_HOP_FACTOR = 2.2; // visual slow-down of particles on degraded links

export type FaultKind = "spike" | "api-down" | "db-down" | "latency";
export type Fault = { kind: FaultKind; target: string | null; from: number };

export const isFaultActive = (fault: Fault | null, time: number): fault is Fault => !!fault && time >= fault.from;
const LATENCY_FLOOR_MS: Record<string, number> = { database: 6, loadbalancer: 1 }; // fixed work at non-queueing nodes
export const CACHE_MS = 0.5; // an in-memory lookup
export const HOT_KEYS = 30;
export const POP_S = 0.4; // the flash of a cache hit / store
export const STORE_HOP_FACTOR = 0.6; // the store-back travels faster than a request
const MAX_PARTICLES = 360;
const MAX_VISIBLE_RATE = 70; // above this, particles sample the traffic
export const DROP_S = 0.9; // how long a rejected particle takes to fall away

export type ParticleState = "moving" | "waiting" | "dropped" | "returning" | "pop";

export type Particle = {
  id: number;
  route: string[]; // edge ids
  hop: number; // index into route
  hopStart: number; // sim time the current hop (or wait/drop) began
  hopS: number; // visual seconds per link for this request
  state: ParticleState;
  waits: Record<number, number>; // hop index → seconds to wait at that hop's target
  rejectAtHop: number | null; // dropped on arrival at this hop's target
  cacheHop: number | null; // missed at this hop's target (a cache); later hops are the miss path
  hitAtHop: number | null; // answered by the cache at this hop's target
  storeAtHop: number | null; // on arrival here, carry the value back to the cache (reverse of this edge)
  popAtStart: boolean; // where the "pop" flash sits on the current edge
};

export type CacheStats = {
  hitShare: number;
  ttl: number;
  hitRate: number; // measured, last 2s
  lookups: number; // per second
  hitMs: number; // time spent from the cache onward, for hits
  missMs: number; // …and for misses (cache + database round)
};

export type NodeLoad = {
  capacity: number;
  /** arrivals in the last second divided by capacity. Can exceed 1. */
  load: number;
  queue: number;
  overloaded: boolean;
};

export type Metrics = {
  time: number; // sim time of this snapshot
  total: number;
  rps: number;
  latencyMs: number; // smoothed mean latency of successful requests
  errors: number;
  errorRate: number; // share of the last 2s of requests that failed
  arrivals: Record<string, number>; // node id → requests/s reaching it
  loads: Record<string, NodeLoad>;
  caches: Record<string, CacheStats>;
};

export const emptyMetrics: Metrics = {
  time: 0,
  total: 0,
  rps: 0,
  latencyMs: 0,
  errors: 0,
  errorRate: 0,
  arrivals: {},
  loads: {},
  caches: {},
};

type Sample = { t: number; ok: boolean; latencyMs: number };

export class Simulation {
  time = 0;
  particles: Particle[] = [];

  private nextArrival = 0;
  private nextParticleId = 0;
  private busyUntil = new Map<string, number>();
  private rotation = new Map<string, number>(); // load balancer id → requests handed out so far
  // cache id → key → stored at. Expiry is checked against the cache's *current* TTL, so changing
  // the TTL takes effect at once (a teaching choice: real Redis keeps each entry's original TTL).
  private stores = new Map<string, Map<string, number>>();
  private lookups: { t: number; node: string; hit: boolean }[] = [];
  private cacheMs = new Map<string, { hit: number; miss: number }>(); // smoothed downstream latency
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
    this.rotation.clear();
    this.stores.clear();
    this.lookups = [];
    this.cacheMs.clear();
    this.samples = [];
    this.nodeArrivals = [];
    this.total = 0;
    this.errors = 0;
    this.latencyEma = 0;
  }

  /** Advance by dt seconds. */
  step(dt: number, baseRate: number, graph: SimGraph, fault: Fault | null = null) {
    this.time += dt;
    const now = this.time;
    const active = isFaultActive(fault, now) ? fault : null;
    const rate = active?.kind === "spike" ? baseRate * SPIKE_FACTOR : baseRate;

    if (rate > 0) {
      if (this.nextArrival < now - 1) this.nextArrival = now; // after a rate change from 0
      while (this.nextArrival <= now) {
        this.spawn(this.nextArrival, rate, graph, active);
        this.nextArrival += -Math.log(1 - Math.random()) / rate;
      }
    } else {
      this.nextArrival = now;
    }

    this.advanceParticles(now, graph);
    this.trim(now);
  }

  private spawn(t: number, rate: number, graph: SimGraph, fault: Fault | null) {
    this.total++;
    const route = this.pickRoute(graph);
    if (!route.length) {
      this.record(t, false, 0);
      return;
    }

    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    const edges = new Map(graph.edges.map((e) => [e.id, e]));
    const waits: Record<number, number> = {};
    let latencyMs = 0;
    let rejectAtHop: number | null = null;
    let hitAtHop: number | null = null;
    let miss: { cache: string; hop: number; key: string | null; startMs: number } | null = null;

    for (let hop = 0; hop < route.length; hop++) {
      const target = nodes.get(edges.get(route[hop])!.target)!;
      latencyMs += NET_MS + (fault?.kind === "latency" ? SLOW_LINK_MS : 0);
      this.nodeArrivals.push({ t, node: target.id });

      if ((fault?.kind === "api-down" || fault?.kind === "db-down") && fault.target === target.id) {
        rejectAtHop = hop; // a dead node refuses everything that reaches it
        break;
      }

      if (target.type === "cache") {
        const startMs = latencyMs;
        latencyMs += CACHE_MS;
        const store = this.storeFor(target.id);
        const key = Math.random() < (target.hitShare ?? 0) ? `k${Math.floor(Math.random() * HOT_KEYS)}` : null;
        const storedAt = key === null ? undefined : store.get(key);
        const hit = storedAt !== undefined && t < storedAt + (target.ttl ?? 0);
        this.lookups.push({ t, node: target.id, hit });
        if (hit) {
          hitAtHop = hop;
          this.smoothCacheMs(target.id, "hit", CACHE_MS);
          break;
        }
        miss = { cache: target.id, hop, key, startMs };
        if (hop === route.length - 1) {
          rejectAtHop = hop; // a miss with no source of truth behind the cache
          break;
        }
        continue;
      }

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

    // a miss that reached the database brings the value back: store it for the next asker
    const stored = ok && miss !== null;
    if (stored && miss) {
      if (miss.key) this.storeFor(miss.cache).set(miss.key, t);
      this.smoothCacheMs(miss.cache, "miss", latencyMs - miss.startMs);
    }

    // sample what we draw so heavy traffic stays legible
    const visible = rate <= MAX_VISIBLE_RATE || Math.random() < MAX_VISIBLE_RATE / rate;
    if (visible && this.particles.length < MAX_PARTICLES) {
      this.particles.push({
        id: this.nextParticleId++,
        route: hitAtHop === null ? route : route.slice(0, hitAtHop + 1),
        hop: 0,
        hopStart: t,
        hopS: fault?.kind === "latency" ? HOP_S * SLOW_HOP_FACTOR : HOP_S,
        state: "moving",
        waits,
        rejectAtHop,
        cacheHop: miss?.hop ?? null,
        hitAtHop,
        storeAtHop: stored && miss ? miss.hop + 1 : null,
        popAtStart: false,
      });
    }
  }

  private record(t: number, ok: boolean, latencyMs: number) {
    this.samples.push({ t, ok, latencyMs });
    if (!ok) this.errors++;
    else this.latencyEma = this.latencyEma ? this.latencyEma * 0.94 + latencyMs * 0.06 : latencyMs;
  }

  private storeFor(cache: string) {
    let store = this.stores.get(cache);
    if (!store) this.stores.set(cache, (store = new Map()));
    return store;
  }

  private smoothCacheMs(cache: string, kind: "hit" | "miss", ms: number) {
    const cur = this.cacheMs.get(cache) ?? { hit: 0, miss: 0 };
    cur[kind] = cur[kind] ? cur[kind] * 0.9 + ms * 0.1 : ms;
    this.cacheMs.set(cache, cur);
  }

  private advanceParticles(now: number, graph: SimGraph) {
    const live = new Set(graph.edges.map((e) => e.id));
    this.particles = this.particles.filter((p) => {
      // a link was cut under this particle
      if (p.state !== "dropped" && !live.has(p.route[p.hop])) return false;

      const elapsed = now - p.hopStart;
      if (p.state === "dropped") return elapsed < DROP_S;
      if (p.state === "pop") return elapsed < POP_S;
      if (p.state === "returning") {
        if (elapsed < p.hopS * STORE_HOP_FACTOR) return true;
        p.state = "pop"; // stored: a small flash back at the cache
        p.popAtStart = true;
        p.hopStart += p.hopS * STORE_HOP_FACTOR;
        return true;
      }
      if (p.state === "waiting") {
        if (elapsed < (p.waits[p.hop] ?? 0)) return true;
        return this.nextHop(p, p.hopStart + (p.waits[p.hop] ?? 0));
      }
      // moving
      if (elapsed < p.hopS) return true;
      const arrived = p.hopStart + p.hopS;
      if (p.rejectAtHop === p.hop) {
        p.state = "dropped";
        p.hopStart = arrived;
        return true;
      }
      if (p.hitAtHop === p.hop) {
        p.state = "pop"; // answered from memory
        p.hopStart = arrived;
        return true;
      }
      if (p.storeAtHop === p.hop) {
        p.state = "returning";
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
    while (this.lookups.length && this.lookups[0].t < now - 2) this.lookups.shift();
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

    const caches: Record<string, CacheStats> = {};
    for (const n of graph.nodes) {
      if (n.type !== "cache") continue;
      const mine = this.lookups.filter((l) => l.node === n.id);
      const hits = mine.filter((l) => l.hit).length;
      const ms = this.cacheMs.get(n.id);
      caches[n.id] = {
        hitShare: n.hitShare ?? 0,
        ttl: n.ttl ?? 0,
        hitRate: mine.length ? hits / mine.length : 0,
        lookups: mine.length / 2,
        hitMs: ms?.hit ?? CACHE_MS,
        missMs: ms?.miss ?? 0,
      };
    }

    return {
      time: now,
      total: this.total,
      rps: lastSecond,
      latencyMs: this.latencyEma,
      errors: this.errors,
      errorRate: this.samples.length ? failed / this.samples.length : 0,
      arrivals,
      loads,
      caches,
    };
  }

  /** Walk outgoing links from Users: round-robin at load balancers, random at other forks. Cycles are cut off. */
  private pickRoute(graph: SimGraph): string[] {
    const start = graph.nodes.find((n) => n.type === "users");
    if (!start) return [];
    const types = new Map(graph.nodes.map((n) => [n.id, n.type]));
    const route: string[] = [];
    const seen = new Set([start.id]);
    let at = start.id;
    for (;;) {
      const out = graph.edges.filter((e) => e.source === at && !seen.has(e.target));
      if (!out.length) return route;
      let next: SimEdge;
      if (types.get(at) === "loadbalancer") {
        const turn = this.rotation.get(at) ?? 0;
        this.rotation.set(at, turn + 1);
        next = out[turn % out.length];
      } else {
        next = out[Math.floor(Math.random() * out.length)];
      }
      route.push(next.id);
      seen.add(next.target);
      at = next.target;
    }
  }
}
