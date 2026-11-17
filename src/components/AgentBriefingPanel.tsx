"use client";

import { AlertCircle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import type { AgentBriefing, Driver, LapSnapshot } from "@/types/f1";

const STATUS_BADGES: Record<string, string> = {
  "BOX THIS LAP": "bg-red-600/70 hover:bg-red-600",
  "EXTEND STINT": "bg-green-600/70 hover:bg-green-600",
  "COVER UNDERCUT": "bg-yellow-600/70 hover:bg-yellow-600",
  "WEATHER CROSSOVER": "bg-blue-600/70 hover:bg-blue-600",
  "NO ACTION": "bg-gray-600/70 hover:bg-gray-600",
};

interface AgentBriefingPanelProps {
  briefing: AgentBriefing | null;
  drivers: string[];
  snapshot: LapSnapshot;
}

export function AgentBriefingPanel({ briefing, drivers, snapshot }: AgentBriefingPanelProps) {
  if (!briefing) {
    return (
      <div className="bg-black/20 border border-white/10 rounded-lg p-3">
        <h3 className="text-sm font-bold mb-2">Pit-Wall Briefing</h3>
        <div className="text-center py-8 text-gray-400">
          Generating strategy analysis...
        </div>
      </div>
    );
  }

  const primaryCall = briefing.primaryCall;
  const badgeStyle = STATUS_BADGES[primaryCall] || STATUS_BADGES["NO ACTION"];

  return (
    <div className="bg-black/20 border border-white/10 rounded-lg p-3 space-y-3">
      <h3 className="text-sm font-bold mb-2">Pit-Wall Briefing</h3>

      {/* Primary Strategic Call */}
      <div className={`px-3 py-2 rounded font-bold text-sm text-center ${badgeStyle}`}>
        {primaryCall}
        {briefing.targetCompound && ` → ${briefing.targetCompound}`}
        <span className="block text-xs font-normal mt-1">
          Confidence: {briefing.confidence}% | Finish: P{briefing.predictedFinish}
        </span>
      </div>

      {/* Strategy Comparison Matrix */}
      <div className="bg-black/30 rounded overflow-hidden">
        <div className="text-xs font-bold px-2 py-1 border-b border-white/10">Strategy Comparison</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-2 py-1 text-left">Strategy</th>
              <th className="px-2 py-1 text-center">Fin</th>
              <th className="px-2 py-1 text-center">Pod%</th>
              <th className="px-2 py-1 text-center">Rejoin</th>
              <th className="px-2 py-1 text-center">Δ</th>
            </tr>
          </thead>
          <tbody>
            {briefing.strategyComparison.map((s, i) => (
              <tr key={s.strategyId} className="border-b border-white/5">
                <td className="px-2 py-1">{s.label}</td>
                <td className="px-2 py-1 text-center">P{s.predictedFinish}</td>
                <td className="px-2 py-1 text-center">{s.podiumPct.toFixed(0)}%</td>
                <td className="px-2 py-1 text-center">P{s.rejoinPos}</td>
                <td className={`px-2 py-1 text-center ${s.netDelta > 0 ? "text-red-400" : "text-green-400"}`}>
                  {s.netDelta > 0 ? "+" : ""}{s.netDelta.toFixed(1)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alerts */}
      {briefing.alerts.length > 0 && (
        <div className="bg-black/30 rounded p-2">
          <div className="text-xs font-bold mb-1 flex items-center gap-1">
            <AlertCircle size={12} />
            Alerts
          </div>
          <div className="space-y-1">
            {briefing.alerts.slice(0, 3).map((a, i) => (
              <div key={i} className="text-xs bg-white/5 p-1 rounded">
                <span className="text-yellow-400">L{a.lap}</span> {a.type}: {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      <div className="text-xs text-gray-400">
        <div className="font-bold mb-1">Analysis:</div>
        <ul className="space-y-1">
          {briefing.reasoning.map((r, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle size={10} className="text-green-400 mt-0.5" />
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs text-gray-500">
        Mode: <span className={briefing.mode === "LLM" ? "text-blue-400" : "text-orange-400"}>{briefing.mode}</span>
      </div>
    </div>
  );
}