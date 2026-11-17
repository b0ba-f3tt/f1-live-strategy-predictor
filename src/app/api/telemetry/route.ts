import type { LapSnapshot } from "@/types/f1";

const FALLBACK_PRESETS: Record<string, LapSnapshot> = {
  silverstone: {
    name: "2024 British Grand Prix",
    circuit: "Silverstone",
    totalLaps: 60,
    currentLap: 1,
    weather: { airTemp: 16, trackTemp: 22, rainfall: false, flag: "GREEN" },
    trackStatus: "GREEN",
    drivers: [
      { driverId: "LEC", teamName: "Ferrari", teamColor: "#DC143C", position: 1, gapAhead: null, gapToLeader: 0, intervalAhead: null, compound: "SOFT", tyreAge: 0, pitStops: 0, lastLapTime: 93.5 },
      { driverId: "VER", teamName: "Red Bull Racing", teamColor: "#1D3557", position: 2, gapAhead: null, gapToLeader: 0.8, intervalAhead: null, compound: "SOFT", tyreAge: 0, pitStops: 0, lastLapTime: 93.7 },
      { driverId: "NOR", teamName: "McLaren", teamColor: "#F14A68", position: 3, gapAhead: null, gapToLeader: 1.5, intervalAhead: null, compound: "SOFT", tyreAge: 0, pitStops: 0, lastLapTime: 94.0 },
      { driverId: "HAM", teamName: "Mercedes", teamColor: "#006E51", position: 4, gapAhead: null, gapToLeader: 2.1, intervalAhead: null, compound: "SOFT", tyreAge: 0, pitStops: 0, lastLapTime: 94.4 },
      { driverId: "PIA", teamName: "Aston Martin", teamColor: "#006A62", position: 5, gapAhead: null, gapToLeader: 3.2, intervalAhead: null, compound: "SOFT", tyreAge: 0, pitStops: 0, lastLapTime: 95.1 },
    ],
    laps: [],
  },
};

function generateLaps(preset: string): LapSnapshot[] {
  const base = FALLBACK_PRESETS[preset];
  if (!base) return [];

  const laps: LapSnapshot[] = [];

  for (let lap = 1; lap <= base.totalLaps; lap++) {
    const progress = lap / base.totalLaps;
    const drivers = base.drivers
      .map((d, idx) => {
        const compound = d.position <= 3 ? (progress < 0.5 ? "SOFT" : "MEDIUM") : "HARD";
        const tyreAge = Math.floor(lap * (0.5 + progress));
        const degradationFactor = Math.max(0, 1 + tyreAge * 0.15 / 30);
        const baseTime = (d.lastLapTime ?? 92.0) * degradationFactor;
        const gap = d.gapToLeader + (progress > 0.5 ? progress * 2 : progress);

        return {
          driverId: d.driverId,
          teamName: d.teamName,
          teamColor: d.teamColor,
          position: Math.min(d.position + Math.floor(progress * 2) - 1, 20),
          gapAhead: d.gapAhead,
          gapToLeader: gap,
          intervalAhead: d.intervalAhead,
          compound,
          tyreAge,
          pitStops: d.pitStops + (lap > 35 && idx < 2 ? 1 : 0),
          lastLapTime: baseTime,
        };
      });

    laps.push({
      lap,
      drivers,
      weather: base.weather,
      trackStatus: "GREEN",
      totalLaps: base.totalLaps,
    });
  }

  return laps;
}

Object.keys(FALLBACK_PRESETS).forEach((key) => {
  FALLBACK_PRESETS[key].laps = generateLaps(key);
});

const BASE = "https://api.openf1.org/v1";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionKey = url.searchParams.get("sessionKey");

  // If no session key, return a fallback preset
  if (!sessionKey) {
    return Response.json(FALLBACK_PRESETS.silverstone);
  }

  try {
    const key = parseInt(sessionKey);
    // Fetch drivers from OpenF1
    const driversRes = await fetch(`${BASE}/drivers?session_key=${key}`);
    const driversData = await driversRes.ok ? await driversRes.json() : [];

    // Build snapshot
    const snapshot: LapSnapshot = {
      name: "Live Session",
      circuit: "Live",
      totalLaps: 50,
      currentLap: 1,
      weather: { airTemp: 22, trackTemp: 30, rainfall: false, flag: "GREEN" },
      trackStatus: "GREEN",
      drivers: (driversData as any[]).map((d: any, i: number) => ({
        driverId: d.driver_name || d.driverId,
        teamName: d.team_name || "Unknown",
        teamColor: "#333333",
        position: d.position || i,
        gapAhead: d.interval_to_front || null,
        gapToLeader: d.interval_to_front || 0,
        intervalAhead: d.interval_to_front || null,
        compound: "MEDIUM" as any,
        tyreAge: 0,
        pitStops: 0,
        lastLapTime: d.last_lap_time || 90,
      })),
      laps: [],
    };

    return Response.json(snapshot);
  } catch (e) {
    // Fallback on any error
    return Response.json(FALLBACK_PRESETS.silverstone);
  }
}
