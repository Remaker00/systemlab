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
src/app/layout.tsx          fonts (Inter + JetBrains Mono), site metadata/SEO, RF stylesheet
src/app/about/page.tsx      static About page (reads catalog.ts)
src/app/robots.ts, sitemap.ts  SEO routes (URL from src/lib/site.ts)
src/app/globals.css         palette tokens, paper grain/vignette, React Flow overrides
src/lib/graph.ts            node/edge types, initial graph (Users → API → Database), linkLabel/edgeId, createNode
src/lib/catalog.ts          per-node-type reference copy for the focus annotation
src/lib/sim/engine.ts       pure request-simulation model (arrivals, routing, queueing, caching, faults, metrics, particles)
src/lib/sim/useSimulation.ts rAF driver: steps while running, publishes metrics + comparison ~8×/s
src/lib/sim/ledger.ts       measured per-pool-size comparison rows (settle-gated, interrupted by faults)
src/lib/sim/history.ts      trail of system snapshots for before/after reads
src/lib/experiments.ts      Break-the-System scenarios (copy), Experiment type, stage timing
src/lib/challenge.ts        sheets (01 sandbox, 02 surge, 03 workshop), challenge constants/scale, trial phases, scoreTrial
src/lib/workshop.ts         workshop review: link rule table, missing connections, planned loads → ceiling/bottleneck
src/lib/designs.ts          saved workshop designs in localStorage (guarded list/save/delete/open)
src/components/SmallScreenNotice.tsx  phone/portrait-tablet note suggesting a laptop (D56)
src/components/canvas/
  SystemCanvas.tsx          ReactFlow host, connect/validate, focus + reveal-pan, add components, title block,
                            comparison table, run/reset
  CanvasControls.tsx        bottom strip: Run/Pause, Reset, Traffic, + Add (drag parts out) / Break drawers
                            (Restore while broken), Designs (workshop), zoom
  ParticleLayer.tsx         imperative SVG particles on edge paths (ViewportPortal)
  ExperimentNote.tsx        the 4-beat experiment note pinned above the broken node (ViewportPortal)
  ChallengeNote.tsx         challenge brief / trial log / score, pinned left of Users (ViewportPortal)
  WorkshopNote.tsx          workshop review note pinned left of Users; lines focus their part (ViewportPortal)
  LabContext.tsx            { running, focusedId, litNodes, litEdges, metrics, traffic, fault, scale, locked, workshop, review }
                            + useDimmed(), useIsDown(), useScaled() (format every rate/count with the sheet's scale)
  SketchDefs.tsx            global SVG filters: #sl-sketch (ink wobble), #sl-glow
  nodes/NodeFrame.tsx       shared node shell (corners, coords, title block, handles, review marks: "?" leads,
                            bottleneck tag) + <Ink> draw-in path
  nodes/FocusNote.tsx       leader-line callout under the focused node; StepperRow for capacity / hit rate / ttl;
                            LB pool comparison; live CacheInsight sentence
  nodes/Readout.tsx         live metric annotation + load gauge beside a glyph
  nodes/glyphs.tsx          Users, Api, Database, LoadBalancer, Cache, Gateway, Cdn, Queue, Worker, Replica (120×120 SVG glyphs)
  edges/SketchEdge.tsx      dual-stroke bezier edge, running packets, focus dimming, cut mark
  edges/ConnectionLine.tsx  in-progress link while dragging from a handle
```

## Design rules (the creative direction; keep to them)
- Artist's/architect's canvas, **not** a SaaS dashboard. No sidebar, no KPI cards, no purple/blue gradients.
- Charcoal paper `--paper`, bone ink `--ink*`, one accent `--accent` (sodium amber). The accent means *life*
  (running, selection) and is never used as decoration. `--fault` (oxidised red) means *failure* only.
- Thin strokes (~0.9px), small uppercase mono labels (≥9px, ~0.15em tracking), Inter upright for names and prose.
  Text must stay readable at 100% zoom (see D53).
- Drafting vocabulary: solid strokes for visible edges, dotted faint strokes for hidden edges.
- Lots of negative space; chrome stays minimal and hairline.
- New node types: add a glyph in `glyphs.tsx` that uses `<NodeFrame node={props}>` + `Ink`, register it in
  `SystemCanvas.tsx` `nodeTypes`, add the type to `LabNodeType` in `graph.ts`, and add an entry in `catalog.ts`.
  If users can add it: add it to `PARTS` in graph.ts (title/meta/data) and in CanvasControls, to `ADDABLE_ALL` in
  SystemCanvas, and to the workshop rule table (`ALLOWED`) in workshop.ts.

## Gotchas
- Don't animate `transform`/`y` on the node root at mount, because React Flow measures handle positions
  then and the edges end up misaligned. Use opacity only.
- `nodeTypes`/`edgeTypes` must stay at module scope.
- NodeFrame keeps the intro fade (delayed) and focus dimming (instant) on separate motion layers. Merging them would
  make dimming wait for the intro delay.
- `ViewportPortal` children mount late: use a callback ref (state), not `useRef` read in an effect.
- Particles find edges by `path[data-sl-edge]`. Keep that attribute on SketchEdge's inked path.
- Any new rate or count shown on screen must go through `useScaled()`, or it will be 50× wrong on the challenge sheet.
- Experiment timing is in *sim* time (`metrics.time`), so it pauses with the simulation. Don't use wall-clock timers for beats.
- `devIndicators: false` in `next.config.ts` (the badge overlapped the bottom-left status label).
