import { Children, Fragment, type ReactNode } from 'react';
import { cx } from '../cx';
import s from './PillGroup.module.css';

export interface PillGroupProps {
  /** Wrap the group in a rounded card container (segmented look). */
  boxed?: boolean;
  /** Lay pills out as a centered, wrapping row. */
  wrap?: boolean;
  /** Node rendered between adjacent pills. */
  separator?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Container for `Pill`s, with optional separators and box framing. */
export function PillGroup({
  boxed = false,
  wrap = false,
  separator,
  className,
  children,
}: PillGroupProps) {
  const items = Children.toArray(children);
  return (
    <div className={cx(wrap ? s.wrap : s.group, boxed && s.boxed, className)}>
      {separator === undefined
        ? items
        : items.map((child, i) => (
            <Fragment key={i}>
              {child}
              {i < items.length - 1 && <span className={s.sep}>{separator}</span>}
            </Fragment>
          ))}
    </div>
  );
}
