import { DIMENSIONS, ENGINES, type SynthesizeOutput } from '../types';
import s from './ScoreBars.module.css';

/** Per-dimension grouped bars (0-100), one bar per engine. Pure CSS, no deps. */
export function ScoreBars({ byEngine }: { byEngine: SynthesizeOutput['by_engine'] }) {
  const present = ENGINES.filter((e) => byEngine[e.label]);

  return (
    <div className={s.wrap}>
      <div className={s.legend}>
        {present.map((e) => (
          <span key={e.label} className={s.legendItem}>
            <span className={s.swatch} style={{ background: e.color }} />
            {e.name}
          </span>
        ))}
      </div>

      {DIMENSIONS.map((d) => (
        <div className={s.row} key={d.key}>
          <div className={s.label}>{d.label}</div>
          <div className={s.bars}>
            {present.map((e) => {
              const v = byEngine[e.label].scores[d.key];
              return (
                <div className={s.barRow} key={e.label} title={`${e.name}: ${v}`}>
                  <div className={s.track}>
                    <div className={s.fill} style={{ width: `${v}%`, background: e.color }} />
                  </div>
                  <span className={s.val}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
