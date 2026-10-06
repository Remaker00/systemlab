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

### D20: Round-robin lives in the engine's routing, per load balancer
`Simulation.pickRoute` keeps a rotation counter per LB node and indexes its current outgoing links (in link order).
Other forks stay random (unchanged from Part 3).
**Why:** that's the behaviour being taught, and it's deterministic, so the per-server load split is visibly even.
No health checks: that's a separate future concept, and the note's fragility line points at it.

### D21: Adding components = a drawer in the existing strip, not a palette or sidebar
Two entries (Load balancer, API server). New nodes come from `createNode` (graph.ts) with the next drawing index,
are placed via a free-spot scan, focused, and the sheet refits. Added nodes are deletable. The original three are not (D9 still holds).
**Why:** minimal chrome. Focusing a new node shows its explanation straight away.

### D22: Two complementary comparisons
(a) LB note: arithmetic load of "1 server" vs "the pool" at the current traffic, readable before running.
(b) `Ledger` (src/lib/sim/ledger.ts): measured rows per pool size (active capacity-bound servers), written only after
the config (graph structure + pool + capacity + traffic) has been steady for 3s of sim time.
**Why:** the brief asks to *compare* behaviour, and measured numbers are the honest version. The structure is part of the key
because per-node arrivals linger ~1s after a cut, so quick rewiring otherwise leaked transitional states into a row (found in testing).

### D23: Reveal-pan for focus notes (amends the Part 2 "no auto-pan" note)
Only when the note would overflow under the strip, and only by the overflow amount. It waits for an add-refit to finish (`framingUntil`).
**Why:** the LB note is long, and without this the explanation, the main deliverable, was hidden behind the strip.

### D24: Focus-note backdrop is near-opaque paper (/95 → /92 → /80)
**Why:** focused nodes' neighbours stay at full brightness, so the previous fade-to-transparent let them show through
the text. It's the same colour as the paper, so it still reads as negative space, not a card.

### D25: Load balancer has no readout
**Why:** its fan of outgoing links and their labels occupy the readout position. The particles and per-server loads show its effect.

### D26: Faults are modelled in the engine, not faked in the view
`Fault {kind, target, from}` goes into `Simulation.step`. It takes effect at a sim time, so pausing pauses the experiment too.
**Why:** "see it fail first" only teaches if the failure is the real consequence of the model: the same queues, drops and
latency the user has been watching. It also means the user's own fixes (adding servers mid-experiment) genuinely change the outcome.

### D27: The experiment is a timed margin note pinned to the broken part, not a quiz or modal
Beats are derived from sim time (`experimentStage`). Only the user's choice is stored. Before/after figures are read from a
`History` of snapshots at `breakAt` and `breakAt + OBSERVE_S`, so they're measured values.
**Why:** the brief asks for an experiment happening on the canvas, with failure before explanation. Fixed delays
(5s observe, 1.5s, then the question) enforce that order. Answers get a reply, but there's no score or right/wrong styling.

### D28: Clean baselines
An experiment breaks immediately only if the previous BASELINE_S (3s) were normal running time. Otherwise it measures normal operation first
(`quietSince` is set on restore).
**Why:** in testing, a database failure started right after an API failure reported the previous failure as its "before" (17% errors).

### D29: Break / Restore share one spot in the strip, and Add/Break share one `Drawer`
**Why:** one subtle control, no extra chrome. Fault red marks it as the destructive one.

### D30: Experiment framing uses fitBounds over (note ∪ system)
Focus notes keep the gentle pan from D23 (now via a shared `revealLater` helper that also respects the title block).
**Why:** the experiment note grows with each beat. Panning alone pushed the drawing under the strip, but the point is to read the note *beside* the failing system.

### D31: Faults stay out of the comparison ledger
**Why:** a broken system isn't a "pool size" data point. `Ledger.interrupt()` forces a fresh 3s settle after restore.

### D32: The cache is inline (read-through): API → Redis → Database
**Why:** it lets the existing route/particle machinery show the full story along real links: HIT ends at Redis, MISS
continues to the DB, and the store travels back along the same link. A cache-aside drawing (API talks to both) would need
fan-out logic in the router for little teaching gain.

### D33: Hit rate is a dial on *cacheability*. The measured hit rate is emergent.
`hitShare` = the share of requests for one of HOT_KEYS (30) popular keys. Others are one-off keys. Real hits additionally
need the entry to exist and be within TTL.
**Why:** the brief asks to change the hit rate *and* show TTL. A direct dial plus an emergent result lets both be true. The note
calls out when TTL is the reason the measured rate falls short of the dial.

### D34: TTL is checked against the current setting (entries store `storedAt`)
**Why:** turning the TTL stepper should show its effect within a second. Real Redis keeps per-entry TTLs, so this choice is noted in the code.

### D35: Cache visuals reuse the particle system with two new phases
`pop` (expanding ring: a hit at the end of the link into Redis, or a store at its start) and `returning` (a hollow ring travelling the
DB link in reverse). Miss legs are drawn in pale ink. Timing constants are shared from the engine (`POP_S`, `STORE_HOP_FACTOR`).

### D36: `StepperRow` generalises the Part 3 capacity stepper (capacity, hit rate, ttl)
Same markup and look. Rows appear for whichever tunable fields a node's data has.

### D37: Redis is placed above the API → Database span
**Why:** readouts sit above-right of every glyph. Below or between, the Redis → Database link ran straight through Redis's own readout.

### D38: Challenges live on drawing sheets
The title block's sheet number becomes the sheet index. Each sheet remembers its drawing while you're on another.
**Why:** it fits the drawing-set metaphor, adds no new chrome, and keeps the sandbox untouched by the challenge.

