import type { Connection, Edge, Node } from "@xyflow/react";

/** Data carried by every SystemLab node. Kept tiny on purpose. */
export type LabNodeData = {
  index: string; // drawing index, e.g. "01"
  title: string; // human name, rendered in serif
  meta: string; // tiny technical annotation
  /** requests/s this node can serve; only nodes that queue have one */
  capacity?: number;
};

export type LabNodeType = "users" | "api" | "database";

export type LabNode = Node<LabNodeData, LabNodeType>;

export type LabEdgeData = {
  label: string;
  /** seconds before the ink draws in; staggered for the intro, immediate for user-made links */
  drawDelay?: number;
};

export type LabEdge = Edge<LabEdgeData, "sketch">;

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
    data: { index: "02", title: "API Server", meta: "compute · stateless", capacity: 40 },
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
