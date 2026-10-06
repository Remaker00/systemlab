import type { LabNodeType } from "./graph";
import { HOT_KEYS, JOB_MAX_WAIT_S } from "./sim/engine";

/**
 * Static reference notes for each component, shown in the focus annotation.
 * These are descriptive only; the simulation lives in src/lib/sim.
 */
export type ComponentSpec = {
  role: string;
  summary: string;
  properties: ReadonlyArray<readonly [label: string, value: string]>;
  /** a one-line teaser of how this component fails, for the "breaking" theme */
  fragility: string;
  /** why this component exists: the problem it solves, in plain words */
  why?: string;
};

export const catalog: Record<LabNodeType, ComponentSpec> = {
  cache: {
    role: "In-memory cache",
    summary: "Keeps recent answers in memory. Ask it first; go to the database only when it doesn't know.",
    why: "Most reads ask for the same few things again and again. Answering those from memory is far faster, and every hit is a query the database never sees.",
    properties: [
      ["pattern", "read-through"],
      ["popular keys", String(HOT_KEYS)],
      ["on miss", "read db, then store"],
    ],
    fragility: "When many entries expire at once, every request misses together and the database feels all of it at once.",
  },
  loadbalancer: {
    role: "Traffic distributor",
    summary: "One front door for many servers. It passes each request on to the next server in turn.",
    why: "One server has a ceiling. Past it, requests queue, latency climbs and the overflow is refused. A balancer lets you add servers side by side, so total capacity becomes the sum of the pool.",
    properties: [
      ["strategy", "round-robin"],
      ["health checks", "none"],
      ["state", "none"],
    ],
    fragility: "Round-robin is blind. It keeps feeding a server that is already drowning.",
  },
  users: {
    role: "Traffic source",
    summary: "People and clients producing requests. Demand arrives in bursts, not as an average.",
    properties: [
      ["shape", "bursty"],
      ["protocol", "https"],
      ["retries", "on failure"],
    ],
    fragility: "Retries multiply load just when the system is weakest.",
  },
  api: {
    role: "Stateless compute",
    summary: "Accepts requests, applies logic and calls downstream. Holds no data of its own.",
    properties: [
      ["instances", "1"],
      ["state", "none"],
      ["scales", "horizontally"],
    ],
    fragility: "A single instance is a single point of failure.",
  },
  database: {
    role: "Durable storage",
    summary: "The source of truth. Every write lands here, and so does every read that misses a cache.",
    properties: [
      ["mode", "primary"],
      ["connections", "pooled"],
      ["scales", "vertically"],
    ],
    fragility: "Connection limits are reached long before CPU is.",
  },
  gateway: {
    role: "Front door",
    summary: "One address for the whole backend. Every request enters here and is routed to a service behind it.",
    why: "Clients shouldn't know how many servers you run or where they live. One door is also the one place to check who's calling and to turn excess away.",
    properties: [
      ["routing", "round-robin"],
      ["auth", "at the door"],
      ["cost", "~2 ms"],
    ],
    fragility: "Everything passes through it. If the door is shut, nothing behind it matters.",
  },
  cdn: {
    role: "Edge cache",
    summary: "Copies of your static answers kept close to the users. A hit never crosses your network at all.",
    why: "Many requests are for the same images, scripts and pages. Serving those from the edge removes them from your servers entirely.",
    properties: [
      ["sits", "before the front door"],
      ["serves", "static, cacheable"],
      ["on miss", "asks the origin"],
    ],
    fragility: "Purge it, or let it expire, and the whole crowd lands on the origin at once.",
  },
  queue: {
    role: "Buffer",
    summary: "Takes a job, answers \"accepted\" straight away, and holds the job until a worker is free.",
    why: "Slow work (emails, images, reports) doesn't need to finish while the caller waits. A queue lets bursts arrive faster than they can be done, and evens them out.",
    properties: [
      ["answers", "on accept"],
      ["delivery", "least-busy worker"],
      ["holds", `up to ~${JOB_MAX_WAIT_S}s of work`],
    ],
    fragility: "A queue hides a slow consumer. The backlog grows quietly until it is full.",
  },
  worker: {
    role: "Background compute",
    summary: "Takes jobs from a queue one at a time and does the slow part, out of the caller's way.",
    why: "Workers scale apart from the API: add workers when the backlog grows, without touching the request path.",
    properties: [
      ["reads from", "a queue"],
      ["state", "none"],
      ["scales", "horizontally"],
    ],
    fragility: "Too few workers and the backlog only ever grows.",
  },
  replica: {
    role: "Read-only copy",
    summary: "A copy of the primary database that answers reads, so the primary has more room for writes.",
    why: "Most traffic reads. Spreading reads across copies multiplies read capacity without making one machine bigger.",
    properties: [
      ["copies", "the primary"],
      ["serves", "reads only"],
      ["lag", "slightly behind"],
    ],
    fragility: "It's always a moment behind: a read just after a write may not see it yet.",
  },
};