### D39: Challenge scale: 1 simulated request = 50 real ones
**Why:** the engine models individual requests, and 10,000/s per-request would be far too heavy. ×50 maps 1,000 → 10,000/s onto the
existing 20 → 200 range. `useScaled()` formats every rate and count on screen. Latencies and percentages are untouched.

### D40: Capacity and cacheability are fixed in the challenge
API 3,000/s, DB 4,000/s, 80% repeat reads (`CHALLENGE_LOCKED` hides those steppers).
**Why:** otherwise the answer is "turn the dial up". Fixed parts force the lesson to be architecture.

### D41: Slot-in on the challenge sheet only
**Why:** after the user decides *which* parts they need, wiring 5 servers × 2 links (and re-wiring them through Redis) is tedium,
not discovery. Slot-in places a part where that kind of part goes. It never adds a part, so it doesn't answer the challenge.
It's challenge-only so the Part 4/6 sandbox behaviour is unchanged.

### D42: The trial is the simulation itself, scored from History
A rate *schedule* (function of sim time) is passed to `useSimulation`. That avoids a render-time mirror of sim time.
The mid-surge outage is a regular `api-down` Fault with an `until`.
Calibration lessons from testing:
(1) with zero requests served, latency/db must score 0, not "0 ms / 0% = perfect";
(2) DB load is judged at full demand, so a system that collapsed upstream doesn't earn "database comfortable";
(3) availability is full at 80% because blind round-robin can't beat (n−1)/n, and the explanation names that;
(4) a capacity failure whose servers had room is attributed to "further down the line".

### D43: Explanations end in a question, not a prescription
Low criteria show a guiding question ("Do all of those reads really need the database?"). **Why:** the brief says don't give the answer.

### D44: The comparison ledger counts API servers only
**Why:** once the DB has a capacity (challenge), it was being counted as part of the server pool.

### D45: The workshop is a third sheet, not a mode of the sandbox
Sheet 03 starts with only Users (fixed, as the traffic source). Its parts, review and Designs exist only there.
**Why:** Parts 1–7 stay exactly as they were (scope discipline). It fits the drawing-set metaphor of D38, and a blank sheet is the point.

### D46: Wrong links are drawn and simulated, then marked. They aren't refused.
`isValidConnection` still blocks only self-links and duplicates. A link the rule table rejects becomes red dashes with a reason.
**Why:** the brief is to *validate* and teach. Silently refusing a drag teaches nothing, but "✕ no server between" plus its sentence
does, and running it shows the real consequence. Fault red is right here: the design fails at that link.

### D47: Bottlenecks are planned, not measured
`reviewDesign` propagates 1 req/s from Users with the engine's own routing rules (equal forks, capacity-weighted at queues,
only misses past caches) to get per-part load, the ceiling and the first part to give.
**Why:** a design review should read before you press Run, and it must agree with the model, so it reuses the same rules.
The live readouts still show the measured truth (e.g. a short TTL makes it worse than planned).

### D48: Queue semantics: answered on accept, failures out of sight
The caller's request succeeds at the queue. Workers drain it with a 20s waiting budget, and a full queue refuses at the door.
Jobs that fail later are counted as lost at the queue, not as request errors.
**Why:** that's the honest trade-off of async work: callers stay fast and the risk moves into a backlog you have to watch.
It's also why the database-failure copy needed the replica/queue cases (the old copy claimed 100% errors that didn't happen).

### D49: Replication is a link type derived from its ends (database → replica)
It's drawn dotted (a hidden line in drafting terms), excluded from the engine's routing, and gives the replica its data
(`detached` otherwise). A database gets a source handle only in the workshop.
**Why:** no new edge-type machinery, saved designs need no extra fields, and the sandbox database keeps a single handle.

### D50: Drag-and-drop uses pointer events from the drawer, not HTML5 DnD
**Why:** the drawer has to close mid-drag (so the sheet is visible), which unmounts the drag source. HTML5 DnD doesn't handle
that reliably, and pointer events also work for touch (`touch-action: none`). A press with no movement stays a click.

### D51: Designs live in localStorage, behind guards
`src/lib/designs.ts` reads and writes in try/catch and validates what it loads. A refused save says so in the popover.
Same name = replace. Links are relabelled from their ends when opened. Reset returns to the last saved/opened design.
**Why:** there's no backend. "Save and reopen" is per-person and per-browser, which suits a learning sandbox.

### D52: The workshop's fit-to-view is capped at 100% zoom (`WORKSHOP_FIT`)
**Why:** a sheet holding only Users otherwise fits to ~240%, which makes every dropped part and note enormous. Other sheets keep
their uncapped fit so they look exactly as before.

### D53: Readability over the original "tiny italic" look
Names and prose use Inter upright instead of Instrument Serif italic. Mono labels are 9–11px with ~0.15em tracking, and
text has its own brighter tones (`--text-soft`/`--text-faint`). Tailwind's `ink-soft`/`ink-faint` colours point at them,
while SVG strokes keep `--ink-soft`/`--ink-faint` through `var()`.
**Why:** the user found the faint, condensed italic text hard to read without zooming. Splitting text from strokes keeps
the drawing's hairline look intact.

### D54: Site URL comes from `NEXT_PUBLIC_SITE_URL`
`src/lib/site.ts` falls back to localhost. It feeds `metadataBase`, the sitemap, robots and JSON-LD.
**Why:** there's no production domain yet, and canonical/OG URLs have to be absolute.

### D55: Workshop Reset gives a blank sheet
Reset clears the workshop to Users only and drops the design name. Saved designs are untouched and reopen from Designs → Open.
This replaces Part 8's "Reset returns to the last saved or opened design".
**Why:** the user expected Reset to start a new workshop. Returning to the saved design made it look as if Reset did nothing.

