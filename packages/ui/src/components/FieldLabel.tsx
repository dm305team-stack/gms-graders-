import type { LabelHTMLAttributes } from 'react';
import { cx } from '../cx';
import s from './FieldLabel.module.css';

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Append a red required asterisk. */
  required?: boolean;
}

/** Uppercase field label with an optional required marker. */
export function FieldLabel({ required = false, className, children, ...rest }: FieldLabelProps) {
  return (
    <label className={cx(s.fieldLabel, className)} {...rest}>
      {children}
      {required && (
        <>
          {' '}
          <span className={s.req}>*</span>
        </>
      )}
    </label>
  );
}
