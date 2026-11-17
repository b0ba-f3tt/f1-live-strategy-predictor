"use client";

import type { LapSnapshot, TrackStatus } from "@/types/f1";

const TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "from-[#1D3557] to-[#0D2544]",
  "Mercedes": "from-[#006E51] to-[#004B32]",
  "Aston Martin": "from-[#006A62] to-[#004D42]",
  "Ferrari": "from-[#DC143C] to-[#8B0000]",
  "McLaren": "from-[#F14A68] to-[#D62839]",
  "Alpine": "from-[#006E51] to-[#004B32]",
  "Lamborghini": "from-[#C10000] to-[#7B1D1D]",
  "Haas": "from-[#FFFFFF] to-[#B6B6B6]",
  "Williams": "from-[#005AFF] to-[#003A70]",
  "AlphaTauri": "from-[#6692FF] to-[#4A6491]",
  "Alfa Romeo": "from-[#9A031E] to-[#690214]",
  "RB": "from-[#007AFF] to-[#0050A0]",
  "Sauber": "from-[#007AFF] to-[#0050A0]",
  "Stake F1 Team": "from-[#007AFF] to-[#0050A0]",
};

const COMPOUND_BADGES: Record<string, string> = {
  SOFT: "bg-red-500 text-white",
  MEDIUM: "bg-yellow-400 text-black",
  HARD: "bg-gray-200 text-black",
  INTERMEDIATE: "bg-emerald-500 text-white",
  WET: "bg-blue-500 text-white",
};

const TRACK_STATUS_COLORS: Record<TrackStatus, string> = {
  GREEN: "bg-green-500",
  YELLOW: "bg-yellow-400",
  VSC: "bg-orange-500",
  SC: "bg-red-500",
};

interface TimingTowerProps {
  snapshot: LapSnapshot;
  drivers: string[];
}

export function TimingTower({ snapshot, drivers }: TimingTowerProps) {
  const { drivers: allDrivers, weather, trackStatus } = snapshot;
  const activeStatus: TrackStatus =
    typeof trackStatus === "string"
      ? trackStatus
      : (trackStatus as unknown as LapSnapshot)?.trackStatus ?? "GREEN";

  return (
    <div className="bg-black/20 border border-white/10 rounded-lg p-3 flex flex-col gap-3">
      {/* Weather & Track Status Banner */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span>🌡️</span>
            <span>{weather.airTemp}°C / {weather.trackTemp}°C</span>
          </div>
          {weather.rainfall && (
            <div className="flex items-center gap-1 text-blue-300">
              <span>🌧️</span>
              <span>Rain</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider">{activeStatus}</span>
          <div className={`w-3 h-3 rounded-full ${TRACK_STATUS_COLORS[activeStatus] ?? "bg-green-500"}`} />
        </div>
      </div>

      {/* Timing Tower */}
      <div className="space-y-1 font-mono text-xs">
        {allDrivers.map((d) => {
          const isTracked = drivers.includes(d.driverId);
          const teamColor = TEAM_COLORS[d.teamName] || "from-gray-500 to-gray-700";
          return (
            <div
              key={d.driverId}
              className={`flex items-center gap-2 px-2 py-1 rounded transition-all ${
                isTracked ? "bg-white/10 border border-white/20" : "bg-transparent"
              }`}
            >
              <div className="w-6 text-right">{d.position}</div>
              <span>{d.driverId}</span>
              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${teamColor}`} />
              <span className={`px-1 rounded text-[10px] font-bold ${COMPOUND_BADGES[d.compound] || "bg-gray-500 text-white"}`}>
                {d.compound?.[0] ?? "M"}
              </span>
              <span className="w-8 text-center">T:{d.tyreAge}</span>
              <span className="w-12 text-right">{d.pitStops}</span>
              <div className="flex-1 text-right">
                {d.gapToLeader > 0 ? `+${d.gapToLeader.toFixed(2)}s` : `${d.gapToLeader.toFixed(2)}s`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}