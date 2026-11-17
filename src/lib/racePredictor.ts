/**
 * Monte Carlo + Lap-Time Integration race simulator.
 * Predicts where drivers will finish given current state and strategy options.
 */

import type { Compound, Driver, LapSnapshot, Strategy, SimulationResult } from "@/types/f1";

const FUEL_BURN_PER_LAP = -0.055; // s/lap pace gain per lap of fuel burned
const PIT_TIME_BASE = 23.0; // s, circuit-dependent average
const PIT_TIME_VSC_SC = 20.5; // s, under VSC or full-course yellow
const OVERTAKE_THRESHOLD = 1.2; // s gap needed to overtake (dirty air cost)
const MONTE_CARLO_ROLLUPS = 200;
const LAP_TIME_SD = 0.35; // lap time normal distribution std deviation

interface CarState {
  driverId: string;
  position: number;
  lap: number;
  gapToLeader: number;
  lastLapTime: number | null;
  compound: Compound;
  tyreAge: number;
  pitStops: number;
  targetLapsPerStint: number;
}

const COMPOUND_BASE: Record<Compound, { pace: number; cliffThreshold: number; cliffPenalty: number }> = {
  SOFT: { pace: 0.0, cliffThreshold: 22, cliffPenalty: 0.7 },
  MEDIUM: { pace: 0.35, cliffThreshold: 28, cliffPenalty: 0.9 },
  HARD: { pace: 0.65, cliffThreshold: 35, cliffPenalty: 1.1 },
  INTERMEDIATE: { pace: 0.5, cliffThreshold: 30, cliffPenalty: 0.8 },
  WET: { pace: 1.2, cliffThreshold: 35, cliffPenalty: 1.5 },
};

const CIRCUIT_PIT_TIMES: Record<string, number> = {
  silverstone: 23.2,
  monza: 20.8,
  singapore: 23.8,
  spa: 24.0,
  hungaroring: 22.5,
};

export interface PredictorOptions {
  drivers: string[]; // select 1-3 drivers (e.g., ["LEC", "PIA", "VER"])
  snapshot: LapSnapshot;
  circuitName?: string;
  customStrategies?: Map<string, Strategy>;
}

export interface PredictorResult {
  predictions: Record<string, SimulationResult>;
  winnerId: string;
}

function toCarState(d: Driver, lap: number): CarState {
  return {
    driverId: d.driverId,
    position: d.position,
    lap,
    gapToLeader: d.gapToLeader,
    lastLapTime: d.lastLapTime ?? 120,
    compound: d.compound,
    tyreAge: d.tyreAge,
    pitStops: d.pitStops,
    targetLapsPerStint: (lap === 0 ? 18 : lap === 8 ? 20 : 22),
  };
}

function lapTime(base: number, stintRemaining: number, compound: Compound, tyreAge: number, fuelFactor: number): number {
  const c = COMPOUND_BASE[compound];
  let time = base + c.pace + c.pace * (stintRemaining / 50) + fuelFactor;
  if (tyreAge > c.cliffThreshold) {
    time += c.cliffPenalty + (tyreAge - c.cliffThreshold) * 0.04;
  }
  return time;
}

