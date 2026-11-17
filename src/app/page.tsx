"use client";

import { useState, useEffect, useMemo } from "react";
import { PitWallHeader } from "@/components/PitWallHeader";
import { TimingTower } from "@/components/TimingTower";
import { PredictionCharts } from "@/components/PredictionCharts";
import { StrategySandbox } from "@/components/StrategySandbox";
import { AgentBriefingPanel } from "@/components/AgentBriefingPanel";
import type { LapSnapshot, AgentBriefing, Strategy } from "@/types/f1";

const DEFAULT_DRIVERS = ["LEC", "VER", "NOR"];

export default function Home() {
  const [snapshot, setSnapshot] = useState<LapSnapshot | null>(null);
  const [drivers, setDrivers] = useState<string[]>(DEFAULT_DRIVERS);
  const [briefing, setBriefing] = useState<AgentBriefing | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [currentLap, setCurrentLap] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState("silverstone");
  const [customStrategies, setCustomStrategies] = useState(() => new Map());
  const [initialError, setInitialError] = useState<string | null>(null);

  useEffect(() => {
    loadPreset(selectedPreset);
  }, [selectedPreset]);

  const activeSnapshot = useMemo<LapSnapshot | null>(() => {
    if (!snapshot) return null;
    const allLaps = snapshot.laps ?? [];
    const lapSlice = allLaps.find((l) => l.lap === currentLap);
    if (!lapSlice) return { ...snapshot, currentLap, lap: currentLap };
    return {
      ...snapshot,
      currentLap,
      lap: currentLap,
      drivers: lapSlice.drivers?.length ? lapSlice.drivers : snapshot.drivers,
      weather: lapSlice.weather ?? snapshot.weather,
      trackStatus: lapSlice.trackStatus ?? snapshot.trackStatus,
    };
  }, [snapshot, currentLap]);

  useEffect(() => {
    if (!activeSnapshot) return;
    let cancelled = false;

    fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverIds: drivers,
        snapshot: activeSnapshot,
        currentLap,
        circuit: selectedPreset,
        customStrategies: Object.fromEntries(customStrategies),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && !data.error) {
          setBriefing(data);
        }
      })
      .catch((err) => {
        console.error("Agent briefing failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSnapshot, drivers, currentLap, selectedPreset, customStrategies]);

  async function loadPreset(preset: string) {
    setIsLive(false);
    setInitialError(null);
    try {
      const res = await fetch(`/api/telemetry?preset=${encodeURIComponent(preset)}`);
      if (!res.ok) throw new Error(`Telemetry HTTP ${res.status}`);
      const data: LapSnapshot = await res.json();
      setSnapshot(data);
      const startLap = data.laps?.[0]?.lap ?? data.currentLap ?? 1;
      setCurrentLap(startLap);
    } catch (e) {
      console.error("Failed to load preset:", e);
      setInitialError("Unable to load race telemetry. Please refresh.");
    }
  }

  async function loadLiveSession(sessionKey: number) {
    setIsLive(true);
    try {
      const res = await fetch(`/api/telemetry?sessionKey=${sessionKey}`);
      if (!res.ok) throw new Error(`Live session HTTP ${res.status}`);
      const data: LapSnapshot = await res.json();
      setSnapshot(data);
      setCurrentLap(data.currentLap || 1);
    } catch (e) {
      console.error("Live fetch error:", e);
      setIsLive(false);
    }
  }

  function handleStrategyChange(driverId: string, strat: Strategy) {
    const newMap = new Map(customStrategies);
    newMap.set(driverId, strat);
    setCustomStrategies(newMap);
  }

  if (!activeSnapshot) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0A0C10] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">F1 Live Strategy Predictor</h1>
          <p className="text-gray-400">{initialError ?? "Loading pit-wall telemetry..."}</p>
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
        totalLaps={activeSnapshot.totalLaps}
        onLapChange={setCurrentLap}
      />
      <div className="flex-1 flex flex-row gap-4 p-4 overflow-hidden">
        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto">
          <TimingTower snapshot={activeSnapshot} drivers={drivers} />
        </div>
        <div className="w-1/2 flex flex-col gap-4 overflow-y-auto">
          <PredictionCharts
            snapshot={activeSnapshot}
            drivers={drivers}
            customStrategies={customStrategies}
            currentLap={currentLap}
          />
          <StrategySandbox
            drivers={drivers}
            onStrategyChange={handleStrategyChange}
            currentLap={currentLap}
            totalLaps={activeSnapshot.totalLaps}
            circuit={selectedPreset}
          />
        </div>
        <div className="w-1/4 flex flex-col gap-4 overflow-y-auto">
          <AgentBriefingPanel
            briefing={briefing}
            drivers={drivers}
            snapshot={activeSnapshot}
          />
        </div>
      </div>
    </div>
  );
}

