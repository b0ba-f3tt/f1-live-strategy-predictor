"use client";

import { useState } from "react";
import { Send, Trash2, Plus } from "lucide-react";
import type { Strategy, Compound } from "@/types/f1";

const ALL_DRIVERS = ["LEC", "VER", "NOR", "HAM", "PIA", "RUS", "ALO", "SAI", "LAR", "RUS"] as const;

interface StrategySandboxProps {
  drivers: string[];
  onStrategyChange: (driverId: string, strat: Strategy) => void;
  currentLap: number;
  totalLaps: number;
  circuit: string;
}

const DEFAULT_STRATEGIES: Strategy[] = [
  { id: "stay", label: "Stay Out", pitLaps: [], compounds: [], description: "No stops" },
  { id: "box", label: "Box This Lap", pitLaps: [1, 2, 3, 4, 5], compounds: ["MEDIUM"], description: "Early stop onto medium" },
  { id: "undercut", label: "Undercut", pitLaps: [1, 2, 3, 4, 5], compounds: ["SOFT"], description: "Soft undercut" },
  { id: "two-stop", label: "Two-Stop Attack", pitLaps: [3, 15], compounds: ["HARD", "MEDIUM"], description: "Aggressive two-stop" },
];

export function StrategySandbox({ drivers, onStrategyChange, currentLap, totalLaps, circuit }: StrategySandboxProps) {
  const [editingDriver, setEditingDriver] = useState<string | null>(null);
  const [tempStrategy, setTempStrategy] = useState<Strategy | null>(null);

  const handleEdit = (driverId: string) => {
    setEditingDriver(driverId);
    setTempStrategy({ id: "custom", label: "Custom", pitLaps: [currentLap + 3], compounds: ["MEDIUM"], description: "" });
  };

  const handleSave = () => {
    if (tempStrategy && editingDriver) {
      onStrategyChange(editingDriver, tempStrategy);
    }
    setEditingDriver(null);
    setTempStrategy(null);
  };

  const updateField = (key: keyof Strategy, value: string | number[] | Compound[] | undefined) => {
    setTempStrategy((prev) => prev ? { ...prev, [key]: value as any } : null);
  };

  if (!tempStrategy) {
    return (
      <div className="bg-black/20 border border-white/10 rounded-lg p-3">
        <h3 className="text-sm font-bold mb-2">Strategy Sandbox</h3>
        <div className="grid gap-2">
          {drivers.map((d) => (
            <button
              key={d}
              onClick={() => handleEdit(d)}
              className="w-full text-left px-3 py-2 bg-black/30 hover:bg-white/10 rounded text-sm"
            >
              <span className="font-mono">{d}</span>
              <span className="text-xs text-gray-400"> - Configure strategy</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 border border-white/20 rounded-lg p-4 z-50 overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">Custom Strategy: {editingDriver}</h3>
      <div className="space-y-3">
        <div>
          <label className="text-xs">Pit Laps</label>
          <input
            type="text"
            value={tempStrategy.pitLaps.join(", ") || ""}
            onChange={(e) => updateField("pitLaps", e.target.value.split(",").map((s) => parseInt(s.trim())).filter((s) => !isNaN(s)))}
            className="w-full bg-black/30 border border-white/20 rounded px-2 py-1 font-mono text-sm"
            placeholder="e.g. 10, 25"
          />
        </div>
        <div>
          <label className="text-xs">Target Compounds</label>
          <select
            value={tempStrategy.compounds[0] || ""}
            onChange={(e) => updateField("compounds", [e.target.value as Compound])}
            className="w-full bg-black/30 border border-white/20 rounded px-2 py-1"
          >
            <option value="">Select compound</option>
            {["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs">Description</label>
          <input
            type="text"
            value={tempStrategy.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full bg-black/30 border border-white/20 rounded px-2 py-1 text-sm"
            placeholder="Strategy name/description"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={handleSave} className="flex-1 px-3 py-2 bg-green-600/70 hover:bg-green-600 rounded">
          Save
        </button>
        <button onClick={() => { setEditingDriver(null); setTempStrategy(null); }} className="flex-1 px-3 py-2 bg-gray-600/70 hover:bg-gray-600 rounded">
          Cancel
        </button>
      </div>
    </div>
  );
}