import { DEFAULT_TRAFFIC, initialEdges, initialNodes, type LabEdge, type LabNode } from "./graph";
import type { Sample } from "./sim/history";

/**
 * Challenge 01, "The surge": 1,000 req/s becomes 10,000 req/s.
 *
 * The engine models individual requests, so this sheet runs at a scale where one simulated
 * request stands for SCALE real ones. Every rate shown on this sheet is multiplied by SCALE;
 * latencies and percentages are not.
 */

export const SCALE = 50;
export const CALM_RATE = 20; // ×50 = 1,000/s
export const SURGE_RATE = 200; // ×50 = 10,000/s
export const API_CAPACITY = 60; // ×50 = 3,000/s per server
export const DB_CAPACITY = 80; // ×50 = 4,000/s
export const DB_ID = "database";

// ── sheets ─────────────────────────────────────────────────────────

export type SheetId = "foundation" | "surge" | "workshop";

export type Sheet = {
  id: SheetId;
  number: string;
  title: string;
  kind: "sandbox" | "challenge" | "workshop";
  scale: number;
  traffic: number;
  nodes: LabNode[];
  edges: LabEdge[];
};

const surgeNodes: LabNode[] = [
  {
    id: "users",
    type: "users",
    deletable: false,
    position: { x: 0, y: 40 },
    data: { index: "01", title: "Users", meta: "clients · 10× tonight" },
  },
  {
    id: DB_ID,
    type: "database",
    deletable: false,
    position: { x: 1100, y: 40 },
    data: { index: "02", title: "Database", meta: "storage · primary", capacity: DB_CAPACITY },
  },
];

export const sheets: Record<SheetId, Sheet> = {
  foundation: {
    id: "foundation",
    number: "01",
    title: "Foundation",
    kind: "sandbox",
    scale: 1,
    traffic: DEFAULT_TRAFFIC,
    nodes: initialNodes,
    edges: initialEdges,
  },
  surge: {
    id: "surge",
    number: "02",
    title: "The surge",
    kind: "challenge",
    scale: SCALE,
    traffic: CALM_RATE,
    nodes: surgeNodes,
    edges: [],
  },
  // the Architecture Workshop: a blank sheet with only the traffic source; everything else is built
  workshop: {
    id: "workshop",
    number: "03",
    title: "Workshop",
    kind: "workshop",
    scale: 1,
    traffic: DEFAULT_TRAFFIC,
    nodes: [
      {
        id: "users",
        type: "users",
        deletable: false,
        position: { x: 0, y: 40 },
        data: { index: "01", title: "Users", meta: "clients · ingress" },
      },
    ],
    edges: [],
  },
};

/** Tunables the challenge fixes, so the answer has to be architecture, not a bigger box. */
export const CHALLENGE_LOCKED = ["capacity", "hitShare"] as const;

// ── the trial ──────────────────────────────────────────────────────
// calm → surge → one server dies. Each phase is measured once it has settled.

export const PHASES = [
  { key: "calm", label: "1,000/s · an ordinary evening", from: 0, to: 3, rate: CALM_RATE },
  { key: "surge", label: "10,000/s · the surge", from: 3, to: 12, rate: SURGE_RATE },
  { key: "outage", label: "a server dies mid-surge", from: 12, to: 18, rate: SURGE_RATE },
] as const;
export const TRIAL_S = 18;
const SURGE_WINDOW = [7, 12] as const; // after the surge has settled
const OUTAGE_WINDOW = [14, 18] as const; // after the loss has been felt

export type Trial = {
  attempt: number;
  startedAt: number; // sim time
  victim: string | null; // API server that will be taken down in the outage phase
};

export function trialPhase(trial: Trial, now: number) {
  const t = now - trial.startedAt;
  return PHASES.find((p) => t >= p.from && t < p.to) ?? null; // null once finished
}

export const trialDone = (trial: Trial, now: number) => now - trial.startedAt >= TRIAL_S;

// ── scoring ────────────────────────────────────────────────────────

/** What the evaluation needs to know about the drawn architecture. */
export type Architecture = {
  servers: number; // API servers that receive links
  balanced: boolean;
  cached: boolean;
};

export type Criterion = {
  key: "capacity" | "latency" | "availability" | "database";
  label: string;
  score: number; // 0–25
  figure: string; // the measured number it was judged on
  why: string;
  question: string; // asked when the score is short, so the next attempt has a direction, not an answer
};

