import { isReplication, type LabEdge, type LabNode, type LabNodeType } from "./graph";
import { isCache } from "./sim/engine";

/**
 * The Architecture Workshop's review of a drawing. It's pure and recomputed on every change, so the
 * sheet comments on the drawing while it's being drawn:
 * - links: a link between two parts that don't talk to each other that way, with the reason;
 * - missing: a part that can't do its job because a link is missing (in or out);
 * - load: what each part would carry at the set traffic, following the same routing rules as the
 *   engine (planned, not measured), so the bottleneck and the system's ceiling read before running.
 */

/** Which parts each part may send requests (or, for a primary, copies) to. */
const ALLOWED: Record<LabNodeType, readonly LabNodeType[]> = {
  users: ["cdn", "gateway", "loadbalancer", "api"],
  cdn: ["gateway", "loadbalancer", "api"],
  gateway: ["loadbalancer", "api"],
  loadbalancer: ["api", "gateway"],
  api: ["cache", "database", "replica", "queue"],
  cache: ["database", "replica"],
  queue: ["worker"],
  worker: ["database", "cache", "replica", "queue"],
  database: ["replica"],
  replica: [],
};

const STORAGE = new Set<LabNodeType>(["database", "replica", "cache"]);
const ENTRANCE = new Set<LabNodeType>(["cdn", "gateway", "loadbalancer"]);

/** Why a link is wrong: a few words for the drawing, a sentence for the review. */
function wrongLink(s: LabNodeType, t: LabNodeType): { tag: string; why: string } | null {
  if (ALLOWED[s].includes(t)) return null;
  if (s === "users" && STORAGE.has(t))
    return { tag: "no server between", why: "Users can't query storage directly: nothing checks who they are or what they may read." };
  if (s === "users")
    return { tag: "needs a front door", why: "Users send requests to a front door or a server, which then decides what to do with them." };
  if (t === "worker")
    return { tag: "workers read a queue", why: "A worker takes jobs from a queue. Nothing hands it requests directly." };
  if (s === "queue")
    return { tag: "queues feed workers", why: "A queue holds jobs until a worker takes them. Link it to workers." };
  if (s === "database")
    return { tag: "storage doesn't call out", why: "A database answers; it never calls other parts. Its only outgoing link copies data to a replica." };
  if (ENTRANCE.has(s) && (STORAGE.has(t) || t === "queue"))
    return { tag: "skips the server", why: "The front door hands requests to servers. Talking to storage is the servers' job." };
  if (ENTRANCE.has(t) || t === "users")
    return { tag: "backwards", why: "That points back toward the entrance. Requests flow from the users inward, never back out." };
  if (s === "api" && t === "api")
    return { tag: "pool, not chain", why: "Servers in a pool don't call each other. Put a balancer in front of them instead." };
  if (s === "cache" || s === "cdn")
    return { tag: "a cache backs onto storage", why: "On a miss, a cache asks what's behind it: storage for Redis, the app's front door for a CDN." };
  return { tag: "not a link", why: "These two parts don't send each other requests." };
}

export type NodeMark = {
  missingIn?: string;
  missingOut?: string;
  /** planned utilisation at the set traffic (capacity-bound parts only) */
  load?: number;
  bottleneck?: boolean;
};

export type EdgeMark = { tag: string; why: string };

export type Issue = {
  kind: "link" | "missing" | "load" | "sheet";
  node?: string;
  edge?: string;
  title: string;
  text: string;
};

export type Review = {
  nodes: Map<string, NodeMark>;
  edges: Map<string, EdgeMark>;
  issues: Issue[];
  /** traffic (req/s) at which the first part reaches its capacity; null if nothing on the path has a limit */
  ceiling: number | null;
  /** the part that gives first */
  bottleneck: string | null;
};

const STRAINED = 0.75;

