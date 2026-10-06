import type { Connection, Edge, Node } from "@xyflow/react";

/** Data carried by every SystemLab node. Kept tiny on purpose. */
export type LabNodeData = {
  index: string; // drawing index, e.g. "01"
  title: string; // human name, rendered in serif
  meta: string; // tiny technical annotation
  /** requests/s this node can serve; only nodes that queue have one */
  capacity?: number;
  /** caches: share of requests asking for popular, cacheable keys (0–1) */
  hitShare?: number;
  /** caches: seconds an entry lives before it expires */
  ttl?: number;
};

export type LabNodeType =
  | "users"
  | "api"
  | "database"
  | "loadbalancer"
  | "cache"
  | "gateway"
  | "cdn"
  | "queue"
  | "worker"
  | "replica";

export type LabNode = Node<LabNodeData, LabNodeType>;

export type LabEdgeData = {
  label: string;
  /** seconds before the ink draws in; staggered for the intro, immediate for user-made links */
  drawDelay?: number;
};

/** A primary feeding a replica copies data along the link; requests never travel it. */
export const isReplication = (source?: LabNodeType, target?: LabNodeType) =>
  source === "database" && target === "replica";

export type LabEdge = Edge<LabEdgeData, "sketch">;

/** requests/s a new API server can serve */
export const DEFAULT_CAPACITY = 40;
/** a new cache: share of requests for popular keys, and entry lifetime in seconds */
export const DEFAULT_HIT_SHARE = 0.8;
export const DEFAULT_TTL = 10;
/** workshop parts: a worker, a database (and its replicas), and a CDN's share of static, cacheable requests */
export const WORKER_CAPACITY = 20;
export const DB_CAPACITY = 60;
export const CDN_HIT_SHARE = 0.5;
export const CDN_TTL = 60;

/*
 * Positions are deliberately not on a straight line: a slight drift makes the
 * composition feel plotted by hand rather than auto-laid-out.
 */
export const initialNodes: LabNode[] = [
  {
    id: "users",
    type: "users",
    deletable: false, // the architecture itself is fixed; only links are editable
    position: { x: 0, y: 40 },
    data: { index: "01", title: "Users", meta: "clients · ingress" },
  },
  {
    id: "api",
    type: "api",
    deletable: false, // the architecture itself is fixed; only links are editable
    position: { x: 420, y: -30 },
    data: { index: "02", title: "API Server", meta: "compute · stateless", capacity: DEFAULT_CAPACITY },
  },
  {
    id: "database",
    type: "database",
    deletable: false, // the architecture itself is fixed; only links are editable
    position: { x: 840, y: 70 },
    data: { index: "03", title: "Database", meta: "storage · primary" },
  },
];

export const initialEdges: LabEdge[] = [
  {
    id: "users-api",
    source: "users",
    target: "api",
    type: "sketch",
    data: { label: "https · request", drawDelay: 1.2 },
  },
  {
    id: "api-database",
    source: "api",
    target: "database",
    type: "sketch",
    data: { label: "sql · query", drawDelay: 1.2 },
  },
];

/** Protocol annotation for a link, chosen by what sits at either end. */
const LINK_LABELS: Partial<Record<`${LabNodeType}>${LabNodeType}`, string>> = {
  "users>api": "https · request",
  "api>database": "sql · query",
  "users>database": "direct · access",
  "users>loadbalancer": "https · request",
  "loadbalancer>api": "http · forward",
  "api>cache": "get · key",
  "cache>database": "on miss · read",
  "users>cdn": "https · assets",
  "users>gateway": "https · request",
  "cdn>gateway": "on miss · origin",
  "cdn>loadbalancer": "on miss · origin",
  "cdn>api": "on miss · origin",
  "gateway>api": "route · /api",
  "gateway>loadbalancer": "route · forward",
  "loadbalancer>gateway": "http · forward",
  "api>queue": "publish · job",
  "api>replica": "sql · read",
  "queue>worker": "consume · job",
  "worker>database": "sql · write",
  "worker>cache": "set · key",
  "worker>replica": "sql · read",
  "worker>queue": "publish · job",
  "cache>replica": "on miss · read",
  "database>replica": "async · replicate",
};

export function linkLabel(source?: LabNodeType, target?: LabNodeType): string {
  return (source && target && LINK_LABELS[`${source}>${target}`]) || "link";
}

export function edgeId({ source, target }: Pick<Connection, "source" | "target">): string {
  return `${source}-${target}`;
}

/** Selectable steps for traffic (Users) and capacity (API), in requests/s. */
export const TRAFFIC_STEPS = [0, 5, 10, 20, 30, 40, 50, 70, 100, 150, 200] as const;
export const CAPACITY_STEPS = [10, 20, 30, 40, 60, 80, 120, 160] as const;
export const DEFAULT_TRAFFIC = 20;
export const HIT_SHARE_STEPS = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99] as const;
export const TTL_STEPS = [1, 2, 5, 10, 30, 60] as const;

/** Components the user can add to a sheet. Users are fixed; everything added is removable. */
export type AddableType = Exclude<LabNodeType, "users">;

/** What each new part is called and how it starts out. Titles count per type ("Worker 2"). */
const PARTS: Record<AddableType, { title: string; numbered?: boolean; meta: string; data?: Partial<LabNodeData> }> = {
  api: { title: "API Server", numbered: true, meta: "compute · stateless", data: { capacity: DEFAULT_CAPACITY } },
  loadbalancer: { title: "Load Balancer", meta: "routing · round-robin" },
  cache: { title: "Redis", meta: "cache · in-memory", data: { hitShare: DEFAULT_HIT_SHARE, ttl: DEFAULT_TTL } },
  gateway: { title: "API Gateway", meta: "edge · one front door" },
  cdn: { title: "CDN", meta: "edge · cached assets", data: { hitShare: CDN_HIT_SHARE, ttl: CDN_TTL } },
  queue: { title: "Queue", meta: "async · buffer" },
  worker: { title: "Worker", meta: "compute · background", data: { capacity: WORKER_CAPACITY } },
  database: { title: "Database", meta: "storage · primary", data: { capacity: DB_CAPACITY } },
  replica: { title: "Read Replica", meta: "storage · read-only", data: { capacity: DB_CAPACITY } },
};

/** Build a new node with the next drawing index. */
export function createNode(type: AddableType, existing: LabNode[], position: { x: number; y: number }): LabNode {
  const nextIndex = Math.max(0, ...existing.map((n) => Number(n.data.index) || 0)) + 1;
  const sameType = existing.filter((n) => n.type === type).length;
  const part = PARTS[type];
  // the sandbox's first server is "API Server", so added ones count on from 2; other parts are numbered from their second
  const title = part.numbered || sameType ? `${part.title} ${sameType + 1}` : part.title;
  return {
    id: `${type}-${Date.now().toString(36)}`,
    type,
    position,
    data: { index: String(nextIndex).padStart(2, "0"), title, meta: part.meta, ...part.data },
  };
}