export type TrialResult = {
  total: number; // 0–100
  verdict: string;
  criteria: Criterion[];
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const per = (v: number) => `${Math.round(v * 100)}%`;
const rate = (v: number) => `${Math.round(v * SCALE).toLocaleString("en-US")}/s`;

export function scoreTrial(samples: Sample[], trial: Trial, arch: Architecture): TrialResult {
  const within = ([a, b]: readonly [number, number]) =>
    samples.filter((s) => s.time >= trial.startedAt + a && s.time <= trial.startedAt + b);
  const surge = within(SURGE_WINDOW);
  const outage = within(OUTAGE_WINDOW);

  const served = 1 - mean(surge.map((s) => s.errorRate));
  const latency = mean(surge.map((s) => s.latencyMs));
  const survived = 1 - mean(outage.map((s) => s.errorRate));
  // Judge the database at full demand: a system that turned most requests away upstream
  // leaves the database idle, which is starvation, not protection.
  const dbLoad = mean(surge.map((s) => s.loads[DB_ID] ?? 0)) / Math.max(served, 0.05);
  const poolCapacity = arch.servers * API_CAPACITY;
  const survivors = (arch.servers - 1) * API_CAPACITY;
  // without health checks a balancer keeps handing the dead server its turn: 1 in n requests is lost
  const blindShare = arch.servers > 1 ? `about 1 in ${arch.servers}` : "every";

  const criteria: Criterion[] = [
    {
      key: "capacity",
      label: "Capacity",
      score: 25 * clamp01((served - 0.5) / 0.48),
      figure: `${per(served)} served`,
      why:
        served < 0.01
          ? "No request found a way through: Users aren't connected to anything that answers yet."
          : arch.servers === 0
            ? "Requests went straight to the database. Nothing in front of it could share the work."
          : served >= 0.98
            ? `${arch.servers} server${arch.servers > 1 ? "s" : ""} offered ${rate(poolCapacity)}, enough for the 10,000/s peak.`
            : poolCapacity >= SURGE_RATE
              ? `The servers had room (${rate(poolCapacity)} between them), yet requests were still turned away. The limit was further down the line.`
              : `${arch.servers} server${arch.servers > 1 ? "s" : ""} could serve ${rate(poolCapacity)} together. The surge brought 10,000/s, so the excess queued and was turned away.`,
      question:
        poolCapacity >= SURGE_RATE
          ? "Where exactly are requests being turned away?"
          : "How many requests can one server take, and how many arrive?",
    },
    {
      key: "latency",
      label: "Latency",
      // latency and database load only mean something for requests that got through
      score: served < 0.05 ? 0 : 25 * clamp01((800 - latency) / (800 - 120)),
      figure: served < 0.05 ? "—" : `${Math.round(latency)} ms`,
      why:
        served < 0.05
          ? "Nothing was answered, so there was no response time to measure."
          : latency <= 120
          ? "Requests found room everywhere they went, so nobody waited long."
          : "Somewhere ran close to its limit, so requests queued and waited their turn.",
      question: "Which part is running hottest, and what is waiting for it?",
    },
    {
      key: "availability",
      label: "Availability",
      // Full marks at 80%: with blind round-robin, (n−1)/n is the ceiling, so this asks for a pool of 5+
      // with survivors strong enough to carry the rest.
      score: arch.servers === 0 ? 0 : 25 * clamp01((survived - 0.5) / 0.3),
      figure: arch.servers === 0 ? "no servers" : `${per(survived)} served`,
      why:
        arch.servers <= 1
          ? "With a single server, losing it meant losing everything."
          : survivors < SURGE_RATE
            ? `The ${arch.servers - 1} survivors had only ${rate(survivors)} between them, and ${blindShare} requests still went to the dead server.`
            : `The other ${arch.servers - 1} carried on. Still, ${blindShare} requests went to the dead server: nothing told the traffic it was gone.`,
      question: "If any one box disappears, what's left?",
    },
    {
      key: "database",
      label: "Database load",
      score: served < 0.05 ? 0 : 25 * clamp01((1.3 - dbLoad) / (1.3 - 0.75)),
      figure: served < 0.05 ? "—" : served < 0.98 ? `${per(dbLoad)} at full demand` : `${per(dbLoad)} busy`,
      why: served < 0.05
        ? "Nothing got far enough to touch the database."
        : arch.cached
        ? dbLoad <= 0.75
          ? `Most reads were answered from memory, so the database ran at ${per(dbLoad)}.`
          : `Even behind a cache, the database ran at ${per(dbLoad)}. Not every read was a hit.`
        : dbLoad <= 0.75
          ? `The database ran at ${per(dbLoad)}: it was comfortable.`
          : served < 0.98
            ? `Little reached the database because little got through. At full demand every read would land on a database built for ${rate(DB_CAPACITY)}: ${per(dbLoad)}.`
            : `Every read reached a database built for ${rate(DB_CAPACITY)}, so it ran at ${per(dbLoad)}.`,
      question: "Do all of those reads really need the database?",
    },
  ];

  const total = Math.round(criteria.reduce((sum, c) => sum + c.score, 0));
  const verdict =
    total >= 90 ? "It holds." : total >= 65 ? "It bends." : total >= 35 ? "It cracks." : "It falls over.";
  return { total, verdict, criteria };
}
