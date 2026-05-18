import type { ReactNode } from 'react';
import { cx } from '../cx';
import s from './BrandMark.module.css';

export interface BrandMarkProps {
  /** The logo glyph, typically an inline SVG. */
  children: ReactNode;
  className?: string;
}

/** The square logo tile. Receives the logo glyph as a slot. */
export function BrandMark({ children, className }: BrandMarkProps) {
  return <div className={cx(s.brandMark, className)}>{children}</div>;
}
