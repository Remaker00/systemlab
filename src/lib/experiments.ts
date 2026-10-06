import { SLOW_LINK_MS, SPIKE_FACTOR, type FaultKind } from "./sim/engine";

/**
 * Break-the-System scenarios. Each one is an experiment in four beats:
 * what changed → what it did → what would you change? → why.
 * The copy stays short: the canvas does the showing.
 */

/** What the scenario needs to know about the current system to describe it honestly. */
export type SystemShape = {
  servers: number; // API servers that receive traffic
  balanced: boolean; // a load balancer feeds them
  cached: boolean; // a cache sits in front of the database
};

export type Scenario = {
  kind: FaultKind;
  title: string;
  /** a few words for the Break drawer */
  tag: string;
  /** which node the experiment is pinned to: a node type, resolved on the canvas */
  anchor: "users" | "api" | "database";
  /** step 1: the change, in the margin-note voice */
  change: (traffic: number) => string;
  /** step 2: what to look at while it fails */
  consequence: (shape: SystemShape) => string;
  question: string;
  options: { answer: string; reply: string }[];
  /** step 4 */
  why: string;
};

export const scenarios: Scenario[] = [
  {
    kind: "spike",
    title: "Traffic spike",
    tag: `×${SPIKE_FACTOR} traffic`,
    anchor: "users",
    change: (t) => `Demand jumps ${SPIKE_FACTOR}× at once: ${t}/s → ${t * SPIKE_FACTOR}/s.`,
    consequence: ({ servers }) =>
      servers > 1
        ? "Every server fills at once. Queues stretch back along the links and the overflow falls away in red."
        : "The queue in front of the server fills in under a second. Everything past it falls away in red.",
    question: "What would you change?",
    options: [
      {
        answer: "Add servers behind a balancer",
        reply: "Right direction: capacity becomes the pool's sum. Add → API server, and link it from the balancer.",
      },
      {
        answer: "Raise this server's capacity",
        reply: "It helps up to a point (vertical scaling), but one machine has a hard ceiling and stays a single point of failure.",
      },
      {
        answer: "Turn some requests away early",
        reply: "Rate limiting: a few users get a quick “try again” so that the rest still get through.",
      },
    ],
    why: "A server's capacity is fixed. Past it, queues grow until requests wait too long and are dropped, so a spike becomes an outage for everyone. Systems absorb spikes with headroom (more servers, scaled out) and by shedding excess load at the door.",
  },
  {
    kind: "api-down",
    title: "API server failure",
    tag: "one server dies",
    anchor: "api",
    change: () => "One API server stops responding. Nothing else changes.",
    consequence: ({ servers, balanced }) =>
      servers > 1 && balanced
        ? `About 1 in ${servers} requests dies at the dead server. Round-robin keeps sending it its turn anyway.`
        : "Nothing gets through. Every request ends at the dead server.",
    question: "What would you change?",
    options: [
      {
        answer: "Run more than one server",
        reply: "Yes: redundancy turns a total outage into a partial one.",
      },
      {
        answer: "Make the balancer skip dead servers",
        reply: "Yes: health checks let a balancer route around a failure, so users never see it.",
      },
      {
        answer: "Restart it faster",
        reply: "Faster recovery shortens the outage, but every failure is still total while it lasts.",
      },
    ],
    why: "A component that everything passes through is a single point of failure. With one server, its death is the system's death. With several behind a balancer, only its share fails, and a balancer that checks health can steer that share to the survivors.",
  },
  {
    kind: "db-down",
    title: "Database failure",
    tag: "primary goes dark",
    anchor: "database",
    change: () => "The database stops answering. The API servers are fine.",
    consequence: ({ servers, cached }) =>
      cached
        ? "Redis still answers hits, for now. Misses die at the database, so nothing is refreshed: as entries expire, the hits run out too."
        : servers > 1
          ? `All ${servers} API servers still take requests, but every one dies at the database.`
          : "The API server still takes requests, but every one of them dies at the database.",
    question: "What would you change?",
    options: [
      {
        answer: "Add more API servers",
        reply: "It won't help: they all wait on the same database. You can try it, and the errors stay.",
      },
      {
        answer: "Keep a standby copy of the database",
        reply: "Yes: a replica with failover takes over when the primary dies.",
      },
      {
        answer: "Cache answers in front of it",
        reply: "Partly: cached reads keep flowing, but anything that must reach the database still fails.",
      },
    ],
    why: "Adding API servers spreads the work, but they all share one database, so the single point of failure has only moved. Data needs its own redundancy: replicas and failover, plus caches so that some answers never need the database at all.",
  },
  {
    kind: "latency",
    title: "Slow network",
    tag: `+${SLOW_LINK_MS} ms per hop`,
    anchor: "api",
    change: () => `Every link between components gets ${SLOW_LINK_MS} ms slower. No component is broken.`,
    consequence: () =>
      "Nothing turns red, yet every request takes far longer. The delay is paid once per hop, and the hops add up.",
    question: "What would you change?",
    options: [
      {
        answer: "Add more servers",
        reply: "More servers add capacity, not speed. Each request still crosses the same slow links.",
      },
      {
        answer: "Cut hops, keep chatty parts close",
        reply: "Yes: fewer and shorter trips are the direct cure for network delay.",
      },
      {
        answer: "Cache near the users",
        reply: "Yes: an answer that doesn't cross the network doesn't pay for it.",
      },
    ],
    why: "Latency comes from the path as well as the servers. Each hop adds its delay to every request, so a slow network quietly multiplies across the architecture. Fewer hops, components placed close together and caching keep the path short. Timeouts keep a slow path from looking like a dead one.",
  },
];

export const scenarioByKind = (kind: FaultKind) => scenarios.find((s) => s.kind === kind)!;

/** How long the failure plays before its consequence is annotated, and the pause before the question. */
export const OBSERVE_S = 5;
export const QUESTION_DELAY_S = 1.5;
/** Normal operation measured before breaking, when the system wasn't already running. */
export const BASELINE_S = 3;

/** One run of a scenario on the canvas. */
export type Experiment = {
  id: number;
  kind: FaultKind;
  target: string; // node the fault (and its note) is pinned to
  breakAt: number; // sim time the fault lands
  traffic: number; // base traffic when the experiment began
  choice: number | null; // index into options, -1 = "just explain"
};

/** 0 measuring · 1 broken · 2 consequence shown · 3 question asked · 4 explained */
export function experimentStage(e: Experiment, now: number): 0 | 1 | 2 | 3 | 4 {
  if (e.choice !== null) return 4;
  if (now >= e.breakAt + OBSERVE_S + QUESTION_DELAY_S) return 3;
  if (now >= e.breakAt + OBSERVE_S) return 2;
  if (now >= e.breakAt) return 1;
  return 0;
}