export function reviewDesign(nodes: LabNode[], edges: LabEdge[], traffic: number): Review {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const type = (id: string) => byId.get(id)?.type;
  const title = (id: string) => byId.get(id)?.data.title ?? id;
  const marks = new Map<string, NodeMark>();
  const mark = (id: string) => marks.get(id) ?? (marks.set(id, {}), marks.get(id)!);
  const issues: Issue[] = [];

  // ── links that don't make sense ──
  const edgeMarks = new Map<string, EdgeMark>();
  for (const e of edges) {
    const s = type(e.source);
    const t = type(e.target);
    if (!s || !t) continue;
    const wrong = wrongLink(s, t);
    if (!wrong) continue;
    edgeMarks.set(e.id, wrong);
    issues.push({ kind: "link", edge: e.id, title: `${title(e.source)} → ${title(e.target)}`, text: wrong.why });
  }

  // ── missing connections ──
  const routed = edges.filter((e) => !isReplication(type(e.source), type(e.target)));
  const outs = (id: string) => routed.filter((e) => e.source === id);
  const ins = (id: string) => routed.filter((e) => e.target === id);
  const outTo = (id: string, kinds: LabNodeType[]) => outs(id).some((e) => kinds.includes(type(e.target)!));

  const users = nodes.find((n) => n.type === "users");
  const reached = new Set<string>();
  if (users) {
    const stack = [users.id];
    while (stack.length) {
      const at = stack.pop()!;
      if (reached.has(at)) continue;
      reached.add(at);
      for (const e of outs(at)) stack.push(e.target);
    }
  }

  const missing = (id: string, side: "in" | "out", text: string) => {
    const m = mark(id);
    if (side === "in") m.missingIn ??= text;
    else m.missingOut ??= text;
    issues.push({ kind: "missing", node: id, title: title(id), text });
  };

  for (const n of nodes) {
    const name = n.data.title;
    switch (n.type) {
      case "users":
        if (!outs(n.id).length) missing(n.id, "out", "Users have nowhere to send their requests yet.");
        continue;
      case "replica": {
        const primary = edges.some((e) => e.target === n.id && type(e.source) === "database");
        if (!primary) missing(n.id, "in", `${name} has no primary to copy from, so it has no data to answer with.`);
        else if (!ins(n.id).length) missing(n.id, "in", `Nothing reads from ${name} yet. Point a server's reads at it.`);
        else if (!reached.has(n.id)) missing(n.id, "in", `${name} is linked, but no path from Users reaches it.`);
        continue;
      }
    }

    if (!ins(n.id).length) missing(n.id, "in", `Nothing reaches ${name}.`);
    else if (!reached.has(n.id)) missing(n.id, "in", `${name} is linked, but no path from Users reaches it.`);

    if (n.type === "api" && !outTo(n.id, ["database", "replica", "cache", "queue"]))
      missing(n.id, "out", `${name} has no data behind it. What does it answer with?`);
    if (n.type === "worker" && !outs(n.id).length)
      missing(n.id, "out", `${name} finishes jobs with nowhere to keep the results.`);
    if ((n.type === "loadbalancer" || n.type === "gateway") && !outs(n.id).length)
      missing(n.id, "out", `${name} has nothing behind it to hand requests to.`);
    if (n.type === "cdn" && !outs(n.id).length)
      missing(n.id, "out", `${name} has no origin: every miss has nowhere to go.`);
    if (n.type === "cache" && !outTo(n.id, ["database", "replica"]))
      missing(n.id, "out", `${name} has no storage behind it: every miss fails.`);
    if (n.type === "queue" && !outTo(n.id, ["worker"]))
      missing(n.id, "out", `Nothing consumes ${name}: its jobs pile up until it is full.`);
  }

  if (nodes.length > 1 && !nodes.some((n) => n.type === "database"))
    issues.push({ kind: "sheet", title: "No database", text: "Nothing on the sheet keeps data. Where does the truth live?" });

  // ── planned load: follow the engine's routing at 1 req/s, then scale ──
  const perUnit = plannedArrivals(nodes, routed, users?.id);
  let ceiling: number | null = null;
  let bottleneck: string | null = null;
  for (const n of nodes) {
    const unit = perUnit.get(n.id) ?? 0;
    if (!n.data.capacity || unit <= 0) continue;
    const limit = n.data.capacity / unit;
    mark(n.id).load = traffic * (unit / n.data.capacity);
    if (ceiling === null || limit < ceiling) {
      ceiling = limit;
      bottleneck = n.id;
    }
  }
  if (bottleneck) {
    const m = mark(bottleneck);
    const load = m.load ?? 0;
    if (load >= STRAINED) {
      m.bottleneck = true;
      const behindQueue = type(bottleneck) === "worker";
      issues.push({
        kind: "load",
        node: bottleneck,
        title: title(bottleneck),
        text:
          load >= 1
            ? behindQueue
              ? `Jobs arrive faster than ${title(bottleneck)} can take them (${Math.round(load * 100)}%). The queue's backlog only grows.`
              : `${title(bottleneck)} would run at ${Math.round(load * 100)}% of its capacity. Requests queue there, then get turned away.`
            : `${title(bottleneck)} is the first to give: ${Math.round(load * 100)}% of its capacity at this traffic.`,
      });
    }
  }
  // anything else past its limit is worth a line too
  for (const [id, m] of marks) {
    if (id === bottleneck || (m.load ?? 0) < 1) continue;
    issues.push({
      kind: "load",
      node: id,
      title: title(id),
      text:
        type(id) === "worker"
          ? `Jobs arrive faster than ${title(id)} can take them (${Math.round(m.load! * 100)}%). The queue's backlog only grows.`
          : `${title(id)} would run at ${Math.round(m.load! * 100)}% of its capacity.`,
    });
  }

  return { nodes: marks, edges: edgeMarks, issues, ceiling, bottleneck };
}

/**
 * Expected requests/s reaching each node per 1 req/s from Users, routed the way the engine routes:
 * equal shares at forks (round-robin or random), shares weighted by capacity at a queue (the least
 * busy worker takes the job), and only the misses passing a cache. Each path stops at a repeat visit.
 */
function plannedArrivals(nodes: LabNode[], routed: LabEdge[], start?: string): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const arrivals = new Map<string, number>();
  if (!start) return arrivals;

  const walk = (at: string, share: number, seen: Set<string>, depth: number) => {
    if (share < 1e-4 || depth > 24) return;
    const node = byId.get(at);
    if (!node) return;
    if (at !== start) arrivals.set(at, (arrivals.get(at) ?? 0) + share);
    const onward = isCache(node.type ?? "") ? share * (1 - (node.data.hitShare ?? 0)) : share;
    const out = routed.filter((e) => e.source === at && !seen.has(e.target));
    if (!out.length) return;
    const weights = out.map((e) => (node.type === "queue" ? (byId.get(e.target)?.data.capacity ?? 0) : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    out.forEach((e, i) => {
      const part = sum > 0 ? weights[i] / sum : 1 / out.length;
      walk(e.target, onward * part, new Set(seen).add(e.target), depth + 1);
    });
  };
  walk(start, 1, new Set([start]), 0);
  return arrivals;
}
