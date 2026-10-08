# Progress

## Status: Part 8 complete (2026-10-06). Waiting for the user to start Part 9.

### Small-screen note (2026-10-08, between parts) ✅
- [x] `SmallScreenNotice` on phones and portrait tablets: suggests a laptop or PC, "Send the link to my computer"
      (share sheet or copy), "Continue anyway" (remembered for the session), About link. Esc dismisses. See D56.
- [x] Fixed phone layout: the 698px control strip wraps within the screen and `main` clips overflow, so phones no longer
      zoom the page out (layout viewport was 555px on a 412px phone).
- [x] Verified headlessly: shown on Pixel 7, iPhone 13, iPad portrait; hidden on iPad landscape, 1100px and 1440px windows;
      Continue hides it and it stays hidden after reload; no console errors.

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

### Part 4: Load Balancer ✅
- [x] "+ Add" drawer in the bottom strip → Load balancer / API server. New nodes are placed in free space (servers
      stack under existing ones; a balancer goes under the Users → API span), draw themselves in, get focused (so their note
      explains them), and the sheet refits. Added nodes are removable (⌫), and their links go with them. The original 3 stay fixed.
- [x] `loadbalancer` node type: hub + fan glyph, and a selector needle that steps between ports while traffic flows.
      No readout (its fan occupies that side). Link labels: users→lb "https · request", lb→api "http · forward".
- [x] Engine: strict round-robin at load balancers (per-LB counter over its current outgoing links, in link order).
      Other forks stay random. The LB costs ~1ms and has no capacity.
- [x] Multiple API servers ("API Server 2", "API Server 3"…), each with its own capacity (default 40/s, stepper in its note).
- [x] Server health: each server readout gains a `health` line (idle / ok / strained ≥75% / overload).
- [x] Comparison: (a) LB note has "why it exists" plus "at N/s: 1 server vs N servers" load gauges (arithmetic), and a
      setup hint until it's fed by Users and has servers; (b) a measured "Compare · by servers" table bottom-left (`Ledger`)
      records latency/errors per pool size once a setup has run unchanged for 3s.
- [x] Focus reveal: if a focused node's note would run under the strip, the view pans up just enough (waits for any
      add-refit to land first).
- [x] Verified: engine (rotation api,api2,api3,api…; at 100/s: 1 server ~1030ms/~60% errors, LB→2 25% errors,
      LB→3 0% errors), ledger rows stable, and in-browser: overload one server → add LB + 2 servers → cut + wire 7 links
      → table shows 1: ~1030ms 62% vs 3: ~58ms 0% → removing a server removes its 2 links. Part 2 regression flow passes.
      No console errors. tsc, lint and build clean.

### Part 5: Break the System ✅
- [x] "Break" in the bottom strip → drawer of 4 scenarios (Traffic spike ×10, API server failure, Database failure,
      Slow network +300ms/hop). While an experiment runs, that spot becomes "Restore" (fault red).
- [x] Faults are real in the engine (`Fault` passed to `step`, active from `breakAt` in sim time): spike = 10× arrivals;
      api-down/db-down = the target rejects every request reaching it; latency = +300ms per link and particles cross 2.2× slower.
- [x] On the canvas: dead nodes fade and get a red ✕ strike (readout health/state "down"); Users tremble with a red out-rate
      during a spike; slow links get a crawling red dashed overlay and "+300ms" on their labels.
- [x] Experiment note (`ExperimentNote.tsx`, ViewportPortal) pinned above the affected node on a red leader:
      0 Normal (measures 3s first unless the last 3s were normal running) → 1 Change → 2 Result (5s "watch the drawing"
      progress, then measured before → after rate/latency/errors from `History` + what to look at) → 3 Your move (question,
      3 answers + "just explain") → 4 Why (reply to the chosen answer + concise explanation). "↺ restore the system" is always there.
- [x] Each beat: if the note has outgrown the view, the camera frames the note + whole system together (fitBounds, zooming out).
- [x] Faulted periods are kept out of the Part 4 comparison table (`Ledger.interrupt`). Reset/Restore end the experiment.
      Removing the broken node ends it too.
