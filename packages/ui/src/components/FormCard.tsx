import type { HTMLAttributes } from 'react';
import { cx } from '../cx';
import s from './FormCard.module.css';

export type FormCardProps = HTMLAttributes<HTMLDivElement>;

/** Elevated card surface that holds a form. Wrap a <form> as its child. */
export function FormCard({ className, children, ...rest }: FormCardProps) {
  return (
    <div className={cx(s.card, className)} {...rest}>
      {children}
    </div>
  );
}
