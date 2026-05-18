/**
 * Report rendering for the AEO grader.
 *
 * Phase 1 renders the synthesis JSON into a self-contained, GMS-branded HTML
 * document (warm-paper tokens from @gms/ui). Phase 2 swaps this for a real
 * PDF generator; the HTML here is structured so that swap is mechanical.
 */

import type { EngineReport, SynthesizeOutput } from '@gms/llm';
import type { Analysis, EngineLabel } from './types.js';

const ENGINE_ORDER: EngineLabel[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];

const ENGINE_NAMES: Record<EngineLabel, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
};

const GRADE_LABELS: Record<string, string> = {
  needs_work: 'Needs work',
  developing: 'Developing',
  on_track: 'On track',
  leading: 'Leading',
};

/** Escape untrusted text (LLM output) before interpolating into HTML. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Average overall score across the engines that returned a report. */
function averageScore(synthesis: SynthesizeOutput): number {
  const values = ENGINE_ORDER.map((e) => synthesis.by_engine[e]?.scores.overall).filter(
    (v): v is number => typeof v === 'number',
  );
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Pull {chatgpt, perplexity, gemini, claude} overall scores for the status payload. */
export function extractOverallScores(synthesis: SynthesizeOutput): Record<EngineLabel, number> {
  return {
    chatgpt: Math.round(synthesis.by_engine.chatgpt?.scores.overall ?? 0),
    perplexity: Math.round(synthesis.by_engine.perplexity?.scores.overall ?? 0),
    gemini: Math.round(synthesis.by_engine.gemini?.scores.overall ?? 0),
    claude: Math.round(synthesis.by_engine.claude?.scores.overall ?? 0),
  };
}

function listItems(items: string[]): string {
  if (!items?.length) return '<li class="muted">None reported.</li>';
  return items.map((it) => `<li>${esc(it)}</li>`).join('');
}

function engineCard(label: EngineLabel, report: EngineReport | undefined): string {
  if (!report) {
    return `<div class="engine-card engine-card--empty">
      <div class="engine-name">${ENGINE_NAMES[label]}</div>
      <p class="muted">No usable signal from this engine in this run.</p>
    </div>`;
  }
  const s = report.scores;
  return `<div class="engine-card">
    <div class="engine-head">
      <div class="engine-name">${ENGINE_NAMES[label]}</div>
      <div class="engine-score">${Math.round(s.overall)}<span>/100</span></div>
    </div>
    <div class="engine-meta">
      ${esc(report.market_position_label)} &middot; ${esc(report.archetype)} &middot;
      ${Math.round(report.confidence_pct)}% confidence
    </div>
    <div class="score-bars">
      ${scoreBar('Brand recognition', s.brand_recognition, 20)}
      ${scoreBar('Market position', s.market_position, 10)}
      ${scoreBar('Presence quality', s.presence_quality, 20)}
      ${scoreBar('Brand perception', s.brand_perception, 40)}
      ${scoreBar('Share of voice', s.share_of_voice, 10)}
    </div>
    ${
      report.competitors_top?.length
        ? `<div class="competitors"><span class="label">Top competitors seen</span>
            ${report.competitors_top
              .map((c) => `<span class="chip">${esc(c.name)} ${Math.round(c.share_pct)}%</span>`)
              .join('')}
          </div>`
        : ''
    }
  </div>`;
}

function scoreBar(name: string, value: number, max: number): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<div class="bar-row">
    <span class="bar-name">${esc(name)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(0)}%"></span></span>
    <span class="bar-val">${Math.round(value)}/${max}</span>
  </div>`;
}

/** Full standalone HTML report. */
export function renderReportHtml(analysis: Analysis, synthesis: SynthesizeOutput): string {
  const { input } = analysis;
  const avg = averageScore(synthesis);
  const grade = GRADE_LABELS[synthesis.summary.overall_grade] ?? synthesis.summary.overall_grade;
  const date = new Date(analysis.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AEO Visibility Audit — ${esc(input.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#f6f3ee; --bg-card:#fff; --bg-muted:#efeae2;
    --ink:#0e1116; --ink-soft:#2c2f36; --ink-mute:#6b6e76;
    --border:#e2dcd2; --accent-blue:#1f3a5f; --accent-orange:#e25a1f; --accent-rust:#b04a26;
    --grad:linear-gradient(90deg,#1f3a5f 0%,#5a3a3a 50%,#e25a1f 100%);
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--ink); font-family:'DM Sans',system-ui,sans-serif; line-height:1.55; }
  .page { max-width:880px; margin:0 auto; padding:48px 32px 80px; }
  .topbar { height:4px; background:var(--grad); border-radius:2px; margin-bottom:32px; }
  .eyebrow { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.14em;
    text-transform:uppercase; color:var(--accent-rust); margin-bottom:10px; }
  h1 { font-family:'Fraunces',Georgia,serif; font-weight:600; font-size:34px; line-height:1.15; }
  h2 { font-family:'Fraunces',Georgia,serif; font-weight:600; font-size:22px; margin:40px 0 16px; }
  .sub { color:var(--ink-mute); margin-top:8px; font-size:14px; }
  .meta-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px 28px;
    margin-top:24px; padding:20px 24px; background:var(--bg-card); border:1px solid var(--border);
    border-radius:12px; font-size:14px; }
  .meta-grid div span { font-family:'JetBrains Mono',monospace; font-size:10px;
    letter-spacing:.1em; text-transform:uppercase; color:var(--ink-mute); display:block; margin-bottom:2px; }
  .headline { display:flex; gap:24px; align-items:center; margin-top:28px;
    padding:24px 28px; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; }
  .headline .big { font-family:'Fraunces',serif; font-size:54px; font-weight:600; line-height:1;
    color:var(--accent-blue); }
  .headline .big span { font-size:22px; color:var(--ink-mute); }
  .grade { font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:600;
    padding:6px 12px; border-radius:999px; background:var(--bg-muted); display:inline-block; }
  .engines { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
  .engine-card { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:20px; }
  .engine-card--empty { opacity:.7; }
  .engine-head { display:flex; justify-content:space-between; align-items:baseline; }
  .engine-name { font-family:'Fraunces',serif; font-size:19px; font-weight:600; }
  .engine-score { font-family:'Fraunces',serif; font-size:28px; font-weight:600; color:var(--accent-orange); }
  .engine-score span { font-size:13px; color:var(--ink-mute); }
  .engine-meta { font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:.04em;
    text-transform:capitalize; color:var(--ink-mute); margin:6px 0 14px; }
  .bar-row { display:grid; grid-template-columns:108px 1fr 44px; gap:8px; align-items:center;
    font-size:11.5px; margin-bottom:6px; }
  .bar-name { color:var(--ink-soft); }
  .bar-track { height:7px; background:var(--bg-muted); border-radius:4px; overflow:hidden; }
  .bar-fill { display:block; height:100%; background:var(--grad); }
  .bar-val { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--ink-mute); text-align:right; }
  .competitors { margin-top:14px; padding-top:12px; border-top:1px solid var(--border); }
  .competitors .label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.1em;
    text-transform:uppercase; color:var(--ink-mute); display:block; margin-bottom:6px; }
  .chip { display:inline-block; font-size:11px; padding:3px 9px; margin:0 4px 4px 0;
    background:var(--bg-muted); border-radius:999px; }
  .cols { display:grid; grid-template-columns:repeat(2,1fr); gap:24px; }
  .panel { background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:22px 24px; }
  .panel h3 { font-size:14px; font-family:'JetBrains Mono',monospace; letter-spacing:.06em;
    text-transform:uppercase; margin-bottom:12px; }
  .panel ul { list-style:none; }
  .panel li { padding:7px 0 7px 18px; position:relative; font-size:14px; border-bottom:1px solid var(--border); }
  .panel li:last-child { border-bottom:none; }
  .panel li::before { content:''; position:absolute; left:0; top:14px; width:7px; height:7px;
    border-radius:2px; background:var(--accent-orange); }
  .muted { color:var(--ink-mute); }
  .position { margin-top:16px; padding:20px 24px; background:var(--accent-blue); color:#f6f3ee;
    border-radius:12px; font-size:15px; }
  .themes { margin-top:14px; }
  .themes .chip { background:var(--bg-card); border:1px solid var(--border); }
  .cta { margin-top:40px; padding:28px 32px; background:var(--grad); color:#fff; border-radius:14px; }
  .cta h2 { color:#fff; margin:0 0 8px; }
  .cta p { font-size:14px; opacity:.92; }
  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--border);
    font-size:11.5px; color:var(--ink-mute); }
  @media (max-width:640px) {
    .engines,.cols,.meta-grid { grid-template-columns:1fr; }
    .headline { flex-direction:column; align-items:flex-start; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="topbar"></div>
  <div class="eyebrow">Growth Marketing Studios · AEO Visibility Audit</div>
  <h1>How AI engines describe ${esc(input.brand)}</h1>
  <p class="sub">A diagnostic of brand visibility across ChatGPT, Perplexity, Gemini, and Claude.</p>

  <div class="meta-grid">
    <div><span>Domain</span>${esc(input.domain)}</div>
    <div><span>Service area</span>${esc(input.location)}</div>
    <div><span>Specialty</span>${esc(input.specialty)}</div>
    <div><span>Report date</span>${esc(date)}</div>
    <div><span>Analysis ID</span>${esc(analysis.analysis_id)}</div>
    <div><span>Queries evaluated</span>${analysis.stats?.queries ?? 0} across 4 engines</div>
  </div>

  <div class="headline">
    <div class="big">${avg}<span>/100</span></div>
    <div>
      <div class="grade">Overall grade: ${esc(grade)}</div>
      <p class="sub">${esc(synthesis.summary.competitive_position)}</p>
    </div>
  </div>

  <h2>Per-engine breakdown</h2>
  <div class="engines">
    ${ENGINE_ORDER.map((e) => engineCard(e, synthesis.by_engine[e])).join('')}
  </div>

  <h2>What this means</h2>
  <div class="cols">
    <div class="panel">
      <h3>Key strengths</h3>
      <ul>${listItems(synthesis.summary.key_strengths)}</ul>
    </div>
    <div class="panel">
      <h3>Growth areas</h3>
      <ul>${listItems(synthesis.summary.growth_areas)}</ul>
    </div>
  </div>

  <div class="position">
    <strong>Competitive position.</strong> ${esc(synthesis.summary.competitive_position)}
  </div>

  ${
    synthesis.summary.narrative_themes?.length
      ? `<div class="themes">${synthesis.summary.narrative_themes
          .map((t) => `<span class="chip">${esc(t)}</span>`)
          .join('')}</div>`
      : ''
  }

  <div class="cta">
    <h2>This audit shows the gap. Closing it is the work.</h2>
    <p>AI engines now sit between your practice and the patients searching for it.
       The fixes that move these scores (structured data, authority sourcing,
       review velocity, content that the engines actually cite) are exactly what
       a GMS AEO retainer executes. Book a 20-minute walkthrough of these findings.</p>
  </div>

  <footer>
    Growth Marketing Studios · AEO Visibility Auditor · ${esc(input.location)}<br>
    This is an automated diagnostic, not a guarantee of search placement. Generated ${esc(date)}.
  </footer>
</div>
</body>
</html>`;
}

