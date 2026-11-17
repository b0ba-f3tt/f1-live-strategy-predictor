"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import type { LapSnapshot, Strategy, SimulationResult } from "@/types/f1";

const CHART_COLORS = ["#00C49C", "#FF6B6B", "#6BCB77", "#4D96FF", "#FFD93D"];

interface PredictionChartsProps {
  snapshot: LapSnapshot;
  drivers: string[];
  customStrategies?: Map<string, Strategy>;
  currentLap: number;
}

export function PredictionCharts({ snapshot, drivers, customStrategies, currentLap }: PredictionChartsProps) {
  const lapData = (snapshot.laps ?? [])
    .filter((snap) => snap.lap !== undefined && snap.lap <= currentLap + 5)
    .map((snap) => {
      const entry: { lap: number } & Record<string, number> = { lap: snap.lap! };
      for (const d of drivers) {
        const driver = snap.drivers.find((x) => x.driverId === d);
        if (driver) entry[d] = driver.gapToLeader;
      }
      return entry;
    });

  // Simulated future positions
  const futureLaps = Array.from({ length: Math.max(10, snapshot.totalLaps - currentLap) }, (_, i) => currentLap + i + 1);
  const simulationData = futureLaps.map((lap) => {
    const entry: { lap: number } & Record<string, number> = { lap };
    for (const d of drivers) {
      // Simulated gap - in real app would come from API
      const baseGap = lapData[lapData.length - 1]?.[d] ?? 0;
      const drift = (lap - currentLap) * 0.15; // simple drift model
      entry[d] = baseGap + drift + Math.sin(lap * 0.1) * 0.5;
    }
    return entry;
  });

  const chartData = [...lapData, ...simulationData];

  return (
    <div className="bg-black/20 border border-white/10 rounded-lg p-3">
      <h3 className="text-sm font-bold mb-2">Position & Gap Trajectory</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis dataKey="lap" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => `${v.toFixed(2)}s`} />
          <Legend />
          {drivers.map((d, i) => (
            <Line
              key={d}
              type="monotone"
              dataKey={d}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}