- [x] Verified: engine (spike 1 srv → 79% err/1s; spike 3 srv → 41%; api-down 1 srv → 100%, 3 srv → ~34%; db-down even with
      3 srv → 100%; latency → +~600ms on 2 hops, +~900ms on 3, 0% errors) and in-browser: all four scenarios end to end, answer →
      tailored reply + why, "just explain", Restore and Reset clear the note. Part 2/4 regression flows pass. No console errors.

### Part 6: Redis cache ✅
- [x] "Redis" in the + Add drawer (`cache` node type), placed above the API → Database span. Wire API → Redis → Database
      and cut the direct API → Database link (the note says so until wired). Labels: "get · key", "on miss · read".
- [x] Engine (read-through): each request asks for a key, popular (one of 30) with probability `hitShare`, else one-off.
      Cached and within TTL = HIT (0.5ms, answered at Redis, never reaches the DB). Otherwise MISS → continues to the DB → on
      success the key is stored. A miss with no DB behind the cache = error. Measured hit rate, lookups/s, hit vs miss
      downstream latency are in `metrics.caches`.
- [x] TTL: entries expire `ttl` seconds after storing. Checked against the *current* TTL, so changes act immediately.
      Short TTL visibly lowers the measured hit rate below the dial (80% dial: TTL 10s → ~80%, TTL 1s → ~40%).
- [x] Visuals: HIT = an amber ring flash where the request meets Redis (the request ends there, fast). MISS = the request
      continues to the database in pale ink, then a hollow amber ring travels back up the link (store) and flashes at Redis.
      Glyph: memory slab with a 4×4 key-cell grid (lit cells ≈ hit rate) and a TTL clock whose hand turns once per TTL.
- [x] Readout beside Redis: hit %, to db (req/s · −%), speed (hit / miss ms), ttl. The DB's "in" figure falls with the hit rate.
- [x] Redis note: hit rate (0–99%) and TTL (1–60s) steppers (the capacity stepper generalised into `StepperRow`, same look), plus
      one live contextual sentence (setup hint / how to read the flow / "TTL too short" / "database almost idle" / effect so far).
- [x] Database-failure experiment text accounts for a cache (hits survive until their TTL runs out, since nothing refreshes).
- [x] Verified: engine (dial 0/80/95% → DB 45/7/6 per s; TTL 1s → 36% hit; DB down → hits drain after TTL; no DB → 100% errors)
      and in-browser: add → rewire → run 40/s → DB in 10/s @80%, 33/s @0%, 0/s @99%; TTL 1s → note reports "Only 54% hit".
      Part 2–5 regression flows pass. No console errors. tsc, lint and build clean.

### Part 7: Challenge 01, "The surge" ✅
- [x] Drawing sheets: the title block's "Sheet 0X — …" is a switcher. 01 Foundation (sandbox) / 02 The surge (challenge).
      Each sheet keeps its own nodes, links and traffic when you leave it. Reset restores the current sheet's start.
- [x] The surge sheet starts with only Users and Database (capacity 4,000/s). Scale: 1 simulated request = 50 real
      (`SCALE`). All rates on this sheet are ×50 (readouts, totals, slider, tables, notes) via `useScaled()`. Latency/% aren't scaled.
- [x] Fixed constraints: API server 3,000/s, DB 4,000/s, reads that repeat 80%. Capacity and hit-rate steppers are locked
      on this sheet (`CHALLENGE_LOCKED`). TTL stays tunable. The DB shows a load gauge/health when it has a capacity.
- [x] Building is fast but not given away (`slotIn`): a new API server joins the pool wired like an existing one; a new
      Redis takes over the API → Database links; a new load balancer takes over the Users → API links.
- [x] Challenge note pinned left of Users: brief, the bench (constraints), "Put it on trial". The trial is scripted in sim time:
      1,000/s (3s) → 10,000/s (9s) → one fed API server killed mid-surge (6s). It's driven by a rate schedule passed into
      `useSimulation`, plus a timed `api-down` fault (`Fault.until`). The slider is locked during the trial. Break works as usual.