/** Compact branded HTML used as the email body. */
export function renderEmailHtml(analysis: Analysis, synthesis: SynthesizeOutput): string {
  const { input } = analysis;
  const avg = averageScore(synthesis);
  const grade = GRADE_LABELS[synthesis.summary.overall_grade] ?? synthesis.summary.overall_grade;
  const scores = extractOverallScores(synthesis);

  const scoreRow = ENGINE_ORDER.map(
    (e) => `<td style="padding:8px 14px;text-align:center;border:1px solid #e2dcd2;">
      <div style="font-family:monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6b6e76;">${ENGINE_NAMES[e]}</div>
      <div style="font-size:22px;font-weight:700;color:#e25a1f;">${scores[e]}</div>
    </td>`,
  ).join('');

  return `<div style="font-family:'DM Sans',Arial,sans-serif;color:#0e1116;max-width:560px;margin:0 auto;">
  <div style="height:4px;background:linear-gradient(90deg,#1f3a5f,#5a3a3a,#e25a1f);"></div>
  <div style="padding:28px 28px 8px;">
    <div style="font-family:monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b04a26;">
      Growth Marketing Studios · AEO Visibility Audit
    </div>
    <h1 style="font-size:24px;margin:10px 0 6px;">Your audit for ${esc(input.brand)} is ready</h1>
    <p style="color:#6b6e76;font-size:14px;margin:0 0 20px;">
      Hi ${esc(input.contact.name)}, here is how the 4 major AI engines describe
      ${esc(input.brand)} (${esc(input.domain)}).
    </p>
    <div style="text-align:center;padding:18px;background:#efeae2;border-radius:10px;margin-bottom:18px;">
      <div style="font-size:44px;font-weight:700;color:#1f3a5f;line-height:1;">${avg}<span style="font-size:16px;color:#6b6e76;">/100</span></div>
      <div style="font-family:monospace;font-size:12px;margin-top:4px;">Overall grade: ${esc(grade)}</div>
    </div>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;"><tr>${scoreRow}</tr></table>
    <p style="font-size:14px;line-height:1.6;">
      The full per-engine breakdown, competitor share of voice, and the specific
      growth areas are in the attached report. The next step is a 20-minute call
      with a GMS specialist to walk through what moves these numbers.
    </p>
    <p style="font-size:12px;color:#6b6e76;margin-top:24px;border-top:1px solid #e2dcd2;padding-top:14px;">
      Analysis ID: ${esc(analysis.analysis_id)} · Growth Marketing Studios
    </p>
  </div>
</div>`;
}
