import { ENGINES, type SynthesizeOutput } from '../types';
import s from './ShareBars.module.css';

/** Competitor share of voice per engine (share_pct). Pure CSS, no deps. */
export function ShareBars({ byEngine }: { byEngine: SynthesizeOutput['by_engine'] }) {
  const present = ENGINES.filter((e) => byEngine[e.label]);

  return (
    <div className={s.grid}>
      {present.map((e) => {
        const competitors = byEngine[e.label].competitors_top ?? [];
        return (
          <div className={s.col} key={e.label}>
            <div className={s.head} style={{ color: e.color }}>
              {e.name}
            </div>
            {competitors.length === 0 ? (
              <div className={s.empty}>No competitors surfaced</div>
            ) : (
              competitors.map((c) => (
                <div className={s.row} key={c.name}>
                  <div className={s.name} title={c.name}>
                    {c.name}
                  </div>
                  <div className={s.track}>
                    <div
                      className={s.fill}
                      style={{ width: `${Math.min(c.share_pct, 100)}%`, background: e.color }}
                    />
                  </div>
                  <div className={s.pct}>{c.share_pct}%</div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
