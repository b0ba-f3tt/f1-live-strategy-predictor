import type { Compound, Driver, LapSnapshot, Strategy, SimulationResult } from "@/types/f1";

const FUEL_BURN_PER_LAP = -0.055;
const PIT_TIME_BASE = 23.0;
const PIT_TIME_VSC_SC = 12.8;
const OVERTAKE_THRESHOLD = 1.2;
const MONTE_CARLO_ROLLUPS = 200;
const LAP_TIME_SD = 0.32;

interface CarState {
  driverId: string;
  position: number;
  lap: number;
  cumulativeTime: number;
  basePace: number;
  compound: Compound;
  tyreAge: number;
  pitStops: number;
}

const COMPOUND_BASE: Record<Compound, { pace: number; degRate: number; cliffThreshold: number; cliffPenalty: number }> = {
  SOFT: { pace: 0.0, degRate: 0.065, cliffThreshold: 18, cliffPenalty: 0.85 },
  MEDIUM: { pace: 0.35, degRate: 0.042, cliffThreshold: 26, cliffPenalty: 0.95 },
  HARD: { pace: 0.65, degRate: 0.025, cliffThreshold: 36, cliffPenalty: 1.1 },
  INTERMEDIATE: { pace: 0.5, degRate: 0.04, cliffThreshold: 28, cliffPenalty: 0.9 },
  WET: { pace: 1.2, degRate: 0.035, cliffThreshold: 34, cliffPenalty: 1.4 },
};

const CIRCUIT_PIT_TIMES: Record<string, number> = {
  silverstone: 23.2,
  monza: 20.8,
  singapore: 23.8,
  spa: 24.0,
  hungaroring: 22.5,
};

export interface PredictorOptions {
  drivers: string[];
  snapshot: LapSnapshot;
  currentLap?: number;
  circuitName?: string;
  customStrategies?: Map<string, Strategy | Strategy[]>;
}

export interface PredictorResult {
  predictions: Record<string, SimulationResult>;
  winnerId: string;
}

function getPitLoss(circuitName: string, trackStatus: LapSnapshot["trackStatus"]): number {
  if (trackStatus === "VSC" || trackStatus === "SC") return PIT_TIME_VSC_SC;
  return CIRCUIT_PIT_TIMES[circuitName.toLowerCase()] ?? PIT_TIME_BASE;
}

function computeLapDuration(
  basePace: number,
  compound: Compound,
  tyreAge: number,
  lapsRemaining: number,
  rainfall: boolean
): number {
  const c = COMPOUND_BASE[compound];
  let lapSec = basePace + c.pace + tyreAge * c.degRate + lapsRemaining * FUEL_BURN_PER_LAP;
  if (tyreAge > c.cliffThreshold) {
    lapSec += c.cliffPenalty + (tyreAge - c.cliffThreshold) * 0.06;
  }
  if (rainfall && compound !== "INTERMEDIATE" && compound !== "WET") {
    lapSec += 4.8;
  } else if (!rainfall && (compound === "INTERMEDIATE" || compound === "WET")) {
    lapSec += 3.2;
  }
  return Math.max(65.0, lapSec);
}

function buildFieldStates(snapshot: LapSnapshot, activeLap: number): CarState[] {
  const lapRecord =
    (snapshot.laps ?? []).find((l) => l.lap === activeLap) ??
    (snapshot.laps ?? [])[(snapshot.laps ?? []).length - 1];
  const sourceDrivers: Driver[] = lapRecord?.drivers?.length ? lapRecord.drivers : snapshot.drivers;

  const leaderBase = Math.min(
    ...sourceDrivers.map((d) => (d.lastLapTime && d.lastLapTime > 60 ? d.lastLapTime : 91.5))
  );

  return sourceDrivers.map((d) => {
    const rawLap = d.lastLapTime && d.lastLapTime > 60 ? d.lastLapTime : leaderBase + d.position * 0.08;
    const c = COMPOUND_BASE[d.compound] ?? COMPOUND_BASE.MEDIUM;
    const inferredBase = rawLap - c.pace - Math.min(d.tyreAge, 25) * c.degRate;
    return {
      driverId: d.driverId,
      position: d.position,
      lap: activeLap,
      cumulativeTime: Math.max(0, d.gapToLeader),
      basePace: Math.max(70, inferredBase),
      compound: d.compound,
      tyreAge: d.tyreAge,
      pitStops: d.pitStops,
    };
  });
}

