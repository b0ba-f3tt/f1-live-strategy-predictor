/**
 * Autonomous multi-step AI Race Strategist.
 * Returns LLM-powered or deterministic strategy briefings.
 */

import type { AgentBriefing, Driver, LapSnapshot, Strategy, SimulationResult } from "@/types/f1";
import { analyzeSnapshots, detectTireCliffs } from "./telemetryAnalyzer";
import { predict } from "./racePredictor";

export interface StrategyAgentOptions {
  drivers: string[];
  snapshot: LapSnapshot;
  circuitName?: string;
  currentLap: number;
  totalLaps: number;
}

const DETECTED_CLIFTS = new Map<string, boolean>();

async function callLLM(
  driverIds: string[],
  snapshot: LapSnapshot,
  predictions: Record<string, SimulationResult>
): Promise<AgentBriefing> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1";
  const model = process.env.OPENAI_MODEL || "openai/gpt-oss-120b";

  const prompt = {
    role: "user" as const,
    content: JSON.stringify({
      scenario: "F1 race strategy briefing",
      drivers: driverIds,
      currentGap: snapshot.drivers.find((d) => driverIds.includes(d.driverId))?.gapToLeader,
      predictions: Object.entries(predictions).map(([id, p]) => ({
        driverId: id,
        finishPosition: p.predictedFinishPosition,
        podiumPct: p.podiumProbability,
        winPct: p.winProbability,
        rejoinPos: p.rejoinPosition,
      })),
      circuit: snapshot.totalLaps,
    }),
  };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [prompt],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`LLM error: ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content");

    const parsed: AgentBriefing = JSON.parse(content);
    return { ...parsed, mode: "LLM" };
  } catch (e) {
    console.warn("LLM fallback:", e);
    return runDeterministic(driverIds, snapshot, predictions);
  }
}

export function runDeterministic(
  driverIds: string[],
  snapshot: LapSnapshot,
  predictions: Record<string, SimulationResult>
): AgentBriefing {
  const alerts: AgentBriefing["alerts"] = [];

  // Detect cliffs
  for (const driverId of driverIds) {
    const cliffs = detectTireCliffs((snapshot.laps ?? []), driverId);
    for (const c of cliffs) {
      alerts.push({
        driverId,
        lap: c.lap,
        type: "CLIFF",
        message: `${driverId}: ${c.compound} cliff at tyreAge ${c.tyreAge} (+${c.deltaVsMedian.toFixed(2)}s)`,
      });
    }
  }

  // Rank drivers by prediction
  const sorted = Object.entries(predictions).sort((a, b) => a[1].predictedFinishPosition - b[1].predictedFinishPosition);

  const [bestDriver, bestPred] = sorted[0];
  const primaryCall: AgentBriefing["primaryCall"] = bestPred.predictedFinishPosition <= 3 ? "BOX THIS LAP" : "EXTEND STINT";

  const strategyComparison = sorted.map(([id, p]) => ({
    strategyId: p.strategyId,
    label: p.strategyId === "stay" ? "Stay Out" : p.strategyId === "box" ? "Box" : p.strategyId,
    predictedFinish: p.predictedFinishPosition,
    podiumPct: p.podiumProbability,
    rejoinPos: p.rejoinPosition,
    netDelta: p.expectedTotalRaceTime - (predictions[bestDriver]?.expectedTotalRaceTime ?? 0),
  }));

  return {
    severity: "NOMINAL",
    primaryCall,
    driverId: bestDriver,
    targetCompound: bestPred.strategyId === "stay" ? "SOFT" : bestPred.strategyId === "box" ? "HARD" : "MEDIUM",
    predictedFinish: bestPred.predictedFinishPosition,
    confidence: Math.min(95, 70 + (100 - bestPred.predictedFinishPosition) * 2),
    rejoinWindow: "Lap " + (snapshot.totalLaps - 5),
    reasoning: [
      `Best strategy: ${bestPred.strategyId} for ${bestDriver}`,
      `Predicted position: P${bestPred.predictedFinishPosition}`,
      `Podium probability: ${bestPred.podiumProbability.toFixed(1)}%`,
    ],
    strategyComparison,
    alerts: alerts.slice(0, 5),
    mode: "DETERMINISTIC",
  };
}

export async function generateBriefing(options: StrategyAgentOptions): Promise<AgentBriefing> {
  const { drivers, snapshot, circuitName, currentLap, totalLaps } = options;

  const predictions = predict({ drivers, snapshot, circuitName });

  const hasLLMKey = Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);

  if (hasLLMKey) {
    try {
      return callLLM(drivers, snapshot, predictions.predictions);
    } catch {
      // fall through to deterministic
    }
  }

  return runDeterministic(drivers, snapshot, predictions.predictions);
}
