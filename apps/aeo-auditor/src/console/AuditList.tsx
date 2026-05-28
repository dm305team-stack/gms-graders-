import { useEffect, useState } from 'react';
import { cx } from '@gms/ui';
import { ENGINES, type AuditListItem } from './types';
import s from './AuditList.module.css';

/** Status dot colors, drawn from the GMS accent palette. */
const STATUS_COLOR: Record<string, string> = {
  done: '#3f7d52',
  failed: '#b04a26',
};
function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? '#e25a1f'; // in-progress stages -> orange
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtCost(cost: number | null): string {
  if (cost === null) return '—';
  return cost === 0 ? 'mock' : `$${cost.toFixed(3)}`;
}

export function AuditList({ onOpen }: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<AuditListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/analyses');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
        if (alive) setItems(data.analyses ?? []);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className={cx(s.panel, s.panelError)}>
        <div className={s.panelTitle}>Could not load audits</div>
        <div className={s.panelText}>{error}</div>
        <div className={s.panelText}>Is the API running on :3334? Try `pnpm dev:all`.</div>
      </div>
    );
  }

  if (items === null) {
    return <div className={s.panel}>Loading audits…</div>;
  }

  return (
    <section>
      <header className={s.head}>
        <h1 className={s.title}>Audits</h1>
        <div className={s.count}>{items.length} on record</div>
      </header>

      {items.length === 0 ? (
        <div className={s.panel}>
          No audits yet. Run one from the landing page or via the API, then refresh.
        </div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Brand</th>
                <th>Domain</th>
                <th>Overall by engine</th>
                <th>Cost</th>
                <th>Created</th>
                <th className={s.actionsCol}>Report</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const fileOnly = it.source === 'file';
                return (
                  <tr
                    key={it.analysis_id}
                    className={cx(s.row, fileOnly && s.rowMuted, it.has_charts && s.rowClickable)}
                    onClick={it.has_charts ? () => onOpen(it.analysis_id) : undefined}
                  >
                    <td>
                      <span className={s.status}>
                        <span className={s.dot} style={{ background: statusColor(it.status) }} />
                        {it.stage_label}
                      </span>
                    </td>
                    <td>
                      <div className={s.brand}>{it.brand}</div>
                      <div className={s.id}>{it.analysis_id}</div>
                    </td>
                    <td className={s.domain}>{it.domain || '—'}</td>
                    <td>
                      {it.overall_scores ? (
                        <div className={s.scoreChips}>
                          {ENGINES.filter((e) => it.overall_scores?.[e.label] != null).map((e) => (
                            <span
                              key={e.label}
                              className={s.scoreChip}
                              style={{ borderColor: e.color, color: e.color }}
                              title={e.name}
                            >
                              {e.name[0]}
                              <b>{it.overall_scores?.[e.label]}</b>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={s.muted}>—</span>
                      )}
                    </td>
                    <td className={s.cost}>{fmtCost(it.cost_usd)}</td>
                    <td className={s.created}>{fmtDate(it.created_at)}</td>
                    <td className={s.actions} onClick={(e) => e.stopPropagation()}>
                      {it.report_url && (
                        <a href={it.report_url} target="_blank" rel="noreferrer">
                          HTML
                        </a>
                      )}
                      {it.pdf_url && (
                        <a href={it.pdf_url} target="_blank" rel="noreferrer">
                          PDF
                        </a>
                      )}
                      {it.has_charts && (
                        <button type="button" className={s.openBtn} onClick={() => onOpen(it.analysis_id)}>
                          Open →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
