import type { ReactNode } from 'react';
import { cx } from '../cx';
import s from './VectorsStrip.module.css';

export interface VectorsStripProps {
  /** Leading text, rendered in the muted base color. */
  lead: ReactNode;
  /** Trailing text, rendered in the accent color. */
  highlight: ReactNode;
  className?: string;
}

/** Footer strip with a lead phrase and an accent-colored highlight. */
export function VectorsStrip({ lead, highlight, className }: VectorsStripProps) {
  return (
    <div className={cx(s.strip, className)}>
      {lead} <span className={s.accent}>{highlight}</span>
    </div>
  );
}
