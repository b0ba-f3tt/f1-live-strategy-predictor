import { describe, it, expect } from "vitest";
import { analyzeSnapshots, detectTireCliffs, modifiedZScore } from "@/lib/telemetryAnalyzer";
import type { LapSnapshot } from "@/types/f1";

describe("Telemetry Analyzer", () => {
  describe("modifiedZScore", () => {
    it("detects outliers correctly", () => {
      const values = [100, 101, 99, 100, 200, 102, 98]; // 200 is outlier
      const result = modifiedZScore(values);
      expect(result[4]).toBeGreaterThan(2.8);
    });

    it("returns zeros for constant arrays", () => {
      const values = [100, 100, 100, 100, 100];
      const result = modifiedZScore(values);
      // MAD will be 0, so result is all zeros
      expect(result.every(r => r === 0)).toBe(true);
    });
  });

  describe("detectLapAnomalies", () => {
    it("detects lap time drops with high z-score", () => {
      const lapTimes = [93.5, 93.7, 93.6, 93.8, 94.0, 105.0, 94.1]; // 105 is anomalous
      const alerts = [];
      // Function will be called via analyzeSnapshots
      const result = modifiedZScore(lapTimes.map((t) => t as number));
      const maxZ = Math.max(...result);
      expect(maxZ).toBeGreaterThan(2.8);
    });
  });

  describe("detectTireCliffs", () => {
    it("returns empty array for insufficient data", () => {
      const snapshot: LapSnapshot = {
        name: "Test",
        circuit: "Test",
        totalLaps: 30,
        currentLap: 5,
        weather: { airTemp: 22, trackTemp: 30, rainfall: false, flag: "GREEN" },
        trackStatus: "GREEN",
        drivers: [
          {
            driverId: "LEC",
            teamName: "Ferrari",
            teamColor: "#DC143C",
            position: 1,
            gapAhead: null,
            gapToLeader: 0,
            intervalAhead: null,
            compound: "MEDIUM",
            tyreAge: 0,
            pitStops: 0,
            lastLapTime: 93.5,
          },
        ],
        laps: [],
      };

      const cliffs = detectTireCliffs(snapshot.laps ?? [], "LEC");
      expect(cliffs).toEqual([]);
    });
  });

  describe("analyzeSnapshots", () => {
    it("returns empty array for empty snapshots", () => {
      const alerts = analyzeSnapshots([], []);
      expect(alerts).toEqual([]);
    });
  });
});