- [x] Scoring (`scoreTrial`, 0–25 each, from `History` samples in settled windows): capacity (served share at peak),
      latency, availability (served share after losing a server; full at 80% since blind round-robin caps at (n−1)/n),
      database load (judged at full demand = load ÷ served). Verdict: holds / bends / cracks / falls over.
      Each criterion: measured figure, a "why" built from what happened, and a question if it scored low (never the answer).
      Attempts are listed (01 · 0, 02 · 0 …).
- [x] Verified headlessly: nothing 0; 1 server 0; LB+5 no Redis 0 (DB wall: "servers had room… limit was further down");
      LB+4+Redis 96; LB+5+Redis 100; LB+3+Redis 61. In-browser: the same arc via the UI (0 → 0 → 0 → 100), slot-in link counts
      exact, sheets keep drawings. Part 2–6 regression flows pass. No console errors. tsc, lint and build clean.

### Part 8: The Architecture Workshop ✅
- [x] Sheet 03 "Workshop" (sheet switcher): starts with only Users. Everything else is built from scratch.
- [x] Drag-and-drop: parts are dragged out of the + Add drawer onto the sheet. The drawer steps aside once the pointer moves,
      an amber-cornered ghost follows the pointer, and the part lands centred under it (a click still places it in free space).
      Dragging works on every sheet. The sandbox and challenge drawers still list only their three parts.
- [x] Nine parts in the workshop drawer, grouped Edge / Compute / Data: CDN, API gateway, load balancer, API server, queue, worker,
      Redis, database, read replica. New glyphs: gateway (arch with a boom that lifts while traffic passes), CDN (wire globe whose
      edge locations light with the hit rate), queue (tray of slots that fill as it nears full), worker (gear that turns while
      busy), replica (the cylinder traced in dashes, with a sync arrow). Catalog notes for each.
- [x] Engine: gateway = round-robin + 2ms; CDN = read-through cache (default 50% static, TTL 60s); queue answers the caller on
      accept, then sends the job to the least busy worker (up to 20s of waiting work, or 400 jobs with no consumer, then it refuses);
      jobs held with no consumer drain once a worker is linked; failures past a queue are lost jobs, not request errors.
      Database/replica have capacity 60/s. A replica with no primary refuses requests. The primary → replica link is replication:
      drawn dotted, never routed. In the workshop a database gets a source handle for it.
- [x] Readouts: gateway in/s; CDN hit/origin/speed/ttl; queue depth/in/out/wait (or full) and lost jobs; worker load/queue/cap/health;
      replica in/cap/health. Live focus-note sentences for the CDN and the queue.
- [x] Validation (`src/lib/workshop.ts`, recomputed on every change):
      wrong links: a rule table of what may link to what. A wrong link is still drawn (and simulated) but in red dashes, labelled
      "✕ <reason>" (e.g. users → database "no server between"), with the full reason in the review.
      Missing connections: per part (no way in, unreachable from Users, API with no data behind it, queue with no worker, cache
      with no storage, replica with no primary or no reader, …), drawn as a red dashed lead off the handle ending in "?".
      Bottlenecks: planned arrivals per part, following the engine's routing (equal forks, capacity-weighted at a queue, misses
      past caches), giving load at the set traffic, the ceiling (the traffic at which the first part saturates) and the part
      that gives first ("◆ bottleneck · 167%" under its title; others past 100% say "over capacity").
- [x] Review note pinned left of Users: a summary sentence, "holds up to about N/s · first to give X", and sections (wrong links,
      missing, under load, on the sheet). Clicking a line focuses that part or selects that link.
- [x] Save/reopen: "Designs" in the strip (workshop only): save under a name (same name replaces), list with part count and age,
      open, delete (asks "delete?" first). Stored in localStorage (`systemlab.designs.v1`), with every access guarded.
      Reset on the workshop clears it to a blank sheet (changed in D55; it used to return to the last saved design). The review shows the design's name.
- [x] Database-failure copy now accounts for replicas and queues (reads keep flowing from the replica; jobs fail out of sight).
      The sandbox wording is unchanged.
