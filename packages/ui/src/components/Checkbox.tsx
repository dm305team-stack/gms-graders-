import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import s from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Label content rendered next to the box. */
  label: ReactNode;
  /** Required: ties the label to the input. */
  id: string;
}

/** Checkbox with an inline label, laid out horizontally. */
export function Checkbox({ label, id, className, ...rest }: CheckboxProps) {
  return (
    <div className={cx(s.checkboxRow, className)}>
      <input type="checkbox" id={id} {...rest} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
