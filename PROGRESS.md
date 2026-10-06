# Progress

## Status: Part 3 complete (2026-10-06). Waiting for the user to start Part 4.

### Part 1: Visual foundation ✅
- [x] Next.js + TS + Tailwind v4 + React Flow + Framer Motion scaffold
- [x] Charcoal paper background: fine line grid (24px), sparse registration crosses (192px), SVG grain, vignette
- [x] Custom nodes drawn as plotted SVG glyphs that ink themselves in on load:
  - Users: three figures inside a dotted orbit (amber dots orbit while running)
  - API Server: isometric 3-tier rack with hidden-line edges and LEDs (LEDs pulse amber while running)
  - Database: cylinder with platter bands and a dotted hidden base (bands sweep amber while running)
- [x] Node shell: registration corners and a live `x · y` coordinate tag (on hover/drag/select), serif title, mono meta
- [x] Sketch edges: dotted construction curve + inked bezier that draws in, a mono label, and amber packets while running
- [x] Draggable nodes. (Connecting/deleting came in Part 2.)
- [x] Minimal controls: Run/Pause (visual flow only), Reset (restores graph, stops, refits), zoom − / % (click to fit) / +
- [x] Title-block annotations: logo top-left, sheet info top-right, Idle/Flowing status bottom-left (both hidden on mobile)
- [x] Verified: tsc, lint, build clean; headless screenshots of idle, running, drag, reset and mobile; no console errors

### Part 2: Interactive canvas ✅
- [x] Links can be drawn by dragging handle ○ → ○. A custom dotted connection line turns amber over a valid target.
  - Validation: no self-links and no duplicates. The handle layout keeps direction (Users = source only, DB = target only).
  - New links draw in right away. The label comes from the endpoint types (`linkLabel` in `graph.ts`), e.g. users→database = "direct · access".
- [x] Links can be removed: select a link → a "cut" mark appears (it erases the ink, then deletes), or press ⌫/Delete.
- [x] Nodes can't be deleted (`deletable: false`), so the Users → API → Database architecture stays.
- [x] Clicking a node focuses it (focus = exactly one selected node; dragging doesn't select). Corners tighten and turn amber,
      a warm halo appears and the title rule turns amber. Unrelated nodes and links fade to ~20%. Neighbours and links stay lit.
- [x] Focus annotation (`FocusNote.tsx`): a drafting callout on a leader line below the node with role, summary,
      properties, live in/out links and a "fragility" teaser. Content is in `src/lib/catalog.ts`.
- [x] Esc or a click on empty canvas releases focus. Reset clears focus too.
- [x] The top-right title block shows live object/link counts and a contextual hint that swaps with a small animation.
- [x] Verified headlessly: focus → esc → select edge → cut (2→1 links) → connect users→database (1→2) → focus DB shows
      "in ← API Server, Users" → Backspace on a focused node leaves 3 nodes. No console errors. tsc, lint and build clean.

### Part 3: Request simulation ✅
- [x] Local engine `src/lib/sim/engine.ts` (pure TS, no DOM): Poisson arrivals from Users at the traffic rate; each request
      walks the *current* links (random choice at forks). A node with `capacity` is a single FIFO server
      (service time 1/capacity), so latency rises on its own near capacity. Waits over 1.0s are rejected as errors.
      No route out of Users counts as an error. Skipping the API (users→database) skips its queue.
- [x] `useSimulation` runs it on rAF while Run is on. Pause freezes sim time. Reset clears it. Metrics reach React ~8×/s.
- [x] `ParticleLayer` (ViewportPortal, imperative SVG) moves sampled requests along the inked edge paths (`data-sl-edge`):
      0.9s per link, queued requests line up back along the incoming link, rejected ones fall and fade in `--fault`.
      Above 70 rps the particles sample the traffic.
- [x] Annotations: per-node readouts beside each glyph (Users out/sent; API load gauge, load %, queue, cap, OVERLOAD;
      DB in/s) plus a system column bottom-left (req, rate, latency, errors · %). The status reads Idle/Flowing/Paused/Overloaded.
- [x] Overload: API corners and glow turn fault red, the glyph trembles slightly, LEDs blink red, and the gauge spills past its 100% tick.
- [x] Traffic control: hairline slider in the bottom strip (0–200 req/s steps, default 20). API capacity: −/+ stepper in
      the API's focus note (10–160 steps, default 40), stored in node data, so Reset restores it.
- [x] The decorative edge packets from Part 1 were removed; the simulated particles replace them (see D16).
- [x] Verified: engine numerically (cap 40: 20→57ms, 30→92ms, 36→301ms, 39→535ms, 60→~1s and 36% errors, 100→62% errors;
      no route = 100% errors; bypass = 10ms) and in a headless browser (healthy → 100/s overload → capacity raised to 160/s
      → Flowing at 23ms; pause freezes counters; reset clears particles). No console errors. tsc, lint and build clean.

### Known limitations / notes
- Only the API has capacity. The DB has a fixed ~6ms cost and never saturates (not in Part 3 scope).
- Particles aren't dimmed when a node is focused.
- Requests are one-way visually (no response particles). Latency is the modelled round trip.
- A users→database link passes behind the API Server and its label can overlap the API title until a node is dragged.
- The focus note hangs below the node and can run off-screen if the node sits near the bottom/right edge. There's no auto-pan.
- On narrow phones the fitted view is limited by `minZoom={0.3}`, so the graph appears small.
- React Flow attribution is kept and styled very faint.

### Next (do not start until the user asks)
- Part 4: TBD by the user.
