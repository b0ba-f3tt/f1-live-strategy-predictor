/**
 * Telemetry anomaly detection: modified Z-score lap-time drops and tire-cliff
 * detection. Pure functions — no side effects, no I/O.
 */

import type { Driver, LapSnapshot } from "@/types/f1";

export interface AnomalyAlert {
  driverId: string;
  lap: number;
  type: "ANOMALY" | "CLIFF";
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  value: number; // seconds lost vs. median
}

export interface CliffDetection {
  driverId: string;
  lap: number;
  tyreAge: number;
  compound: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  deltaVsMedian: number;
}

const MODIFIED_Z_THRESHOLD = 2.8;
const CLIFF_ABSOLUTE_THRESHOLD = 0.8; // s/lap lost vs. median
const CLIFF_RELATIVE_THRESHOLD = 0.4; // s/lap lost vs. median, for softer compounds

export function modifiedZScore(values: number[]): number[] {
  if (values.length < 3) return values.map(() => 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const deviations = values.map((v) => v - mean);
  const mad =
    deviations
      .map((d) => Math.abs(d))
      .sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
  if (mad === 0) return deviations.map(() => 0);
  return deviations.map((d) => (0.6745 * d) / mad);
}

export function detectLapAnomalies(
  driverId: string,
  lapTimes: (number | null)[]
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const valid = lapTimes
    .map((t, i) => (t != null ? { lap: i + 1, time: t } : null))
    .filter((x): x is { lap: number; time: number } => x !== null);
  if (valid.length < 5) return alerts;

  const times = valid.map((v) => v.time);
  const z = modifiedZScore(times);
  for (let i = 0; i < valid.length; i++) {
    if (Math.abs(z[i]) > MODIFIED_Z_THRESHOLD) {
      const median = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)];
      const delta = times[i] - median;
      alerts.push({
        driverId,
        lap: valid[i].lap,
        type: "ANOMALY",
        severity: Math.abs(z[i]) > 5 ? "HIGH" : Math.abs(z[i]) > 4 ? "MEDIUM" : "LOW",
        message: `Lap ${valid[i].lap}: ${delta > 0 ? "+" : ""}${delta.toFixed(3)}s vs median (${median.toFixed(3)}s), z=${z[i].toFixed(2)}`,
        value: delta,
      });
    }
  }
  return alerts;
}

export function detectTireCliffs(
  snapshots: LapSnapshot[],
  driverId: string
): CliffDetection[] {
  const detections: CliffDetection[] = [];
  for (const snap of snapshots) {
    const driver = snap.drivers.find((d) => d.driverId === driverId);
    if (!driver) continue;
    const age = driver.tyreAge;
    if (age < 3) continue;
    // Find this driver's own recent lap times to compute a baseline
    const prior = snapshots.filter((s) => s.lap < snap.lap);
    const ownTimes = prior
      .map((s) => s.drivers.find((d) => d.driverId === driverId)?.lastLapTime)
      .filter((t): t is number => t != null);
    if (ownTimes.length < 3) continue;
    const median = [...ownTimes].sort((a, b) => a - b)[Math.floor(ownTimes.length / 2)];
    const current = driver.lastLapTime;
    if (current == null) continue;
    const delta = current - median;
    const threshold =
      driver.compound === "SOFT" || driver.compound === "INTERMEDIATE" || driver.compound === "WET"
        ? CLIFF_RELATIVE_THRESHOLD
        : CLIFF_ABSOLUTE_THRESHOLD;
    if (delta > threshold) {
      detections.push({
        driverId,
        lap: snap.lap,
        tyreAge: age,
        compound: driver.compound,
        severity: delta > 1.5 ? "HIGH" : delta > 1.0 ? "MEDIUM" : "LOW",
        deltaVsMedian: delta,
      });
    }
  }
  return detections;
}

export function analyzeSnapshots(
  snapshots: LapSnapshot[],
  driverIds: string[]
): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  for (const driverId of driverIds) {
    const times: (number | null)[] = [];
    for (const snap of snapshots) {
      const d = snap.drivers.find((x) => x.driverId === driverId);
      times.push(d?.lastLapTime ?? null);
    }
    alerts.push(...detectLapAnomalies(driverId, times));
  }
  return alerts.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}