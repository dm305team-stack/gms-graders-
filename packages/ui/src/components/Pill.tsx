import type { HTMLAttributes } from 'react';
import { cx } from '../cx';
import s from './Pill.module.css';

export type PillVariant = 'outline' | 'ghost';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  active?: boolean;
  /** When set, renders a leading dot of this CSS color. */
  dotColor?: string;
}

/** Chip primitive. `outline` is a bordered chip, `ghost` is a label toggle. */
export function Pill({
  variant = 'outline',
  active = false,
  dotColor,
  className,
  children,
  ...rest
}: PillProps) {
  return (
    <span className={cx(s.pill, s[variant], active && s.active, className)} {...rest}>
      {dotColor !== undefined && (
        <span className={s.dot} style={{ background: dotColor }} />
      )}
      {children}
    </span>
  );
}
