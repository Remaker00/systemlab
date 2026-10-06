import type { LabNodeType } from "./graph";

/**
 * Static reference notes for each component, shown in the focus annotation.
 * These are descriptive only. Nothing here is simulated yet.
 */
export type ComponentSpec = {
  role: string;
  summary: string;
  properties: ReadonlyArray<readonly [label: string, value: string]>;
  /** a one-line teaser of how this component fails, for the "breaking" theme */
  fragility: string;
};

export const catalog: Record<LabNodeType, ComponentSpec> = {
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
