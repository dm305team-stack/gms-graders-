import { useEffect, useState } from 'react';
import { cx } from '@gms/ui';
import { EngineRadar } from './charts/EngineRadar';
import { ScoreBars } from './charts/ScoreBars';
import { ShareBars } from './charts/ShareBars';
import { ENGINES, type AuditDetail as AuditDetailData } from './types';
import s from './AuditDetail.module.css';

const GRADE_LABEL: Record<string, string> = {
  needs_work: 'Needs work',
  developing: 'Developing',
  on_track: 'On track',
  leading: 'Leading',
};
const GRADE_COLOR: Record<string, string> = {
  needs_work: '#b04a26',
  developing: '#e25a1f',
  on_track: '#1f3a5f',
  leading: '#3f7d52',
};

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function AuditDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<AuditDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/analyses/${id}/data`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Server returned ${res.status}`);
        if (alive) setData(body as AuditDetailData);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) {
    return (
      <div>
        <BackLink onBack={onBack} />
        <div className={cx(s.panel, s.panelError)}>{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <BackLink onBack={onBack} />
        <div className={s.panel}>Loading audit…</div>
      </div>
    );
  }

  const syn = data.synthesis;

  return (
    <div>
      <BackLink onBack={onBack} />

      <header className={s.head}>
        <div>
          <h1 className={s.title}>{data.input.brand}</h1>
          <div className={s.sub}>
            <span className={s.domain}>{data.input.domain}</span>
            {data.input.location && <span> · {data.input.location}</span>}
            {data.input.specialty && <span> · {data.input.specialty}</span>}
          </div>
          <div className={s.id}>{data.analysis_id}</div>
        </div>
        <div className={s.headActions}>
          {data.report_url && (
            <a href={data.report_url} target="_blank" rel="noreferrer" className={s.linkBtn}>
              Open HTML
            </a>
          )}
          {data.pdf_url && (
            <a href={data.pdf_url} target="_blank" rel="noreferrer" className={s.linkBtn}>
              Open PDF
            </a>
          )}
        </div>
      </header>

      <div className={s.metaRow}>
        <Meta label="Status" value={data.stage_label} />
        <Meta label="Created" value={fmtDate(data.created_at)} />
        <Meta label="Finished" value={fmtDate(data.finished_at)} />
        <Meta label="Cost" value={data.cost_usd === null ? '—' : data.cost_usd === 0 ? 'mock' : `$${data.cost_usd.toFixed(3)}`} />
        {data.stats && (
          <Meta
            label="Engine calls"
            value={`${data.stats.engine_calls} (${data.stats.engine_errors} failed)`}
          />
        )}
      </div>

      {data.error && <div className={cx(s.panel, s.panelError)}>{data.error}</div>}

      {!syn ? (
        <div className={s.panel}>
          No structured data for this audit (legacy report or failed run). Use the report links
          above to open it.
        </div>
      ) : (
        <>
          <section className={s.card}>
            <div className={s.summaryTop}>
              <span
                className={s.gradeBadge}
                style={{ background: GRADE_COLOR[syn.summary.overall_grade] ?? '#6b6e76' }}
              >
                {GRADE_LABEL[syn.summary.overall_grade] ?? syn.summary.overall_grade}
              </span>
              <span className={s.traj}>Trajectory: {titleCase(syn.summary.trajectory)}</span>
            </div>
            <p className={s.position}>{syn.summary.competitive_position}</p>
            <div className={s.lists}>
              <NarrativeList title="Key strengths" items={syn.summary.key_strengths} tone="good" />
              <NarrativeList title="Growth areas" items={syn.summary.growth_areas} tone="warn" />
              <NarrativeList title="Narrative themes" items={syn.summary.narrative_themes} />
            </div>
          </section>

          <section className={s.card}>
            <h2 className={s.sectionTitle}>Engine comparison</h2>
            <EngineRadar byEngine={syn.by_engine} />
          </section>

          <section className={s.card}>
            <h2 className={s.sectionTitle}>Scores by dimension</h2>
            <ScoreBars byEngine={syn.by_engine} />
          </section>

          <section className={s.card}>
            <h2 className={s.sectionTitle}>Competitor share of voice</h2>
            <ShareBars byEngine={syn.by_engine} />
          </section>

          <section>
            <h2 className={s.sectionTitle}>By engine</h2>
            <div className={s.engineGrid}>
              {ENGINES.filter((e) => syn.by_engine[e.label]).map((e) => {
                const r = syn.by_engine[e.label];
                return (
                  <div className={s.engineCard} key={e.label}>
                    <div className={s.engineHead}>
                      <span className={s.engineName} style={{ color: e.color }}>
                        {e.name}
                      </span>
                      <span className={s.engineOverall}>{r.scores.overall}</span>
                    </div>
                    <div className={s.engineTags}>
                      <span>{titleCase(r.market_position_label)}</span>
                      <span>{titleCase(r.archetype)}</span>
                      <span>{r.confidence_pct}% confidence</span>
                      <span>{titleCase(r.trajectory)}</span>
                    </div>
                    <NarrativeList title="Strengths" items={r.key_strengths} tone="good" small />
                    <NarrativeList title="Growth areas" items={r.growth_areas} tone="warn" small />
                    {r.sources_evaluation?.length > 0 && (
                      <div className={s.sources}>
                        <div className={s.sourcesTitle}>Sources</div>
                        {r.sources_evaluation.map((src) => (
                          <div className={s.sourceRow} key={src.name}>
                            <span className={s.sourceName} title={src.note}>
                              {src.name}
                            </span>
                            <span className={s.sourceType}>{titleCase(src.type)}</span>
                            <span className={s.sourceScore}>{src.score}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className={s.back} onClick={onBack}>
      ← All audits
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.meta}>
      <div className={s.metaLabel}>{label}</div>
      <div className={s.metaValue}>{value}</div>
    </div>
  );
}

function NarrativeList({
  title,
  items,
  tone,
  small,
}: {
  title: string;
  items: string[];
  tone?: 'good' | 'warn';
  small?: boolean;
}) {
  if (!items?.length) return null;
  return (
    <div className={cx(s.narrative, small && s.narrativeSmall)}>
      <div className={s.narrativeTitle}>{title}</div>
      <ul className={s.narrativeList}>
        {items.map((it, i) => (
          <li
            key={i}
            className={cx(tone === 'good' && s.bulletGood, tone === 'warn' && s.bulletWarn)}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
