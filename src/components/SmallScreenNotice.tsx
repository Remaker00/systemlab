"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

/** Phones, and touch tablets in portrait: too small to drag parts and hit link handles. */
const SMALL_SCREEN = "(max-width: 767px), (pointer: coarse) and (max-width: 1023px)";
const DISMISSED_KEY = "systemlab.small-screen-dismissed";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // storage blocked: the note simply shows again next time
  }
}

/**
 * A drafting note over the canvas on small screens, suggesting a laptop or PC.
 * It's advice, not a wall: "Continue anyway" opens the sheet for the rest of the session.
 */
export function SmallScreenNotice() {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = matchMedia(SMALL_SCREEN);
    const update = () => setOpen(query.matches && !wasDismissed());
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    card.current?.focus(); // focus the note itself, so no button looks pre-pressed
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      rememberDismissed();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismiss() {
    rememberDismissed();
    setOpen(false);
  }

  async function sendLink() {
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: "SystemLab — learn system design by breaking systems", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared("copied");
    } catch (error) {
      // closing the share sheet is not a failure
      if ((error as Error).name !== "AbortError") setShared("failed");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="small-screen-title"
          aria-describedby="small-screen-body"
          className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 px-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div ref={card} tabIndex={-1} className="relative w-full max-w-sm border border-ink-faint/30 px-6 pb-6 pt-7 outline-none">
            {/* registration corners, as on every node */}
            {["left-0 top-0 border-l border-t", "right-0 top-0 border-r border-t", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map(
              (corner) => (
                <span key={corner} aria-hidden className={`absolute size-3 -m-px border-accent ${corner}`} />
              ),
            )}

            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">Note · sheet size</p>

            <LaptopGlyph />

            <h2 id="small-screen-title" className="font-sans text-[22px] font-semibold leading-tight tracking-[-0.01em] text-ink">
              Best on a bigger sheet.
            </h2>
            <p id="small-screen-body" className="mt-3 font-sans text-[14px] leading-relaxed text-ink-soft">
              SystemLab is a drafting table: you drag parts onto the sheet, draw links between small handles and read live
              annotations beside each part. On a phone the sheet gets too small to work on. Open it on a{" "}
              <span className="text-ink">laptop or PC</span> for the full experience.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={sendLink}
                className="border border-accent/60 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent transition-colors outline-none hover:bg-accent hover:text-paper focus-visible:bg-accent focus-visible:text-paper"
              >
                {shared === "copied" ? "Link copied ✓" : "Send the link to my computer"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="border border-ink-faint/30 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-soft transition-colors outline-none hover:border-ink hover:text-ink focus-visible:border-ink focus-visible:text-ink"
              >
                Continue anyway
              </button>
            </div>

            <p className="mt-4 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
              <span role="status">{shared === "failed" ? "Couldn't copy — copy it from the address bar" : " "}</span>
              <Link href="/about" className="text-ink-soft underline decoration-ink-faint/40 underline-offset-4 hover:text-accent">
                About →
              </Link>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A laptop in the same hairline, hidden-line style as the node glyphs. */
function LaptopGlyph() {
  return (
    <svg viewBox="0 0 120 64" aria-hidden className="my-5 h-14 w-auto" fill="none" strokeWidth={0.9}>
      <rect x="22" y="6" width="76" height="46" stroke="var(--ink-soft)" />
      <rect x="27" y="11" width="66" height="36" stroke="var(--ink-faint)" strokeDasharray="1.5 2.5" />
      <path d="M12 52h96l-6 8H18z" stroke="var(--ink-soft)" />
      <path d="M52 56h16" stroke="var(--ink-faint)" />
      {/* a tiny architecture on the screen: users → api → db */}
      <circle cx="40" cy="29" r="3" stroke="var(--accent)" />
      <rect x="56" y="25" width="8" height="8" stroke="var(--accent)" />
      <ellipse cx="81" cy="27" rx="4" ry="1.6" stroke="var(--accent)" />
      <path d="M77 27v5c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6v-5" stroke="var(--accent)" />
      <path d="M43.5 29H55M65 29h11" stroke="var(--accent)" strokeDasharray="1 2" />
    </svg>
  );
}
