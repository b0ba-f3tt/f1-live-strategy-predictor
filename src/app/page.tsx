"use client";

import { useState, useEffect } from "react";
import { PitWallHeader } from "@/components/PitWallHeader";
import { TimingTower } from "@/components/TimingTower";
import { PredictionCharts } from "@/components/PredictionCharts";
import { StrategySandbox } from "@/components/StrategySandbox";
import { AgentBriefingPanel } from "@/components/AgentBriefingPanel";
import type { LapSnapshot, AgentBriefing, Driver, Compound, Strategy } from "@/types/f1";

const PRESETS = ["silverstone", "monza", "singapore"] as const;

const DEFAULT_DRIVERS = ["LEC", "VER", "NOR"];

const DEFAULT_STRATEGIES: Strategy[] = [
  { id: "stay", label: "Stay Out", pitLaps: [], compounds: [], description: "No stops" },
  { id: "box", label: "Box This Lap", pitLaps: [1, 2, 3, 4, 5], compounds: ["MEDIUM"], description: "Early stop onto medium" },
  { id: "undercut", label: "Undercut", pitLaps: [1, 2, 3, 4, 5], compounds: ["SOFT"], description: "Soft undercut" },
  { id: "two-stop", label: "Two-Stop Attack", pitLaps: [3, 15], compounds: ["HARD", "MEDIUM"], description: "Aggressive two-stop" },
];

export default function Home() {
  const [snapshot, setSnapshot] = useState<LapSnapshot | null>(null);
  const [drivers, setDrivers] = useState<string[]>(DEFAULT_DRIVERS);
  const [briefing, setBriefing] = useState<AgentBriefing | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [currentLap, setCurrentLap] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState("silverstone");
  const [customStrategies, setCustomStrategies] = useState<Map<string, Strategy>>(new Map());
  const [loading, setLoading] = useState(true);

  // Load preset on mount
  useEffect(() => {
    loadPreset(selectedPreset);
  }, [selectedPreset]);

  // Fetch data and generate briefing
  useEffect(() => {
    if (!snapshot) return;
    setLoading(true);
    fetch(`/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverIds: drivers,
        snapshot,
        currentLap,
        circuit: selectedPreset,
      }),
    })
      .then((r) => r.json())
      .then(setBriefing)
      .finally(() => setLoading(false));
  }, [snapshot, drivers, currentLap, selectedPreset]);

  async function loadPreset(preset: string) {
    try {
      const res = await fetch(`/api/presets/${preset}`);
      const data = await res.json();
      setSnapshot(data);
      setCurrentLap(1);
    } catch (e) {
      console.error("Failed to load preset:", e);
    }
  }

  async function loadLiveSession(sessionKey: number) {
    setIsLive(true);
    try {
      const res = await fetch(`/api/telemetry?sessionKey=${sessionKey}`);
      const data = await res.json();
      setSnapshot(data);
    } catch (e) {
      setIsLive(false);
    }
  }

  function handleStrategyChange(driverId: string, strat: Strategy) {
    const newMap = new Map(customStrategies);
    newMap.set(driverId, strat);
    setCustomStrategies(newMap);
  }

  if (loading || !snapshot) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">F1 Live Strategy Predictor</h1>
          <p className="text-muted-foreground">Loading race data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0A0C10] text-white overflow-hidden">
      <PitWallHeader
        preset={selectedPreset}
        onPresetChange={setSelectedPreset}
        drivers={drivers}
        onDriversChange={setDrivers}
        onLiveFetch={loadLiveSession}
        isLive={isLive}
        currentLap={currentLap}
        totalLaps={snapshot.totalLaps}
        onLapChange={setCurrentLap}
      />
      <div className="flex-1 flex flex-row gap-4 p-4 overflow-hidden">
        <div className="w-1/3 flex flex-col gap-4">
          <TimingTower snapshot={snapshot} drivers={drivers} />
        </div>
        <div className="w-1/2 flex flex-col gap-4">
          <PredictionCharts
            snapshot={snapshot}
            drivers={drivers}
            customStrategies={customStrategies}
            currentLap={currentLap}
          />
          <StrategySandbox
            drivers={drivers}
            onStrategyChange={handleStrategyChange}
            currentLap={currentLap}
            totalLaps={snapshot.totalLaps}
            circuit={selectedPreset}
          />
        </div>
        <div className="w-1/4 flex flex-col gap-4">
          <AgentBriefingPanel
            briefing={briefing}
            drivers={drivers}
            snapshot={snapshot}
          />
        </div>
      </div>
    </div>
  );
}