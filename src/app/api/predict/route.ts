import { predict } from "@/lib/racePredictor";
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
    const { driverIds, snapshot, circuitName, customStrategies } = body;

    if (!driverIds || !snapshot) {
      return Response.json({ error: "Missing driverIds or snapshot" }, { status: 400 });
    }

    const customMap = customStrategies
      ? new Map(Object.entries(customStrategies).map(([k, v]) => [k, v as Strategy]))
      : undefined;

    const result = predict({
      drivers: driverIds,
      snapshot,
      circuitName,
      customStrategies: customMap,
    });

    return Response.json(result);
  } catch (e) {
    console.error("Prediction error:", e);
    return Response.json({ error: "Prediction failed", details: String(e) }, { status: 500 });
  }
}
