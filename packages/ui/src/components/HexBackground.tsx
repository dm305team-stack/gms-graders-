import { cx } from '../cx';
import s from './HexBackground.module.css';

export interface HexBackgroundProps {
  className?: string;
}

/** Fixed honeycomb pattern with a radial fade mask. Decorative. */
export function HexBackground({ className }: HexBackgroundProps) {
  return <div className={cx(s.hexBg, className)} aria-hidden="true" />;
}
