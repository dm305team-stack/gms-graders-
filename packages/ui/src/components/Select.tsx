import type { SelectHTMLAttributes } from 'react';
import { cx } from '../cx';
import s from './Select.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Styled select control. */
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={cx(s.select, className)} {...rest}>
      {children}
    </select>
  );
}
