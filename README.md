# F1 Live Strategy Predictor

A Vercel-deployable web application for real-time F1 race telemetry and Monte Carlo race outcome prediction.

## Features

- **Real-time Race Telemetry**: Live timing data from OpenF1 API with fallback to pre-cached race datasets
- **Physics-Informed Race Simulator**: Monte Carlo simulation with fuel burn, tire degradation, and pit stop modeling
- **Multi-Lap Replay**: Interactive lap-by-lap simulation with Play/Pause controls
- **Strategy Comparison**: Compare multiple pit strategies (Stay Out, Undercut, Two-Stop, etc.)
- **Agentic Pit-Wall Strategist**: AI-powered or deterministic strategy recommendations
- **What-If Sandbox**: Customize pit laps and compounds to test strategy outcomes

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS**
- **Recharts** for visualization
- **Lucide React** for icons

## Development

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000

## Testing

```bash
# Unit tests
npm test

# TypeScript check
npx tsc --noEmit

# Production build
npm run build
```

## Deployment

```bash
npx vercel --prod
```

## Pre-cached Race Datasets

The app includes bundled race telemetry for:
- 2024 British Grand Prix (Silverstone - wet-dry conditions)
- 2024 Italian Grand Prix (Monza - Leclerc 1-stop vs McLaren 2-stop)
- 2023 Singapore Grand Prix (Sainz DRS defense scenario)

## API Routes

- `GET /api/telemetry` - OpenF1 data or fallback preset
- `POST /api/predict` - Monte Carlo race prediction
- `POST /api/agent` - Strategy briefing generation
- `GET /api/presets/[slug]` - Bundled race data