function simulateFieldRollout(
  initialField: CarState[],
  targetDriverId: string,
  targetStrategy: Strategy,
  startLap: number,
  totalLaps: number,
  circuitName: string,
  trackStatus: LapSnapshot["trackStatus"],
  rainfall: boolean,
  withNoise: boolean
): {
  finishPosition: number;
  totalTime: number;
  rejoinPosition: number;
  rejoinGap: number;
  trajectory: { lap: number; position: number; gapToLeader: number }[];
} {
  const cars: CarState[] = initialField.map((c) => ({ ...c }));
  const pitLoss = getPitLoss(circuitName, trackStatus);
  const targetPitSet = new Set(targetStrategy.pitLaps);
  let targetStopIdx = 0;
  let rejoinPosition = cars.find((c) => c.driverId === targetDriverId)?.position ?? 1;
  let rejoinGap = 0;
  let recordedFirstStop = false;

  const trajectory: { lap: number; position: number; gapToLeader: number }[] = [];

  for (let lap = startLap + 1; lap <= totalLaps; lap++) {
    const lapsRemaining = totalLaps - lap;

    for (const car of cars) {
      let pittedThisLap = false;

      if (car.driverId === targetDriverId) {
        if (targetPitSet.has(lap)) {
          const nextComp =
            targetStrategy.compounds[Math.min(targetStopIdx, targetStrategy.compounds.length - 1)] ?? "HARD";
          targetStopIdx++;
          car.compound = nextComp;
          car.tyreAge = 0;
          car.pitStops += 1;
          car.cumulativeTime += pitLoss;
          pittedThisLap = true;
        }
      } else {
        const threshold = COMPOUND_BASE[car.compound].cliffThreshold;
        if (car.pitStops === 0 && car.tyreAge >= threshold && lapsRemaining > 5) {
          car.compound = rainfall ? "INTERMEDIATE" : car.compound === "SOFT" ? "MEDIUM" : "HARD";
          car.tyreAge = 0;
          car.pitStops += 1;
          car.cumulativeTime += pitLoss;
        }
      }

      const noise = withNoise ? (Math.random() - 0.5) * 2 * LAP_TIME_SD : 0;
      const lapSec = computeLapDuration(car.basePace, car.compound, car.tyreAge, lapsRemaining, rainfall) + noise;
      car.cumulativeTime += lapSec;
      car.tyreAge += 1;
      car.lap = lap;

      if (pittedThisLap && !recordedFirstStop) {
        recordedFirstStop = true;
        const sortedNow = [...cars].sort((a, b) => a.cumulativeTime - b.cumulativeTime);
        const idx = sortedNow.findIndex((c) => c.driverId === targetDriverId);
        rejoinPosition = idx + 1;
        rejoinGap = idx > 0 ? Number((sortedNow[idx].cumulativeTime - sortedNow[idx - 1].cumulativeTime).toFixed(2)) : 0;
      }
    }

    cars.sort((a, b) => a.cumulativeTime - b.cumulativeTime);
    for (let i = 1; i < cars.length; i++) {
      const gapAhead = cars[i].cumulativeTime - cars[i - 1].cumulativeTime;
      if (gapAhead < 0.25 && cars[i].basePace > cars[i - 1].basePace - OVERTAKE_THRESHOLD * 0.25) {
        cars[i].cumulativeTime = cars[i - 1].cumulativeTime + 0.28;
      }
    }

    const leaderTime = cars[0].cumulativeTime;
    cars.forEach((c, idx) => {
      c.position = idx + 1;
      if (c.driverId === targetDriverId) {
        trajectory.push({
          lap,
          position: c.position,
          gapToLeader: Number((c.cumulativeTime - leaderTime).toFixed(3)),
        });
      }
    });
  }

  const finalTarget = cars.find((c) => c.driverId === targetDriverId) ?? cars[0];
  return {
    finishPosition: finalTarget.position,
    totalTime: Number(finalTarget.cumulativeTime.toFixed(3)),
    rejoinPosition,
    rejoinGap,
    trajectory,
  };
}

