export type Compound = "SOFT" | "MEDIUM" | "HARD" | "INTERMEDIATE" | "WET" | (string & {});
export type TrackStatus = "GREEN" | "YELLOW" | "VSC" | "SC" | (string & {});

export interface WeatherData {
  airTemp: number;
  trackTemp: number;
  rainfall: boolean;
  flag?: TrackStatus;
}

export interface Driver {
  driverId: string;
  driverName?: string;
  teamName: string;
  teamColor: string;
  position: number;
  gapToLeader: number;
  gapAhead?: number | null;
  intervalAhead: number | null;
  compound: Compound;
  tyreAge: number;
  pitStops: number;
  lastLapTime: number | null;
}

export interface LapSnapshot {
  sessionId?: string;
  name?: string;
  circuit?: string;
  totalLaps: number;
  currentLap?: number;
  lap?: number;
  weather: WeatherData;
  trackStatus: TrackStatus;
  drivers: Driver[];
  laps?: LapSnapshot[];
}

export type LapRecord = LapSnapshot;

export interface Strategy {
  id: string;
  label: string;
  pitLaps: number[];
  compounds: Compound[];
  description?: string;
}

export interface TrajectoryPoint {
  lap: number;
  position: number;
  gapToLeader: number;
}

export interface SimulationResult {
  strategyId: string;
  predictedFinishPosition: number;
  winProbability: number;
  podiumProbability: number;
  expectedTotalRaceTime: number;
  rejoinPosition: number;
  rejoinGap: number;
  lapByLap: TrajectoryPoint[];
  drivers?: string[];
  allStrategies?: SimulationResult[];
}

export interface TelemetryAlert {
  id?: string;
  lap: number;
  driverId: string;
  type: "ANOMALY" | "CLIFF" | "TIRE_CLIFF" | "UNDERCUT_THREAT" | "WEATHER_CROSSOVER" | (string & {});
  severity?: "CRITICAL" | "HIGH" | "NOMINAL" | (string & {});
  message: string;
  deltaSec?: number;
  zScore?: number;
  slope?: number;
}

export interface StrategyComparisonRow {
  strategyId: string;
  label: string;
  predictedFinish: number;
  podiumPct: number;
  podiumProb?: number;
  rejoinPos: number;
  netDelta: number;
  netDeltaSec?: number;
}

export interface AgentBriefing {
  severity: "CRITICAL" | "HIGH" | "NOMINAL" | (string & {});
  primaryCall: string;
  driverId?: string;
  targetCompound: Compound;
  recommendedLap?: number | null;
  predictedFinish: number;
  confidence: number;
  rejoinWindow: string;
  radioMessage?: string;
  reasoning: string[];
  alerts: TelemetryAlert[];
  strategyComparison: StrategyComparisonRow[];
  mode?: "LLM" | "DETERMINISTIC" | (string & {});
}
