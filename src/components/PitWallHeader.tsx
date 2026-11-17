"use client";

import { ChevronDown, Play, Pause, SkipForward, SkipBack, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Driver } from "@/types/f1";

const PRESETS = ["silverstone", "monza", "singapore"] as const;
const ALL_DRIVERS = ["LEC", "VER", "NOR", "HAM", "PIA", "RUS", "ALO", "SAI", "LAR", "RUS"] as const;

interface PitWallHeaderProps {
  preset: string;
  onPresetChange: (p: string) => void;
  drivers: string[];
  onDriversChange: (d: string[]) => void;
  onLiveFetch: (key: number) => void;
  isLive: boolean;
  currentLap: number;
  totalLaps: number;
  onLapChange: (lap: number) => void;
}

export function PitWallHeader({
  preset,
  onPresetChange,
  drivers,
  onDriversChange,
  onLiveFetch,
  isLive,
  currentLap,
  totalLaps,
  onLapChange,
}: PitWallHeaderProps) {
  const [showDriverMenu, setShowDriverMenu] = useState(false);
  const [tempDrivers, setTempDrivers] = useState<string[]>(drivers);

  const handleDriverToggle = (d: string) => {
    const newSelected = tempDrivers.includes(d)
      ? tempDrivers.filter((x) => x !== d)
      : [...tempDrivers.slice(0, 2), d].slice(0, 3);
    setTempDrivers(newSelected);
  };

  const saveDrivers = () => {
    onDriversChange(tempDrivers);
    setShowDriverMenu(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10">
      {/* Left: Grand Prix Selector */}
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">F1 Live Strategy Predictor</h2>
        <select
          value={preset}
          onChange={(e) => onPresetChange(e.target.value)}
          className="bg-black/30 border border-white/20 rounded px-2 py-1 text-sm"
        >
          {PRESETS.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p === "silverstone" ? "Silverstone 2024" : p === "monza" ? "Monza 2024" : "Singapore 2023"}
            </option>
          ))}
        </select>
      </div>

      {/* Center: Lap Scrubber */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onLapChange(Math.max(1, currentLap - 1))}
          disabled={currentLap <= 1}
          className="p-1 rounded hover:bg-white/10 disabled:opacity-50"
        >
          <SkipBack size={16} />
        </button>
        <span className="font-mono text-sm">
          Laps {currentLap} / {totalLaps}
        </span>
        <input
          type="range"
          min={1}
          max={totalLaps}
          value={currentLap}
          onChange={(e) => onLapChange(parseInt(e.target.value))}
          className="w-24"
        />
        <button
          onClick={() => onLapChange(Math.min(totalLaps, currentLap + 1))}
          disabled={currentLap >= totalLaps}
          className="p-1 rounded hover:bg-white/10 disabled:opacity-50"
        >
          <SkipForward size={16} />
        </button>
      </div>

      {/* Right: Driver Selection & Live Button */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowDriverMenu(true)}
            className="flex items-center gap-1 px-3 py-1 bg-black/30 border border-white/20 rounded text-sm"
          >
            Drivers: {drivers.join(", ")}
            <ChevronDown size={14} />
          </button>
          {showDriverMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-black/90 border border-white/20 rounded shadow-lg z-50">
              <div className="max-h-64 overflow-y-auto p-2">
                {ALL_DRIVERS.map((d) => (
                  <label key={d} className="flex items-center gap-2 px-2 py-1 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempDrivers.includes(d)}
                      onChange={() => handleDriverToggle(d)}
                      disabled={tempDrivers.filter((x) => x === d).length >= (drivers.includes(d) ? 0 : 1) && tempDrivers.length >= 3}
                    />
                    <span>{d}</span>
                  </label>
                ))}
              </div>
              <div className="border-t border-white/10 p-2 flex gap-1">
                <button onClick={saveDrivers} className="flex-1 px-2 py-1 text-xs bg-green-600/70 rounded">
                  Save
                </button>
                <button onClick={() => setShowDriverMenu(false)} className="flex-1 px-2 py-1 text-xs bg-gray-600/70 rounded">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}