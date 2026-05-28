import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DIMENSIONS, ENGINES, type SynthesizeOutput } from '../types';

// Literal token hex values (Recharts sets SVG attributes, which do not resolve
// CSS var()). Kept in sync with packages/ui/src/styles/tokens.css.
const INK_SOFT = '#2c2f36';
const INK_MUTE = '#6b6e76';
const BORDER = '#e2dcd2';

/** Radar comparing the four engines across the six scored dimensions (0-100). */
export function EngineRadar({ byEngine }: { byEngine: SynthesizeOutput['by_engine'] }) {
  const present = ENGINES.filter((e) => byEngine[e.label]);
  const data = DIMENSIONS.map((d) => {
    const row: Record<string, number | string> = { dimension: d.label };
    for (const e of present) row[e.label] = byEngine[e.label].scores[d.key];
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={380}>
      <RadarChart data={data} outerRadius="68%">
        <PolarGrid stroke={BORDER} />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: INK_SOFT, fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: INK_MUTE, fontSize: 10 }} />
        {present.map((e) => (
          <Radar
            key={e.label}
            name={e.name}
            dataKey={e.label}
            stroke={e.color}
            fill={e.color}
            fillOpacity={0.1}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}
