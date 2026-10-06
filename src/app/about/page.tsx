import type { Metadata } from "next";
import Link from "next/link";
import { catalog } from "@/lib/catalog";
import type { LabNodeType } from "@/lib/graph";
import { SITE_URL } from "@/lib/site";

const description =
  "SystemLab is an interactive canvas for learning system design. Build an architecture, run traffic through it, " +
  "break a part on purpose and see how the whole system responds.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: { title: "About SystemLab", description, url: "/about" },
};

const PARTS: ReadonlyArray<readonly [LabNodeType, string]> = [
  ["cdn", "CDN"],
  ["gateway", "API Gateway"],
  ["loadbalancer", "Load Balancer"],
  ["api", "API Server"],
  ["queue", "Queue"],
  ["worker", "Worker"],
  ["cache", "Redis"],
  ["database", "Database"],
  ["replica", "Read Replica"],
];

const SHEETS = [
  ["01", "Foundation", "A sandbox with Users → API → Database. Add servers, a balancer and a cache, then run traffic and try the Break experiments."],
  ["02", "The surge", "A challenge. Traffic is about to spike, so build something that holds before the trial starts, and get scored on how it does."],
  ["03", "Workshop", "A blank sheet with only Users on it. Drag in any of the nine parts and link them. A live review flags wrong links, missing connections and the part that will give out first."],
] as const;

const STEPS = [
  ["Build", "Drag parts onto the sheet and draw links from one handle to another, the way you would sketch on a whiteboard."],
  ["Run", "Press Run and requests flow along the links. Each part shows its load, latency and errors as it happens."],
  ["Break", "Kill an API server or take the database down, and watch what the rest of the system does."],
] as const;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SystemLab",
  url: SITE_URL,
  description,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Any (web browser)",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint";

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
        <nav className="flex items-center justify-between">
          <Link href="/" className="font-sans text-[22px] font-semibold leading-none tracking-[-0.01em] text-ink">
            System<span className="font-normal text-ink-soft">Lab</span>
          </Link>
          <Link
            href="/"
            className="border border-white/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-accent/50 hover:text-ink"
          >
            Open the lab →
          </Link>
        </nav>

        <header className="mt-16 sm:mt-20">
          <p className={label}>About</p>
          <h1 className="mt-4 font-sans text-[34px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[44px]">
            Learn system design by breaking systems.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[17px] leading-relaxed text-ink-soft">
            Diagrams in books never fail. Real systems do. SystemLab is a drawing sheet where your architecture actually
            runs: requests travel along the links you draw, parts fill up and slow down, and when one gives out, you see
            what happens to everything around it.
          </p>
        </header>

        <section className="mt-16" aria-labelledby="how">
          <h2 id="how" className={label}>
            How it works
          </h2>
          <ol className="mt-6 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="bg-paper p-5">
                <span className="font-mono text-[11px] text-accent">0{i + 1}</span>
                <h3 className="mt-2 font-sans text-[17px] font-semibold text-ink">{title}</h3>
                <p className="mt-2 font-sans text-[15px] leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16" aria-labelledby="sheets">
          <h2 id="sheets" className={label}>
            The sheets
          </h2>
          <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
            {SHEETS.map(([n, title, text]) => (
              <li key={n} className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
                <p className="font-sans text-[16px] font-semibold text-ink">
                  <span className="mr-2 font-mono text-[11px] font-normal text-ink-faint">{n}</span>
                  {title}
                </p>
                <p className="font-sans text-[15px] leading-relaxed text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="parts">
          <h2 id="parts" className={label}>
            The parts you can use
          </h2>
          <dl className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {PARTS.map(([type, title]) => (
              <div key={type}>
                <dt className="flex items-baseline justify-between gap-3">
                  <span className="font-sans text-[16px] font-semibold text-ink">{title}</span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">
                    {catalog[type].role}
                  </span>
                </dt>
                <dd className="mt-1.5 font-sans text-[15px] leading-relaxed text-ink-soft">{catalog[type].summary}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16" aria-labelledby="who">
          <h2 id="who" className={label}>
            Who it&apos;s for
          </h2>
          <p className="mt-6 font-sans text-[16px] leading-relaxed text-ink-soft">
            Engineers preparing for system design interviews, students meeting distributed systems for the first time,
            and anyone who wants to see why caching, load balancing, queues and replication exist, instead of just
            memorising them. Everything runs in your browser. There&apos;s no account, and designs you save stay on your
            device.
          </p>
        </section>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8">
          <p className="font-sans text-[15px] text-ink-soft">Ready to break something?</p>
          <Link
            href="/"
            className="border border-accent/60 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-accent hover:text-paper"
          >
            Open the lab →
          </Link>
        </div>
      </main>
    </div>
  );
}