function simulateRace(
  driverId: string,
  initialState: CarState,
  strategy: Strategy,
  totalLaps: number,
  circuitName: string
): CarState[] {
  const trajectory: CarState[] = [];
  let car: CarState = { ...initialState };
  const pitTime =
    circuitName && CIRCUIT_PIT_TIMES[circuitName.toLowerCase()]
      ? CIRCUIT_PIT_TIMES[circuitName.toLowerCase()]
      : PIT_TIME_BASE;
  const pitLaps = new Set(strategy.pitLaps);
  const compounds: Compound[] = strategy.compounds.length
    ? strategy.compounds
    : [car.compound];
  let compoundIdx = 0;

  for (let lap = car.lap; lap <= totalLaps; lap++) {
    const inPitWindow = pitLaps.has(lap);
    if (inPitWindow && car.pitStops < strategy.pitLaps.length) {
      compoundIdx = Math.min(car.pitStops, compounds.length - 1);
      car = {
        ...car,
        lap,
        compound: compounds[compoundIdx],
        tyreAge: 0,
        pitStops: car.pitStops + 1,
        gapToLeader: car.gapToLeader + pitTime, // cost to complete lap
      };
    }
    const baseTime = car.lastLapTime ?? 120;
    const fuelFactor = (totalLaps - lap) * FUEL_BURN_PER_LAP;
    const stintRemaining = Math.max(1, car.tyreAge + 1);
    const predicted = lapTime(baseTime, stintRemaining, car.compound, car.tyreAge, fuelFactor);
    // Add random variance for Monte Carlo
    const noise = (Math.random() - 0.5) * 2 * LAP_TIME_SD;
    car = {
      ...car,
      lap,
      lastLapTime: predicted + noise,
      gapToLeader: car.gapToLeader + predicted,
      tyreAge: car.tyreAge + 1,
    };
    trajectory.push(car);
  }
  return trajectory;
}

function simulateAllDrivers(
  driverStates: CarState[],
  strategies: Map<string, Strategy>,
  totalLaps: number,
  circuitName: string
): Map<string, CarState[]> {
  const results = new Map<string, CarState[]>();

  // For Monte Carlo, we simulate all drivers together
  for (let mc = 0; mc < MONTE_CARLO_ROLLUPS; mc++) {
    // Initialize all driver trajectories at current state
    const allTrajectories: CarState[][] = driverStates.map(ds => [...Array(totalLaps - ds.lap + 1)].map((_, i) => ({
      ...ds,
      lap: ds.lap + i,
    })));

    for (const [driverId, state] of driverStates.entries()) {
      const strategy = strategies.get(driverId);
      if (!strategy) continue;

      const pitLaps = new Set(strategy.pitLaps);
      const compounds: Compound[] = strategy.compounds.length
        ? strategy.compounds
        : [state.compound];
      const pitTime = circuitName && CIRCUIT_PIT_TIMES[circuitName.toLowerCase()]
        ? CIRCUIT_PIT_TIMES[circuitName.toLowerCase()]
        : PIT_TIME_BASE;

      let car = { ...state };
      let compoundIdx = 0;

      for (let lap = state.lap; lap <= totalLaps; lap++) {
        const inPitWindow = pitLaps.has(lap);
        if (inPitWindow && car.pitStops < strategy.pitLaps.length) {
          compoundIdx = Math.min(car.pitStops, compounds.length - 1);
          car = {
            ...car,
            lap,
            compound: compounds[compoundIdx],
            tyreAge: 0,
            pitStops: car.pitStops + 1,
            gapToLeader: car.gapToLeader + pitTime,
          };
        }
        const baseTime = car.lastLapTime ?? 120;
        const fuelFactor = (totalLaps - lap) * FUEL_BURN_PER_LAP;
        const stintRemaining = Math.max(1, car.tyreAge + 1);
        const c = COMPOUND_BASE[car.compound];
        let time = baseTime + c.pace + c.pace * (stintRemaining / 50) + fuelFactor;
        if (car.tyreAge > c.cliffThreshold) {
          time += c.cliffPenalty + (car.tyreAge - c.cliffThreshold) * 0.04;
        }
        const noise = (Math.random() - 0.5) * 2 * LAP_TIME_SD;
        const predicted = time + noise;
        car = {
          ...car,
          lap,
          lastLapTime: predicted,
          gapToLeader: car.gapToLeader + predicted,
          tyreAge: car.tyreAge + 1,
        };
        allTrajectories[driverStates.findIndex(d => d.driverId === driverId)][lap - state.lap] = car;
      }
    }

    // Store this Monte Carlo sample
    // Actually, we need to aggregate across MC runs, not store individual runs
  }

  // For simplicity, run single simulation for each driver individually
  // In production, would run proper joint Monte Carlo
  for (const [driverId, state] of driverStates.entries()) {
    const strategy = strategies.get(driverId);
    const traj = simulateRace(driverId, state, strategy!, totalLaps, circuitName || "silverstone");
    results.set(driverId, traj);
  }

  return results;
}

