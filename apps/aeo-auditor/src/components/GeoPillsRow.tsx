import { Pill, PillGroup } from '@gms/ui';
import s from './GeoPillsRow.module.css';

export const GEO_OPTIONS = [
  'Florida Medical Practices',
  'Miami',
  'Orlando',
  'Tampa',
  'Jacksonville',
] as const;

export type Geo = (typeof GEO_OPTIONS)[number];

export interface GeoPillsRowProps {
  value: Geo;
  onChange: (geo: Geo) => void;
}

/** Florida-market toggle row. Selecting a geo drives the hero headline. */
export function GeoPillsRow({ value, onChange }: GeoPillsRowProps) {
  return (
    <div className={s.geoPills}>
      <PillGroup boxed separator="·">
        {GEO_OPTIONS.map((opt) => (
          <Pill
            key={opt}
            variant="ghost"
            active={value === opt}
            dotColor={value === opt ? 'var(--accent-pin)' : undefined}
            onClick={() => onChange(opt)}
          >
            {opt}
          </Pill>
        ))}
      </PillGroup>
    </div>
  );
}
