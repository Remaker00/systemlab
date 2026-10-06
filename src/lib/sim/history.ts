import type { Metrics } from "./engine";

/** A short trail of whole-system figures, so "before" and "after" can be read back at exact sim times. */
export type Sample = Pick<Metrics, "time" | "rps" | "latencyMs" | "errorRate">;

const KEEP_S = 120;

export class History {
  private samples: Sample[] = [];

  reset() {
    this.samples = [];
  }

  push({ time, rps, latencyMs, errorRate }: Metrics) {
    this.samples.push({ time, rps, latencyMs, errorRate });
    while (this.samples.length && this.samples[0].time < time - KEEP_S) this.samples.shift();
  }

  /** The last sample taken at or before `time`. */
  at(time: number): Sample | undefined {
    for (let i = this.samples.length - 1; i >= 0; i--) if (this.samples[i].time <= time) return this.samples[i];
    return undefined;
  }
}
