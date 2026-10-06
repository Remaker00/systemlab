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

export type LabNodeType = "users" | "api" | "database" | "loadbalancer" | "cache";

export type LabNode = Node<LabNodeData, LabNodeType>;

export type LabEdgeData = {
  label: string;
  /** seconds before the ink draws in; staggered for the intro, immediate for user-made links */
  drawDelay?: number;
};

export type LabEdge = Edge<LabEdgeData, "sketch">;

/** requests/s a new API server can serve */
export const DEFAULT_CAPACITY = 40;
/** a new cache: share of requests for popular keys, and entry lifetime in seconds */
export const DEFAULT_HIT_SHARE = 0.8;
export const DEFAULT_TTL = 10;

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

/** Components the user can add to the sheet. The original three are fixed; these are removable. */
export type AddableType = Extract<LabNodeType, "loadbalancer" | "api" | "cache">;

/** Build a new node with the next drawing index. Titles count per type ("API Server 2"). */
export function createNode(type: AddableType, existing: LabNode[], position: { x: number; y: number }): LabNode {
  const nextIndex = Math.max(0, ...existing.map((n) => Number(n.data.index) || 0)) + 1;
  const sameType = existing.filter((n) => n.type === type).length;
  const index = String(nextIndex).padStart(2, "0");
  const id = `${type}-${Date.now().toString(36)}`;

  if (type === "cache") {
    return {
      id,
      type,
      position,
      data: {
        index,
        title: sameType ? `Redis ${sameType + 1}` : "Redis",
        meta: "cache · in-memory",
        hitShare: DEFAULT_HIT_SHARE,
        ttl: DEFAULT_TTL,
      },
    };
  }
  if (type === "loadbalancer") {
    return {
      id,
      type,
      position,
      data: {
        index,
        title: sameType ? `Load Balancer ${sameType + 1}` : "Load Balancer",
        meta: "routing · round-robin",
      },
    };
  }
  return {
    id,
    type,
    position,
    data: { index, title: `API Server ${sameType + 1}`, meta: "compute · stateless", capacity: DEFAULT_CAPACITY },
  };
}
