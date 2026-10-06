# Decisions

Each entry records the decision and the reason for it. Add new ones at the bottom.

### D1: Palette: charcoal paper, bone ink, one amber accent
`#0c0c0b` paper, `#e8e3d8` ink (with soft/faint/ghost alphas), `#e8a35a` sodium-amber accent.
**Why:** the brief bans purple/blue gradients and asks for calm. A single warm accent reads like a lamp on a
drafting table, and because it only appears for "life" (running, selection) it stays meaningful.

### D2: Typography: Instrument Serif (italic) + JetBrains Mono
Serif italic for object names and the logo. Tiny (8–9.5px) uppercase mono with wide tracking for annotations.
**Why:** this mirrors an architectural drawing sheet, where hand-lettered names sit beside technical callouts.
It avoids the generic SaaS sans look.

### D3: Nodes are SVG glyphs, not cards
Each node is a 120×120 line drawing with registration corners, and there's no box or background.
**Why:** the brief asks for "visual objects on the canvas rather than traditional cards". Using drafting
conventions (dotted hidden lines, isometric rack, cylinder) makes each node distinct at a glance.

### D4: Hand-plotted feel through a subtle displacement filter + draw-in
`#sl-sketch` (feTurbulence + feDisplacementMap, scale 2.2) is applied to node glyphs only. Every stroke animates
`pathLength` 0→1 on mount.
**Why:** it gives an ink-on-paper feel without looking cartoonish. Edges skip the filter because a displacement
filter on thin, near-horizontal paths gets clipped by the filter region and costs more. Edges get a second dotted
"construction" curve instead.

### D5: Run is visual only in Part 1
`running` lives in `LabContext` and only drives animations (SVG `animateMotion` packets, LED pulses, DB sweeps).
**Why:** the user explicitly said not to build simulation yet. The real engine will plug into this flag/context later.

### D6: Minimal chrome: one bottom instrument strip + corner annotations
No sidebar, minimap or React Flow `<Controls>`. Clicking the zoom % runs fit-to-view.
**Why:** the brief asked for minimal controls (Run, Reset, zoom) and lots of negative space.

### D7: (superseded by D9) Connecting and deleting were disabled in Part 1

### D8: Node root animates opacity only
**Why:** a `y` transform on mount made React Flow measure handles while they were offset, which misaligned the
edge endpoints by about 6px.

### D9: Links are editable, nodes are not
Nodes carry `deletable: false`. `deleteKeyCode` is Backspace/Delete, which in practice removes only links.
`isValidConnection` rejects self-links and duplicates.
**Why:** Part 2 requires the architecture to stay Users → API → Database while connections become editable.

### D10: Focus = React Flow selection of exactly one node
There's no separate focus state. `focusedId` is derived in `SystemCanvas` from `nodes.filter(n => n.selected)` together with
the lit neighbour/edge sets, and shared through `LabContext` (`useDimmed`). `selectNodesOnDrag={false}`, so only a click focuses.
**Why:** a single source of truth. Pane-click deselect, Reset and RF's selected-node elevation all work with no extra code.

### D11: The contextual layer is a callout on the canvas, not a modal or panel
`FocusNote` is rendered inside the node (absolute, below the title block), so it pans, zooms and drags with the object.
It hangs from a leader line with no card, only a left-to-right fade behind the text for legibility. `pointer-events: none`.
**Why:** the brief says "near the node rather than a traditional modal", and no sidebar or dashboard is allowed.
Placing it below is robust because there's empty space under every node and it doesn't collide with horizontal links.

### D12: Cut animation goes through local edge state
The cut button sets `cutting`, the ink animates `pathLength → 0`, and `onAnimationComplete` calls `deleteElements`.
Keyboard delete stays instant.
**Why:** React Flow unmounts edges at once, so exit animations need to run before removal.

### D13: Edge draw-in delay lives in edge data (`drawDelay`)
Initial edges use 1.2s to choreograph with the node intro. User-made links use 0.
**Why:** otherwise a freshly drawn link would sit invisible for over a second.

### D14: The simulation is a tiny queueing model, not a realistic one
Poisson arrivals, a single FIFO server per capacity node (service time = 1/capacity), a 1.0s wait budget → reject.
**Why:** the goal is legibility. This model makes the latency curve emerge from utilisation (no hand-tuned formula),
gives overload a clear failure mode (queue full → errors), and stays under 250 lines.

### D15: Simulation state stays out of React; particles are drawn imperatively
`Simulation` is a plain class. `useSimulation` steps it on rAF and publishes a metrics snapshot every 125ms.
`ParticleLayer` reads `sim.particles` every frame and moves pooled SVG circles positioned with `getPointAtLength` on the
edge's own DOM path (`data-sl-edge`). Pause = sim time stops.
**Why:** hundreds of particles at 60fps through React state would re-render the whole canvas. Reading the edge DOM path
keeps particles exactly on the drawn curve, even while nodes are dragged.
Gotcha: `ViewportPortal` mounts its target after the first render, so the layer uses a callback ref (state), not `useRef`.

### D16: Simulated particles replace the Part 1 decorative edge packets
**Why:** constant decorative packets would show flow on links with no traffic and contradict the model.
The other Part 1 ambient touches (Users orbit, API LEDs, DB sweep) stay. The LEDs now turn red on overload.

### D17: A second semantic colour, `--fault` (#d8644c, oxidised red), only for failure
Used for rejected particles, overload corners and glow, the load-gauge overflow, error and latency figures past the threshold.
**Why:** amber means "alive". Overload needs a distinct signal that still sits in the warm, restrained palette (no pure red).

### D18: Controls placement
Traffic lives in the existing bottom strip (a hairline range input, discrete steps). Capacity is per node, so it lives
in that node's focus note (the Part 2 contextual layer). While running, the title-block hint points to it.
**Why:** no new panels or chrome, and each control sits next to the thing it changes.

### D19: Readouts sit beside the glyph and grow upward from above the side handle
**Why:** at that height they never cover a link or the focus note below the node.
