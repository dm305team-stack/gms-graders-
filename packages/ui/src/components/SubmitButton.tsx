import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';
import s from './SubmitButton.module.css';

export interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Disables the button and signals an in-flight submit. */
  loading?: boolean;
}

/** Solid accent submit button with a trailing arrow. */
export function SubmitButton({
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: SubmitButtonProps) {
  return (
    <button
      {...rest}
      type="submit"
      disabled={disabled || loading}
      className={cx(s.submitBtn, className)}
    >
      {children} <span className={s.arrow}>→</span>
    </button>
  );
}
