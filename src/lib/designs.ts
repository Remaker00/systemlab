import { catalog } from "./catalog";
import { linkLabel, type LabEdge, type LabNode, type LabNodeType } from "./graph";

/**
 * Saved workshop designs, kept in this browser's localStorage. Storage can be missing, full or
 * blocked (private windows), so every access is guarded and a failure is reported, never thrown.
 */

export type SavedDesign = {
  id: string;
  name: string;
  savedAt: number; // ms since epoch
  traffic: number;
  nodes: Pick<LabNode, "id" | "type" | "position" | "data" | "deletable">[];
  edges: Pick<LabEdge, "id" | "source" | "target">[];
};

const KEY = "systemlab.designs.v1";

export function listDesigns(): SavedDesign[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isDesign).sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

/** Save under `name`. A design with the same name (any case) is replaced. Returns false if storage refused. */
export function saveDesign(name: string, nodes: LabNode[], edges: LabEdge[], traffic: number): boolean {
  const others = listDesigns().filter((d) => d.name.toLowerCase() !== name.toLowerCase());
  const design: SavedDesign = {
    id: `d-${Date.now().toString(36)}`,
    name,
    savedAt: Date.now(),
    traffic,
    nodes: nodes.map(({ id, type, position, data, deletable }) => ({ id, type, position, data, deletable })),
    edges: edges.map(({ id, source, target }) => ({ id, source, target })),
  };
  return write([design, ...others]);
}

export function deleteDesign(id: string): boolean {
  return write(listDesigns().filter((d) => d.id !== id));
}

/** Turn a saved design back into a drawing. Links are relabelled from their ends, as when drawn. */
export function openDesign(d: SavedDesign): { nodes: LabNode[]; edges: LabEdge[]; traffic: number } {
  const nodes: LabNode[] = d.nodes.map((n) => ({ ...n, selected: false }));
  const type = (id: string) => nodes.find((n) => n.id === id)?.type;
  const edges: LabEdge[] = d.edges
    .filter((e) => type(e.source) && type(e.target))
    .map((e) => ({ ...e, type: "sketch", data: { label: linkLabel(type(e.source), type(e.target)), drawDelay: 0.6 } }));
  return { nodes, edges, traffic: d.traffic };
}

function write(designs: SavedDesign[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(designs));
    return true;
  } catch {
    return false;
  }
}

function isDesign(d: unknown): d is SavedDesign {
  if (!d || typeof d !== "object") return false;
  const x = d as SavedDesign;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.savedAt === "number" &&
    typeof x.traffic === "number" &&
    Array.isArray(x.nodes) &&
    Array.isArray(x.edges) &&
    x.nodes.every((n) => n && typeof n.id === "string" && (n.type as LabNodeType) in catalog && n.position && n.data)
  );
}
