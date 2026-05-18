import type { InputHTMLAttributes } from 'react';
import { cx } from '../cx';
import s from './TextInput.module.css';

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

/** Styled text input. Accepts any native input type. */
export function TextInput({ className, ...rest }: TextInputProps) {
  return <input className={cx(s.input, className)} {...rest} />;
}
