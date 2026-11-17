import { generateBriefing } from "@/lib/strategyAgent";
import type { Strategy } from "@/types/f1";

const DEFAULT_STRATEGIES: Strategy[] = [
  { id: "stay", label: "Stay Out", pitLaps: [], compounds: [], description: "No stops" },
  { id: "box", label: "Box This Lap", pitLaps: [1, 2, 3, 4, 5], compounds: ["MEDIUM"], description: "Early stop onto medium" },
  { id: "undercut", label: "Undercut", pitLaps: [1, 2, 3, 4, 5], compounds: ["SOFT"], description: "Soft undercut" },
  { id: "two-stop", label: "Two-Stop Attack", pitLaps: [3, 15], compounds: ["HARD", "MEDIUM"], description: "Aggressive two-stop" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { driverIds, snapshot, currentLap, circuit } = body;

    if (!driverIds || !snapshot) {
      return Response.json({ error: "Missing driverIds or snapshot" }, { status: 400 });
    }

    const customStrategies = body.customStrategies
      ? new Map(Object.entries(body.customStrategies).map(([k, v]) => [k, v as Strategy]))
      : undefined;

    const briefing = await generateBriefing({
      drivers: driverIds,
      snapshot,
      currentLap: currentLap || 1,
      totalLaps: snapshot.totalLaps || 60,
      circuitName: circuit,
    });

    return Response.json(briefing);
  } catch (e) {
    console.error("Agent error:", e);
    return Response.json({ error: "Agent failed", details: String(e) }, { status: 500 });
  }
}

