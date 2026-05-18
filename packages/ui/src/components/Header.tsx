import type { ReactNode } from 'react';
import { cx } from '../cx';
import s from './Header.module.css';

export interface HeaderNavItem {
  label: string;
  href: string;
}

export interface HeaderCta {
  label: string;
  href: string;
}

export interface HeaderProps {
  /** The brand tile, typically a <BrandMark>. */
  mark: ReactNode;
  brandName: string;
  productName: string;
  navItems?: HeaderNavItem[];
  cta?: HeaderCta;
  className?: string;
}

/** Page header shell: brand cluster, optional nav, optional CTA pill. */
export function Header({
  mark,
  brandName,
  productName,
  navItems = [],
  cta,
  className,
}: HeaderProps) {
  return (
    <header className={cx(s.header, className)}>
      <div className={s.brand}>
        {mark}
        <div className={s.brandMeta}>
          <div className={s.brandName}>{brandName}</div>
          <div className={s.brandProduct}>{productName}</div>
        </div>
      </div>

      {navItems.length > 0 && (
        <nav className={s.nav}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {cta && (
        <a href={cta.href} className={s.ctaPill}>
          {cta.label} <span className={s.arrow}>→</span>
        </a>
      )}
    </header>
  );
}
