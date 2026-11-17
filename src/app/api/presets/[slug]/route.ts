import type { LapSnapshot } from "@/types/f1";
import silverstonePreset from "@/data/presets/2024_silverstone_r.json";
import monzaPreset from "@/data/presets/2024_monza_r.json";
import singaporePreset from "@/data/presets/2023_singapore_r.json";

const PRESETS: Record<string, LapSnapshot> = {
  silverstone: silverstonePreset as unknown as LapSnapshot,
  "2024_silverstone_r": silverstonePreset as unknown as LapSnapshot,
  monza: monzaPreset as unknown as LapSnapshot,
  "2024_monza_r": monzaPreset as unknown as LapSnapshot,
  singapore: singaporePreset as unknown as LapSnapshot,
  "2023_singapore_r": singaporePreset as unknown as LapSnapshot,
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const key = decodeURIComponent(slug || "silverstone").toLowerCase();
  const data = PRESETS[key] ?? PRESETS.silverstone;
  return Response.json(data);
}
