import { cx } from '../cx';
import s from './TopRule.module.css';

export interface TopRuleProps {
  className?: string;
}

/** Thin accent strip pinned to the top edge of the page. */
export function TopRule({ className }: TopRuleProps) {
  return <div className={cx(s.topRule, className)} aria-hidden="true" />;
}