export function predict(options: PredictorOptions): PredictorResult {
  const { drivers, snapshot, circuitName = snapshot.circuit || "silverstone", customStrategies } = options;
  const activeLap =
    options.currentLap ??
    snapshot.currentLap ??
    (snapshot.laps ?? [])[(snapshot.laps ?? []).length - 1]?.lap ??
    1;
  const totalLaps = Math.max(activeLap + 1, snapshot.totalLaps || 52);
  const initialField = buildFieldStates(snapshot, activeLap);

  const defaultStrategies: Strategy[] = [
    { id: "stay", label: "Stay Out / Extend", pitLaps: [], compounds: [], description: "0 remaining stops" },
    {
      id: "box",
      label: "Box This Lap (Cover)",
      pitLaps: [Math.min(totalLaps - 1, activeLap + 1)],
      compounds: [snapshot.weather?.rainfall ? "INTERMEDIATE" : "HARD"],
      description: "Immediate pit stop",
    },
    {
      id: "undercut",
      label: "Aggressive Undercut",
      pitLaps: [Math.min(totalLaps - 1, activeLap + 1)],
      compounds: [snapshot.weather?.rainfall ? "INTERMEDIATE" : "MEDIUM"],
      description: "High-pace compound undercut",
    },
    {
      id: "two-stop",
      label: "Two-Stop Attack",
      pitLaps: [Math.min(totalLaps - 4, activeLap + 2), Math.min(totalLaps - 1, activeLap + 18)],
      compounds: ["MEDIUM", "SOFT"],
      description: "Split remaining distance across 2 fresh stints",
    },
  ];

  const predictions: Record<string, SimulationResult> = {};

  for (const driverId of drivers) {
    const driverInField = initialField.find((c) => c.driverId === driverId);
    if (!driverInField) continue;

    const rawCustom = customStrategies?.get(driverId);
    const strategies = rawCustom ? (Array.isArray(rawCustom) ? rawCustom : [rawCustom, ...defaultStrategies]) : defaultStrategies;

    let bestResult: SimulationResult | null = null;
    let bestAvgPos = 99;
    const allStrategyResults: SimulationResult[] = [];

    for (const strat of strategies) {
      let posSum = 0;
      let winCount = 0;
      let podiumCount = 0;
      let timeSum = 0;

      for (let mc = 0; mc < MONTE_CARLO_ROLLUPS; mc++) {
        const sim = simulateFieldRollout(
          initialField,
          driverId,
          strat,
          activeLap,
          totalLaps,
          circuitName,
          snapshot.trackStatus ?? "GREEN",
          Boolean(snapshot.weather?.rainfall),
          true
        );
        posSum += sim.finishPosition;
        timeSum += sim.totalTime;
        if (sim.finishPosition === 1) winCount++;
        if (sim.finishPosition <= 3) podiumCount++;
      }

      const deterministic = simulateFieldRollout(
        initialField,
        driverId,
        strat,
        activeLap,
        totalLaps,
        circuitName,
        snapshot.trackStatus ?? "GREEN",
        Boolean(snapshot.weather?.rainfall),
        false
      );

      const avgPos = posSum / MONTE_CARLO_ROLLUPS;
      const simResult: SimulationResult = {
        strategyId: strat.id,
        predictedFinishPosition: Math.max(1, Math.round(avgPos)),
        winProbability: Number(((winCount / MONTE_CARLO_ROLLUPS) * 100).toFixed(1)),
        podiumProbability: Number(((podiumCount / MONTE_CARLO_ROLLUPS) * 100).toFixed(1)),
        expectedTotalRaceTime: Number((timeSum / MONTE_CARLO_ROLLUPS).toFixed(2)),
        rejoinPosition: deterministic.rejoinPosition,
        rejoinGap: deterministic.rejoinGap,
        lapByLap: deterministic.trajectory,
        drivers,
      };

      allStrategyResults.push(simResult);

      if (avgPos < bestAvgPos) {
        bestAvgPos = avgPos;
        bestResult = simResult;
      }
    }

    if (!bestResult && allStrategyResults.length > 0) {
      // Fallback: use the first available strategy result if bestResult was null
      bestResult = allStrategyResults[0];
    }

    if (bestResult) {
      bestResult.allStrategies = allStrategyResults;
      predictions[driverId] = bestResult;
    }
  }

  const winnerId = Object.entries(predictions).reduce(
    (best, [id, r]) =>
      !best || r.predictedFinishPosition < predictions[best].predictedFinishPosition ? id : best,
    drivers[0] ?? ""
  );

  return { predictions, winnerId };
}