- [x] Verified: engine numerically (gateway split 25/24; DB wall at 70/s → 132% / 23% errors; replica takes ~44% of reads;
      detached replica → its share fails; CDN 53% hit halves API load; queue: 2 workers keep up, 1 worker → backlog → full at ~20s
      → refuses; no worker → full at 400; held jobs drain once linked); review outputs for blank / wrong / sound / overloaded designs.
      In-browser: drag 5 parts onto the sheet → link 6 (one wrong on purpose) → red link + reason, ? leads, ceiling 60/s, DB
      "bottleneck 167%" when run at 100/s → save → reload → reopen (6 parts, 6 links) → reset returns to it; full 8-part chain
      runs clean at 40/s ("It holds together"); database failure on it reads honestly (0% errors, lost 14/s at the queue).
      Regression: sandbox drawer still 3 items, DB 1 handle; challenge slot-in counts exact (3/2 → 4/4 → 5/5 → 6/6).
      No console errors. tsc, lint and build clean.

### Polish: readability, sheet switcher, About page, SEO ✅ (2026-10-06)
- [x] Readability: text tones split from stroke tones (`--text-soft` 0.78, `--text-faint` 0.56; strokes unchanged).
      Tiny labels enlarged (7–8.5px → 9–10.5px, 9px → 11px), wide tracking tightened (0.2–0.3em → 0.14–0.16em),
      `/50`–`/70` faded text removed.
- [x] Font: Instrument Serif italic replaced by Inter (upright) for names and prose (`font-sans`); JetBrains Mono kept for labels.
- [x] Sheet switcher is now a bordered button (Sheet 03 · Workshop ▾) with hover/open states; menu marks the current sheet
      with an accent bar and sits above the hint line (z-20).
- [x] Readout: tighter rows and wider label column so "HEALTH OK" doesn't run together; anchored a bit lower so it
      clears the coordinate mark.
- [x] `/about` page (static): what it is, Build/Run/Break, the three sheets, the nine parts (from `catalog.ts`), who it's for.
      "About →" link under the tagline on the canvas.
- [x] SEO: title template, description, keywords, canonical, Open Graph/Twitter, theme colour, `robots.ts`, `sitemap.ts`,
      WebApplication JSON-LD on /about. Set `NEXT_PUBLIC_SITE_URL` in production (`src/lib/site.ts`).
- [x] Verified in the browser (desktop + 390px About with no horizontal overflow, no console errors); tsc, lint, build clean.

### Known limitations / notes
- No Open Graph image yet (social cards show text only).
- Workshop: readouts and link labels collide when parts sit close in a horizontal chain (same cause as D19's readout placement).
- Workshop: the planned load assumes the cache dial's full hit rate; short TTLs make the measured load higher than planned.
- Workshop: requests are all one kind (reads), so "writes through a queue, reads from a replica" is modelled by where links go,
  not by request type. Replicas copy instantly (no replication lag is simulated).
- Workshop: Break scenarios still target only API servers and databases. Designs live in one browser only (no export).
- A pool of 5+ servers stacks tall, so fit-to-view zooms the sheet out a lot.
- Slot-in only knows the three standard lines (users→api, api→database, pool siblings). Unusual drawings are left alone.
- With Redis above, the API → Redis link rises through the API's readout (readouts always sit above-right of a glyph).
- The DB has no capacity, so "load reduction" shows as DB req/s, not as DB strain (as in Part 3).
- The experiment's leader line can touch the target node's readout.
- Scenario copy is static per scenario; the result sentence adapts only to pool size and whether a balancer is present.
- The LB is placed near the server column, so its long note can sit over the lowest server (the backdrop keeps it legible).
- The reveal-pan can push the top of the sheet out of view. Fit (click the zoom %) brings it back.
- Round-robin has no health checks by design (later concept). It keeps sending to an overloaded server.
- Only the API has capacity. The DB has a fixed ~6ms cost and never saturates (not in Part 3 scope).
- Particles aren't dimmed when a node is focused.
- Requests are one-way visually (no response particles). Latency is the modelled round trip.
- A users→database link passes behind the API Server and its label can overlap the API title until a node is dragged.
- The focus note hangs below the node and can run off-screen if the node sits near the bottom/right edge. There's no auto-pan.
- On narrow phones the fitted view is limited by `minZoom={0.3}`, so the graph appears small.
- React Flow attribution is kept and styled very faint.

### Next (do not start until the user asks)
- Part 9: TBD by the user.
