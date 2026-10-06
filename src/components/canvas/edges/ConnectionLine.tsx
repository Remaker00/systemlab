"use client";

import { getBezierPath, type ConnectionLineComponentProps } from "@xyflow/react";
import type { LabNode } from "@/lib/graph";

/**
 * The line that follows the pointer while a link is being drawn: a dotted
 * pencil stroke that firms up to amber once it hovers a valid handle.
 */
export function ConnectionLine({ fromX, fromY, toX, toY, fromPosition, toPosition, connectionStatus }: ConnectionLineComponentProps<LabNode>) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
    curvature: 0.45,
  });
  const valid = connectionStatus === "valid";
  const invalid = connectionStatus === "invalid";
  const color = valid ? "var(--accent)" : invalid ? "rgba(232,227,216,0.2)" : "var(--ink-soft)";

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={valid ? 1.1 : 0.9}
        strokeDasharray={valid ? undefined : "2 4"}
        strokeLinecap="round"
        filter={valid ? "url(#sl-glow)" : undefined}
      />
      <circle cx={toX} cy={toY} r={valid ? 4 : 3} fill="none" stroke={color} strokeWidth={0.8} />
      {!valid && (
        <path d={`M ${toX - 7} ${toY} h 3 M ${toX + 4} ${toY} h 3 M ${toX} ${toY - 7} v 3 M ${toX} ${toY + 4} v 3`} stroke={color} strokeWidth={0.6} />
      )}
    </g>
  );
}