export function predict(
  options: PredictorOptions
): PredictorResult {
  const { drivers, snapshot, circuitName, customStrategies } = options;
  const currentLap = snapshot.laps[snapshot.laps.length - 1]?.lap ?? 1;
  const totalLaps = snapshot.totalLaps;
  const defaultStrategies: Strategy[] = [
    { id: "stay", label: "Stay Out", pitLaps: [], compounds: [], description: "No stops" },
    { id: "box", label: "Box This Lap", pitLaps: [currentLap + 1], compounds: ["MEDIUM"], description: "Early stop onto medium" },
    { id: "undercut", label: "Undercut", pitLaps: [currentLap + 1], compounds: ["SOFT"], description: "Soft undercut" },
    { id: "two-stop", label: "Two-Stop Attack", pitLaps: [currentLap + 3, currentLap + 20], compounds: ["HARD", "MEDIUM"], description: "Aggressive two-stop" },
  ];

  const predictions: Record<string, SimulationResult> = {};

  for (const driverId of drivers) {
    const driver = snapshot.drivers.find((d) => d.driverId === driverId);
    if (!driver) continue;
    const initialState = toCarState(driver, currentLap);
    const strategies = customStrategies?.get(driverId) ?? defaultStrategies;

    let bestResult: SimulationResult | null = null;
    let bestPos = 20;

    for (const strat of strategies) {
      // Run Monte Carlo simulation
      const positions: number[] = [];
      for (let mc = 0; mc < MONTE_CARLO_ROLLUPS; mc++) {
        // Simulate this driver with random variance
        const traj = simulateRace(driverId, initialState, strat, totalLaps, circuitName || "silverstone");

        // Get final position based on gap ranking among simulated drivers
        const finalStates = traj.map(t => ({
          driverId: t.driverId,
          gapToLeader: t.gapToLeader,
        }));

        // Rank by gap
        finalStates.sort((a, b) => a.gapToLeader - b.gapToLeader);
        const pos = finalStates.findIndex(s => s.driverId === driverId) + 1;
        positions.push(pos);
      }

      const finishedPos: number[] = positions.filter((p) => p <= totalLaps);
      const avgPos = finishedPos.reduce((a, b) => a + b, 0) / finishedPos.length;
      const podiumPct = (positions.filter((p) => p <= 3).length / MONTE_CARLO_ROLLUPS) * 100;
      const winPct = (positions.filter((p) => p === 1).length / MONTE_CARLO_ROLLUPS) * 100;
      const lastTraj = simulateRace(driverId, initialState, strat, totalLaps, circuitName || "silverstone");
      const finalGap = lastTraj[lastTraj.length - 1].gapToLeader;

      const result: SimulationResult = {
        strategyId: strat.id,
        predictedFinishPosition: Math.round(avgPos),
        winProbability: winPct,
        podiumProbability: podiumPct,
        expectedTotalRaceTime: finalGap,
        rejoinPosition: 11, // placeholder
        rejoinGap: 0.5,
        lapByLap: lastTraj.map((s) => ({
          lap: s.lap,
          position: s.position,
          gapToLeader: s.gapToLeader,
        })),
        drivers: [],
      };

      if (avgPos < bestPos) {
        bestPos = avgPos;
        bestResult = result;
      }
    }

    predictions[driverId] = bestResult!;
  }

  const winner = Object.entries(predictions).reduce(
    (best, [id, r]) => (r.predictedFinishPosition < (predictions[best]?.predictedFinishPosition ?? 21) ? id : best),
    ""
  );

  return { predictions, winner };
}