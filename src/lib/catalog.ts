import type { LabNodeType } from "./graph";
import { HOT_KEYS } from "./sim/engine";

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
};
