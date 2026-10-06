import type { Metrics } from "./engine";

/** A short trail of whole-system figures, so "before" and "after" can be read back at exact sim times. */
export type Sample = Pick<Metrics, "time" | "rps" | "latencyMs" | "errorRate"> & {
  loads: Record<string, number>; // capacity node id → utilisation
};

const KEEP_S = 600; // long enough that a finished trial can still be read back

export class History {
  private samples: Sample[] = [];

  reset() {
    this.samples = [];
  }

  push({ time, rps, latencyMs, errorRate, loads }: Metrics) {
    const util: Record<string, number> = {};
    for (const [id, l] of Object.entries(loads)) util[id] = l.load;
    this.samples.push({ time, rps, latencyMs, errorRate, loads: util });
    while (this.samples.length && this.samples[0].time < time - KEEP_S) this.samples.shift();
  }

  /** The last sample taken at or before `time`. */
  at(time: number): Sample | undefined {
    for (let i = this.samples.length - 1; i >= 0; i--) if (this.samples[i].time <= time) return this.samples[i];
    return undefined;
  }

  /** Every sample taken within [from, to]. */
  range(from: number, to: number): Sample[] {
    return this.samples.filter((s) => s.time >= from && s.time <= to);
  }
}
