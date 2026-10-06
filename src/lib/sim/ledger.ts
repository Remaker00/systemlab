import type { Metrics } from "./engine";

/**
 * Records how the system behaves for each pool size (the number of capacity-bound servers
 * actually receiving traffic), so one server and several can be compared side by side
 * using measured results, not formulas.
 *
 * A row is written only after the configuration (graph structure, pool size, total capacity,
 * traffic) has held steady for SETTLE_S of simulated time, so the 2s metric windows no longer
 * contain the previous configuration. After that it keeps updating while the configuration holds.
 * The structure matters: per-node arrivals linger for a second after a link is cut, so pool
 * size alone would let half-rewired states leak into a row.
 */

export type LedgerRow = {
  servers: number;
  capacity: number; // summed capacity of the active servers, req/s
  traffic: number; // req/s Users were set to
  latencyMs: number;
  errorRate: number;
};

const SETTLE_S = 3;

export class Ledger {
  rows: LedgerRow[] = [];
  /** pool size currently being observed, once settled */
  current: number | null = null;

  private key = "";
  private since = 0;

  reset() {
    this.rows = [];
    this.current = null;
    this.key = "";
    this.since = 0;
  }

  /** Something abnormal is happening: stop recording and require a fresh settle afterwards. */
  interrupt() {
    this.key = "";
    this.current = null;
  }

  observe(m: Metrics, traffic: number, time: number, structure: string) {
    const active = Object.entries(m.loads).filter(([id]) => (m.arrivals[id] ?? 0) > 0);
    const servers = active.length;
    const capacity = active.reduce((sum, [, l]) => sum + l.capacity, 0);

    const key = `${servers}|${capacity}|${traffic}|${structure}`;
    if (key !== this.key) {
      this.key = key;
      this.since = time;
      this.current = null;
      return;
    }
    if (!servers || time - this.since < SETTLE_S) return;

    this.current = servers;
    const row: LedgerRow = { servers, capacity, traffic, latencyMs: m.latencyMs, errorRate: m.errorRate };
    this.rows = [...this.rows.filter((r) => r.servers !== servers), row].sort((a, b) => a.servers - b.servers);
  }
}
