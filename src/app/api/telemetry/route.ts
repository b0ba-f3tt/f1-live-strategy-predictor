import type { Compound, Driver, LapSnapshot, TrackStatus } from "@/types/f1";
import silverstonePreset from "@/data/presets/2024_silverstone_r.json";
import monzaPreset from "@/data/presets/2024_monza_r.json";
import singaporePreset from "@/data/presets/2023_singapore_r.json";

export const dynamic = "force-dynamic";

const PRESET_MAP: Record<string, LapSnapshot> = {
  "2024_silverstone_r": silverstonePreset as unknown as LapSnapshot,
  silverstone: silverstonePreset as unknown as LapSnapshot,
  "2024_monza_r": monzaPreset as unknown as LapSnapshot,
  monza: monzaPreset as unknown as LapSnapshot,
  "2023_singapore_r": singaporePreset as unknown as LapSnapshot,
  singapore: singaporePreset as unknown as LapSnapshot,
};

const OPENF1_BASE = "https://api.openf1.org/v1";

function sliceSnapshotToLap(base: LapSnapshot, requestedLap?: number): LapSnapshot {
  const allLaps = base.laps ?? [];
  const totalLaps = base.totalLaps || allLaps.length || 53;
  const targetLap =
    requestedLap && Number.isFinite(requestedLap) && requestedLap >= 1
      ? Math.min(Math.floor(requestedLap), totalLaps)
      : base.currentLap || 1;

  const lapEntry = allLaps.find((l) => l.lap === targetLap);
  const drivers = lapEntry?.drivers?.length ? lapEntry.drivers : base.drivers;

  return {
    ...base,
    currentLap: targetLap,
    lap: targetLap,
    totalLaps,
    drivers,
    weather: lapEntry?.weather ?? base.weather,
    trackStatus: (lapEntry?.trackStatus ?? base.trackStatus ?? "GREEN") as TrackStatus,
    laps: allLaps,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionKey = url.searchParams.get("sessionKey");
  const rawPreset = (
    url.searchParams.get("preset") ??
    url.searchParams.get("dataset") ??
    url.searchParams.get("session") ??
    "2024_monza_r"
  ).toLowerCase();
  const lapParam = Number(url.searchParams.get("lap"));
  const requestedLap = Number.isFinite(lapParam) && lapParam >= 1 ? lapParam : undefined;

  if (!sessionKey) {
    const selected = PRESET_MAP[rawPreset] ?? PRESET_MAP["2024_monza_r"];
    return Response.json(sliceSnapshotToLap(selected, requestedLap));
  }

  try {
    const key = sessionKey === "latest" ? "latest" : String(parseInt(sessionKey, 10));
    const [driversRes, intervalsRes, weatherRes] = await Promise.all([
      fetch(${OPENF1_BASE}/drivers?session_key=, { next: { revalidate: 15 } }),
      fetch(${OPENF1_BASE}/intervals?session_key=, { next: { revalidate: 15 } }),
      fetch(${OPENF1_BASE}/weather?session_key=, { next: { revalidate: 30 } }),
    ]);

    const driversData = driversRes.ok ? await driversRes.json() : [];
    const intervalsData = intervalsRes.ok ? await intervalsRes.json() : [];
    const weatherData = weatherRes.ok ? await weatherRes.json() : [];

    if (!Array.isArray(driversData) || driversData.length === 0) {
      return Response.json(sliceSnapshotToLap(PRESET_MAP[rawPreset] ?? PRESET_MAP["2024_monza_r"], requestedLap));
    }

    const latestIntervals = new Map<number, { gap_to_leader?: number; interval?: number }>();
    if (Array.isArray(intervalsData)) {
      for (const item of intervalsData) {
        if (typeof item.driver_number === "number") {
          latestIntervals.set(item.driver_number, item);
        }
      }
    }

    const latestWeather = Array.isArray(weatherData) && weatherData.length > 0 ? weatherData[weatherData.length - 1] : null;

    const drivers: Driver[] = driversData.slice(0, 20).map((d: Record<string, unknown>, idx: number) => {
      const drvNum = typeof d.driver_number === "number" ? d.driver_number : idx + 1;
      const interval = latestIntervals.get(drvNum);
      const rawTeamColor = typeof d.team_colour === "string" && d.team_colour ? # : "#3B82F6";
      return {
        driverId: String(d.name_acronym || d.broadcast_name || DRV),
        driverName: String(d.full_name || d.name_acronym || Driver ),
        teamName: String(d.team_name || "Constructor"),
        teamColor: rawTeamColor,
        position: idx + 1,
        gapAhead: typeof interval?.interval === "number" ? interval.interval : null,
        gapToLeader: typeof interval?.gap_to_leader === "number" ? interval.gap_to_leader : idx * 1.1,
        intervalAhead: typeof interval?.interval === "number" ? interval.interval : null,
        compound: "MEDIUM" as Compound,
        tyreAge: 5,
        pitStops: 0,
        lastLapTime: 91.5 + idx * 0.12,
      };
    });

    const snapshot: LapSnapshot = {
      sessionId: key,
      name: OpenF1 Live Session (),
      circuit: "Live Circuit",
      totalLaps: 53,
      currentLap: 1,
      lap: 1,
      weather: {
        airTemp: typeof latestWeather?.air_temperature === "number" ? latestWeather.air_temperature : 24,
        trackTemp: typeof latestWeather?.track_temperature === "number" ? latestWeather.track_temperature : 34,
        rainfall: Boolean(latestWeather?.rainfall),
        flag: "GREEN",
      },
      trackStatus: "GREEN",
      drivers,
      laps: [],
    };

    return Response.json(snapshot);
  } catch {
    return Response.json(sliceSnapshotToLap(PRESET_MAP[rawPreset] ?? PRESET_MAP["2024_monza_r"], requestedLap));
  }
}
