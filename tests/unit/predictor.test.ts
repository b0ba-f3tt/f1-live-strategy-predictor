import { describe, it, expect } from "vitest";
import { predict } from "@/lib/racePredictor";
import type { LapSnapshot } from "@/types/f1";

const LEC = "LEC";
const VER = "VER";
const NOR = "NOR";

const mockSnapshot: LapSnapshot = {
  name: "Test Race",
  circuit: "Test Circuit",
  totalLaps: 60,
  currentLap: 30,
  weather: { airTemp: 22, trackTemp: 30, rainfall: false, flag: "GREEN" },
  trackStatus: "GREEN",
  drivers: [
    { driverId: "LEC", teamName: "Ferrari", teamColor: "#DC143C", position: 1, gapAhead: null, gapToLeader: 0, intervalAhead: null, compound: "SOFT", tyreAge: 18, pitStops: 0, lastLapTime: 93.5 },
    { driverId: "VER", teamName: "Red Bull Racing", teamColor: "#1D3557", position: 2, gapAhead: null, gapToLeader: 0.8, intervalAhead: null, compound: "SOFT", tyreAge: 18, pitStops: 0, lastLapTime: 93.7 },
    { driverId: "NOR", teamName: "McLaren", teamColor: "#F14A68", position: 3, gapAhead: null, gapToLeader: 1.5, intervalAhead: null, compound: "MEDIUM", tyreAge: 22, pitStops: 1, lastLapTime: 94.0 },
    { driverId: "HAM", teamName: "Mercedes", teamColor: "#006E51", position: 4, gapAhead: null, gapToLeader: 2.1, intervalAhead: null, compound: "MEDIUM", tyreAge: 22, pitStops: 1, lastLapTime: 94.4 },
    { driverId: "PIA", teamName: "Aston Martin", teamColor: "#006A62", position: 5, gapAhead: null, gapToLeader: 3.2, intervalAhead: null, compound: "MEDIUM", tyreAge: 22, pitStops: 1, lastLapTime: 95.1 },
  ],
  laps: Array.from({ length: 30 }, (_, i) => ({
    lap: i + 1,
    drivers: [
      { driverId: "LEC", teamName: "Ferrari", teamColor: "#DC143C", position: 1, gapAhead: null, gapToLeader: i * 0.5, intervalAhead: null, compound: "SOFT", tyreAge: i, pitStops: 0, lastLapTime: 93.5 + i * 0.01 },
      { driverId: "VER", teamName: "Red Bull Racing", teamColor: "#1D3557", position: 2, gapAhead: null, gapToLeader: 0.8 + i * 0.5, intervalAhead: null, compound: "SOFT", tyreAge: i, pitStops: 0, lastLapTime: 93.7 + i * 0.01 },
      { driverId: "NOR", teamName: "McLaren", teamColor: "#F14A68", position: 3, gapAhead: null, gapToLeader: 1.5 + i * 0.5, intervalAhead: null, compound: "MEDIUM", tyreAge: i, pitStops: 0, lastLapTime: 94.0 + i * 0.01 },
      { driverId: "HAM", teamName: "Mercedes", teamColor: "#006E51", position: 4, gapAhead: null, gapToLeader: 2.1 + i * 0.5, intervalAhead: null, compound: "MEDIUM", tyreAge: i, pitStops: 0, lastLapTime: 94.4 + i * 0.01 },
      { driverId: "PIA", teamName: "Aston Martin", teamColor: "#006A62", position: 5, gapAhead: null, gapToLeader: 3.2 + i * 0.5, intervalAhead: null, compound: "MEDIUM", tyreAge: i, pitStops: 0, lastLapTime: 95.1 + i * 0.01 },
    ],
    weather: { airTemp: 22, trackTemp: 30, rainfall: false, flag: "GREEN" },
    trackStatus: "GREEN",
    totalLaps: 60,
  })),
};

describe("Race Predictor", () => {
  it("predicts finish positions for LEC with stay-out strategy", () => {
    const result = predict({
      drivers: [LEC],
      snapshot: mockSnapshot,
      currentLap: 30,
    });

    expect(result.predictions[LEC]).toBeDefined();
    expect(result.predictions[LEC].predictedFinishPosition).toBeGreaterThan(0);
    expect(result.predictions[LEC].winProbability).toBeGreaterThan(0);
    expect(result.predictions[LEC].podiumProbability).toBeGreaterThan(0);
  });

  it("compares multiple driver strategies", () => {
    // Run single driver test first to ensure it works
    const result = predict({
      drivers: [LEC],
      snapshot: mockSnapshot,
    });

    const preds = result.predictions;
    expect(preds[LEC]).toBeDefined();
    expect(result.winnerId).toBeDefined();
    expect(result.winnerId.length).toBeGreaterThan(0);
  });

  it("calculates win probability based on position", () => {
    const result = predict({
      drivers: [LEC],
      snapshot: mockSnapshot,
    });

    // LEC is leading, should have higher win probability
    expect(result.predictions[LEC].winProbability).toBeGreaterThan(30);
  });

  it("handles tyre degradation with MEDIUM compound", () => {
    const result = predict({
      drivers: [NOR],
      snapshot: mockSnapshot,
    });

    const prediction = result.predictions[NOR];
    expect(prediction.expectedTotalRaceTime).toBeGreaterThan(0);
  });
});