@AGENTS.md

# SystemLab — Learn by Breaking Systems

An immersive canvas where users build system architectures and (later) break them to learn.
The project is built in **Parts**. Do only the Part the user asks for, then stop.

**Read these first in every new session:**
- `PROGRESS.md`: what's done, what's next, and how far we are through the Parts
- `DECISIONS.md`: design and technical decisions plus the reasons for them (don't undo them without a reason)

## Stack
Next.js 16 (App Router, `src/`) · TypeScript · Tailwind v4 (CSS-first, tokens in `globals.css`) ·
React Flow (`@xyflow/react` v12) · Framer Motion v14

## Commands
- `npm run dev` starts the dev server
- `npm run build` / `npx tsc --noEmit` / `npm run lint` must stay clean

## Layout
```
src/app/layout.tsx          fonts (Instrument Serif + JetBrains Mono), RF stylesheet
src/app/globals.css         palette tokens, paper grain/vignette, React Flow overrides
src/lib/graph.ts            node/edge types, initial graph (Users → API → Database), linkLabel/edgeId, createNode
src/lib/catalog.ts          per-node-type reference copy for the focus annotation
src/lib/sim/engine.ts       pure request-simulation model (arrivals, routing, queueing, caching, faults, metrics, particles)
src/lib/sim/useSimulation.ts rAF driver: steps while running, publishes metrics + comparison ~8×/s
src/lib/sim/ledger.ts       measured per-pool-size comparison rows (settle-gated, interrupted by faults)
src/lib/sim/history.ts      trail of system snapshots for before/after reads
src/lib/experiments.ts      Break-the-System scenarios (copy), Experiment type, stage timing
src/components/canvas/
  SystemCanvas.tsx          ReactFlow host, connect/validate, focus + reveal-pan, add components, title block,
                            comparison table, run/reset
  CanvasControls.tsx        bottom strip: Run/Pause, Reset, Traffic, + Add / Break drawers (Restore while broken), zoom
  ParticleLayer.tsx         imperative SVG particles on edge paths (ViewportPortal)
  ExperimentNote.tsx        the 4-beat experiment note pinned above the broken node (ViewportPortal)
  LabContext.tsx            { running, focusedId, litNodes, litEdges, metrics, traffic, fault } + useDimmed(), useIsDown()
  SketchDefs.tsx            global SVG filters: #sl-sketch (ink wobble), #sl-glow
  nodes/NodeFrame.tsx       shared node shell (corners, coords, title block, handles) + <Ink> draw-in path
  nodes/FocusNote.tsx       leader-line callout under the focused node; StepperRow for capacity / hit rate / ttl;
                            LB pool comparison; live CacheInsight sentence
  nodes/Readout.tsx         live metric annotation + load gauge beside a glyph
  nodes/glyphs.tsx          UsersNode, ApiNode, DatabaseNode, LoadBalancerNode, CacheNode (120×120 SVG glyphs)
  edges/SketchEdge.tsx      dual-stroke bezier edge, running packets, focus dimming, cut mark
  edges/ConnectionLine.tsx  in-progress link while dragging from a handle
```

## Design rules (the creative direction; keep to them)
- Artist's/architect's canvas, **not** a SaaS dashboard. No sidebar, no KPI cards, no purple/blue gradients.
- Charcoal paper `--paper`, bone ink `--ink*`, one accent `--accent` (sodium amber). The accent means *life*
  (running, selection) and is never used as decoration. `--fault` (oxidised red) means *failure* only.
- Thin strokes (~0.9px), tiny uppercase mono labels with wide tracking, serif italic for names.
- Drafting vocabulary: solid strokes for visible edges, dotted faint strokes for hidden edges.
- Lots of negative space; chrome stays minimal and hairline.
- New node types: add a glyph in `glyphs.tsx` that uses `<NodeFrame node={props}>` + `Ink`, register it in
  `SystemCanvas.tsx` `nodeTypes`, add the type to `LabNodeType` in `graph.ts`, and add an entry in `catalog.ts`.
  If users can add it: extend `AddableType` + `createNode` and the `ADDABLE` list in CanvasControls.

## Gotchas
- Don't animate `transform`/`y` on the node root at mount, because React Flow measures handle positions
  then and the edges end up misaligned. Use opacity only.
- `nodeTypes`/`edgeTypes` must stay at module scope.
- NodeFrame keeps the intro fade (delayed) and focus dimming (instant) on separate motion layers. Merging them would
  make dimming wait for the intro delay.
- `ViewportPortal` children mount late: use a callback ref (state), not `useRef` read in an effect.
- Particles find edges by `path[data-sl-edge]`. Keep that attribute on SketchEdge's inked path.
- Experiment timing is in *sim* time (`metrics.time`), so it pauses with the simulation. Don't use wall-clock timers for beats.
- `devIndicators: false` in `next.config.ts` (the badge overlapped the bottom-left status label).
