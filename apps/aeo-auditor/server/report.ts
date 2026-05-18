/**
 * Report rendering for the AEO grader.
 *
 * Produces a multi-page, print-paginated HTML document that server/pdf.ts
 * renders to PDF. Structure follows the HubSpot AEO Grader reference but uses
 * the GMS warm-paper design system (@gms/ui tokens), 4 engines instead of 3,
 * direct copy, and a GMS retainer CTA. All copy is American English.
 *
 * Data source: the SynthesizeOutput the @gms/llm pipeline already produces.
 * No engine changes; sections render from existing synthesis fields.
 */

import type { EngineReport, SynthesizeOutput } from '@gms/llm';
import type { Analysis, EngineLabel } from './types.js';

/** Above this overall score, a brand meets industry AI-visibility standards. */
const INDUSTRY_BENCHMARK = 75;

const ENGINE_ORDER: EngineLabel[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];

const ENGINE_NAMES: Record<EngineLabel, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
};

const ENGINE_MODELS: Record<EngineLabel, string> = {
  chatgpt: 'GPT-5.2',
  perplexity: 'Sonar Pro',
  gemini: 'Gemini 3 Pro',
  claude: 'Claude Sonnet 4.6',
};

const GRADE_LABELS: Record<string, string> = {
  needs_work: 'Needs work',
  developing: 'Developing',
  on_track: 'On track',
  leading: 'Leading',
};

const POSITION_LABELS: Record<string, string> = {
  leader: 'Market leader',
  challenger: 'Challenger',
  niche_player: 'Niche player',
};

const TRAJECTORY_LABELS: Record<string, string> = {
  negative: 'Declining',
  stable: 'Stable',
  positive: 'Positive',
  accelerating: 'Accelerating',
};

/** Donut palette: brand-adjacent neutrals for competitor segments. */
const DONUT_COLORS = ['#1f3a5f', '#b04a26', '#6e7fb5', '#5a3a3a', '#9a8c74', '#c9c1b3'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape untrusted text (LLM output) before interpolating into HTML. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cap(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Functional status color for a score, by ratio to its max. */
function scoreColor(value: number, max: number): string {
  const ratio = max > 0 ? value / max : 0;
  if (ratio < 0.4) return '#b04a26';
  if (ratio < 0.7) return '#e25a1f';
  return '#3f7a4f';
}

function averageScore(synthesis: SynthesizeOutput): number {
  const values = ENGINE_ORDER.map((e) => synthesis.by_engine[e]?.scores.overall).filter(
    (v): v is number => typeof v === 'number',
  );
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** {chatgpt, perplexity, gemini, claude} overall scores, for the status payload. */
export function extractOverallScores(synthesis: SynthesizeOutput): Record<EngineLabel, number> {
  return {
    chatgpt: Math.round(synthesis.by_engine.chatgpt?.scores.overall ?? 0),
    perplexity: Math.round(synthesis.by_engine.perplexity?.scores.overall ?? 0),
    gemini: Math.round(synthesis.by_engine.gemini?.scores.overall ?? 0),
    claude: Math.round(synthesis.by_engine.claude?.scores.overall ?? 0),
  };
}

/** Circular progress gauge, 0 to 100. */
function gauge(score: number, size = 108): string {
  const clamped = Math.max(0, Math.min(100, score));
  const stroke = 9;
  const r = size / 2 - stroke;
  const circ = 2 * Math.PI * r;
  const arc = (clamped / 100) * circ;
  const color = scoreColor(clamped, 100);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e8e2d8" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}"
      stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${arc.toFixed(1)} ${circ.toFixed(1)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dy="0.36em"
      font-family="Fraunces,Georgia,serif" font-size="${(size * 0.32).toFixed(0)}"
      font-weight="600" fill="#1f3a5f">${Math.round(clamped)}</text>
  </svg>`;
}

/** Horizontal score bar. */
function bar(value: number, max: number): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return `<span class="bar"><span class="bar-fill" style="width:${pct.toFixed(0)}%;background:${scoreColor(value, max)}"></span></span>`;
}

/** SVG donut from segments [{label, pct, color}]. */
function donut(segments: Array<{ pct: number; color: string }>, size = 132): string {
  const stroke = 16;
  const r = size / 2 - stroke / 2 - 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const rings = segments
    .map((seg) => {
      const len = (Math.max(0, seg.pct) / 100) * circ;
      const ring = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${seg.color}" stroke-width="${stroke}"
        stroke-dasharray="${len.toFixed(1)} ${(circ - len).toFixed(1)}"
        stroke-dashoffset="${(-offset).toFixed(1)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
      offset += len;
      return ring;
    })
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}</svg>`;
}

/** Build competitor donut segments for one engine, padded with "Other". */
function competitorSegments(report: EngineReport | undefined) {
  const top = (report?.competitors_top ?? []).slice(0, 5);
  const segments = top.map((c, i) => ({
    label: c.name,
    pct: Math.max(0, Math.round(c.share_pct)),
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));
  const sum = segments.reduce((a, b) => a + b.pct, 0);
  if (sum < 100) {
    segments.push({ label: 'Other', pct: 100 - sum, color: '#e2dcd2' });
  }
  return segments;
}

function listItems(items: string[]): string {
  if (!items?.length) return '<li class="muted">None reported.</li>';
  return items.map((it) => `<li>${esc(it)}</li>`).join('');
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function coverSection(analysis: Analysis, synthesis: SynthesizeOutput, avg: number): string {
  const { input } = analysis;
  const grade = GRADE_LABELS[synthesis.summary.overall_grade] ?? synthesis.summary.overall_grade;
  const date = new Date(analysis.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const meets = avg >= INDUSTRY_BENCHMARK;

  return `<section class="section cover">
    <div class="cover-band">
      <div class="kicker">Growth Marketing Studios</div>
      <div class="cover-product">AEO Visibility Audit</div>
    </div>

    <div class="cover-body">
      <h1>${esc(input.brand)}</h1>
      <p class="cover-scope">
        Across 4 AI engines, for ${esc(input.specialty.replace(/_/g, ' '))} in ${esc(input.location)}.
        <br><span class="cover-domain">${esc(input.domain)}</span>
      </p>

      <div class="benchmark">
        Scores above ${INDUSTRY_BENCHMARK}/100 meet industry visibility standards.
      </div>

      <div class="cover-score">
        ${gauge(avg, 168)}
        <div class="cover-score-meta">
          <div class="cover-score-num">${avg}<span>/100</span></div>
          <div class="cover-grade" style="color:${scoreColor(avg, 100)}">${esc(grade)}</div>
          <div class="cover-verdict">
            ${
              meets
                ? `${esc(input.brand)} meets the industry visibility standard across the engines tested.`
                : `${esc(input.brand)} sits ${INDUSTRY_BENCHMARK - avg} points below the ${INDUSTRY_BENCHMARK}/100 industry standard.`
            }
          </div>
        </div>
      </div>

      <p class="cover-position">${esc(synthesis.summary.competitive_position)}</p>
    </div>

    <div class="cover-foot">Audit ${esc(analysis.analysis_id)} &nbsp;&middot;&nbsp; ${esc(date)}</div>
  </section>`;
}

function scorecardSection(synthesis: SynthesizeOutput): string {
  const components: Array<{ label: string; key: keyof EngineReport['scores']; max: number }> = [
    { label: 'Brand recognition', key: 'brand_recognition', max: 20 },
    { label: 'Market position', key: 'market_position', max: 10 },
    { label: 'Presence quality', key: 'presence_quality', max: 20 },
    { label: 'Brand perception', key: 'brand_perception', max: 40 },
    { label: 'Share of voice', key: 'share_of_voice', max: 10 },
  ];

  const headers = ENGINE_ORDER.map(
    (e) => `<div class="sc-engine">
      <div class="sc-engine-name">${ENGINE_NAMES[e]}</div>
      <div class="sc-engine-model">${ENGINE_MODELS[e]}</div>
    </div>`,
  ).join('');

  const gaugeRow = ENGINE_ORDER.map((e) => {
    const r = synthesis.by_engine[e];
    return `<div class="sc-cell sc-gauge">${r ? gauge(r.scores.overall, 96) : '<span class="muted">n/a</span>'}</div>`;
  }).join('');

  const componentRows = components
    .map((c) => {
      const cells = ENGINE_ORDER.map((e) => {
        const r = synthesis.by_engine[e];
        if (!r) return '<div class="sc-cell"><span class="muted">n/a</span></div>';
        const value = r.scores[c.key];
        return `<div class="sc-cell">
          <div class="sc-val">${Math.round(value)}<span>/${c.max}</span></div>
          ${bar(value, c.max)}
        </div>`;
      }).join('');
      return `<div class="sc-rowlabel">${c.label}</div>${cells}`;
    })
    .join('');

  return `<section class="section">
    ${sectionHead('AI Visibility Scorecard', 'Each engine rates your brand from 0 to 100, built from five weighted components. Compare where you stand, engine by engine.')}
    <div class="scorecard">
      <div class="sc-rowlabel sc-corner"></div>
      ${headers}
      <div class="sc-rowlabel">AI visibility score</div>
      ${gaugeRow}
      ${componentRows}
    </div>
  </section>`;
}

function recognitionSection(synthesis: SynthesizeOutput): string {
  const cards = ENGINE_ORDER.map((e) => {
    const r = synthesis.by_engine[e];
    if (!r) return engineCardEmpty(e);
    return `<div class="ecard">
      <div class="ecard-name">${ENGINE_NAMES[e]}</div>
      <div class="ecard-score" style="color:${scoreColor(r.scores.brand_recognition, 20)}">
        ${Math.round(r.scores.brand_recognition)}<span>/20</span>
      </div>
      ${bar(r.scores.brand_recognition, 20)}
      <dl class="ecard-dl">
        <dt>Market position</dt><dd>${esc(POSITION_LABELS[r.market_position_label] ?? r.market_position_label)}</dd>
        <dt>Brand archetype</dt><dd>${esc(cap(r.archetype))}</dd>
        <dt>Engine confidence</dt><dd>${Math.round(r.confidence_pct)}%</dd>
      </dl>
    </div>`;
  }).join('');

  return `<section class="section">
    ${sectionHead('Brand Recognition', 'How often the engines name your brand, and how sure they are when they do. Low recognition means the engine recommends a competitor in your place.')}
    <div class="ecards">${cards}</div>
  </section>`;
}

function competitionSection(synthesis: SynthesizeOutput): string {
  const cards = ENGINE_ORDER.map((e) => {
    const r = synthesis.by_engine[e];
    if (!r) return engineCardEmpty(e);
    const segments = competitorSegments(r);
    const legend = segments
      .map(
        (seg) => `<li><span class="dot" style="background:${seg.color}"></span>
          <span class="leg-name">${esc(seg.label)}</span>
          <span class="leg-pct">${seg.pct}%</span></li>`,
      )
      .join('');
    return `<div class="ecard">
      <div class="ecard-name">${ENGINE_NAMES[e]}</div>
      <div class="ecard-score" style="color:${scoreColor(r.scores.share_of_voice, 10)}">
        ${Math.round(r.scores.share_of_voice)}<span>/10</span>
      </div>
      <div class="ecard-sub">share of voice</div>
      <div class="donut-wrap">${donut(segments)}</div>
      <ul class="legend">${legend}</ul>
    </div>`;
  }).join('');

  return `<section class="section">
    ${sectionHead('Market Competition', 'Your share of voice. Of every sector answer that names a provider, this is the slice that names you instead of a competitor.')}
    <div class="ecards">${cards}</div>
  </section>`;
}

function summarySection(synthesis: SynthesizeOutput): string {
  const { summary } = synthesis;
  const trajectory = TRAJECTORY_LABELS[summary.trajectory] ?? summary.trajectory;
  return `<section class="section">
    ${sectionHead('Analysis Summary', 'What is working, and what to fix first.')}
    <div class="summary-trajectory">
      <span>Market trajectory</span>
      <strong>${esc(trajectory)}</strong>
    </div>
    <div class="two-col">
      <div class="panel">
        <h3>Key strengths</h3>
        <ul class="marked">${listItems(summary.key_strengths)}</ul>
      </div>
      <div class="panel">
        <h3>Growth areas</h3>
        <ul class="marked">${listItems(summary.growth_areas)}</ul>
      </div>
    </div>
    <div class="position-box">
      <strong>Competitive position.</strong> ${esc(summary.competitive_position)}
    </div>
  </section>`;
}

function contextualSection(synthesis: SynthesizeOutput): string {
  const themes = synthesis.summary.narrative_themes ?? [];
  const chips = themes.length
    ? themes.map((t) => `<span class="theme-chip">${esc(t)}</span>`).join('')
    : '<span class="muted">No recurring themes detected.</span>';
  return `<section class="section">
    ${sectionHead('Contextual Analysis', 'The themes AI engines attach to your brand when they describe you. These are the words shaping a patient’s first impression.')}
    <div class="themes">${chips}</div>
  </section>`;
}

function perceptionSection(synthesis: SynthesizeOutput): string {
  const cards = ENGINE_ORDER.map((e) => {
    const r = synthesis.by_engine[e];
    if (!r) return engineCardEmpty(e);
    const sources = (r.sources_evaluation ?? []).slice(0, 4);
    const sourceList = sources.length
      ? sources
          .map(
            (src) => `<li>
              <div class="src-head">
                <span class="src-name">${esc(src.name)}</span>
                <span class="src-score" style="color:${scoreColor(src.score, 100)}">${Math.round(src.score)}</span>
              </div>
              <div class="src-note">${esc(src.note)}</div>
            </li>`,
          )
          .join('')
      : '<li class="muted">No sources evaluated.</li>';
    return `<div class="ecard">
      <div class="ecard-name">${ENGINE_NAMES[e]}</div>
      <div class="ecard-score" style="color:${scoreColor(r.scores.brand_perception, 40)}">
        ${Math.round(r.scores.brand_perception)}<span>/40</span>
      </div>
      <div class="ecard-sub">brand perception</div>
      <ul class="src-list">${sourceList}</ul>
    </div>`;
  }).join('');

  return `<section class="section">
    ${sectionHead('Perception Analysis', 'The sentiment in AI answers about your brand, and the sources that shape it. Perception carries the most weight in the overall score.')}
    <div class="ecards">${cards}</div>
  </section>`;
}

function methodologySection(analysis: Analysis): string {
  const stats = analysis.stats;
  return `<section class="section">
    ${sectionHead('Methodology', 'How this audit was produced.')}
    <ul class="method-list">
      <li><strong>Queries.</strong> We generated ${stats?.queries ?? 0} patient-style search queries that never name your brand, then ran each one against all 4 engines.</li>
      <li><strong>Engines.</strong> ChatGPT (GPT-5.2), Perplexity (Sonar Pro), Gemini (Gemini 3 Pro), and Claude (Claude Sonnet 4.6). HubSpot's grader tests 3. We test 4, because Claude carries real weight in professional and B2B search.</li>
      <li><strong>Scoring.</strong> Each engine answer is parsed for brand mentions, position, sentiment, competitors, and cited sources. Scores roll up into the five components on the scorecard.</li>
      <li><strong>Limits.</strong> This is a diagnostic snapshot, not a guarantee of placement. Engine answers vary between runs.</li>
    </ul>

    <div class="cta">
      <div class="cta-kicker">Next step</div>
      <h2>This audit shows the gap. Closing it is the work.</h2>
      <p>AI engines now sit between your practice and the patients searching for you.
         The fixes that move these scores are structured data, authority sourcing,
         review velocity, and content the engines actually cite. That is what a GMS
         AEO retainer executes. Book a 20-minute walkthrough of these findings with a
         GMS specialist.</p>
      <div class="cta-mark">Growth Marketing Studios<span class="dot-accent"></span></div>
    </div>
  </section>`;
}

function sectionHead(title: string, intro: string): string {
  return `<header class="sec-head">
    <h2>${esc(title)}</h2>
    <p>${esc(intro)}</p>
  </header>`;
}

function engineCardEmpty(engine: EngineLabel): string {
  return `<div class="ecard ecard-empty">
    <div class="ecard-name">${ENGINE_NAMES[engine]}</div>
    <p class="muted">No usable signal from this engine in this run.</p>
  </div>`;
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

/** Full multi-page HTML report, print-paginated for PDF rendering. */
export function renderReportHtml(analysis: Analysis, synthesis: SynthesizeOutput): string {
  const avg = averageScore(synthesis);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AEO Visibility Audit — ${esc(analysis.input.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#f6f3ee; --card:#fff; --muted-bg:#efeae2;
    --ink:#0e1116; --ink-soft:#2c2f36; --ink-mute:#6b6e76;
    --border:#e2dcd2; --navy:#1f3a5f; --rust:#b04a26; --orange:#e25a1f;
    --grad:linear-gradient(90deg,#1f3a5f 0%,#5a3a3a 50%,#e25a1f 100%);
  }
  @page { margin: 0; }
  * { box-sizing:border-box; margin:0; padding:0;
      -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { background:var(--bg); }
  body { font-family:'DM Sans',sans-serif; color:var(--ink);
         font-size:13.5px; line-height:1.55; }
  h1,h2 { font-family:'Fraunces',Georgia,serif; font-weight:600; }
  .muted { color:var(--ink-mute); }

  .section { width:100%; min-height:11in; padding:0.62in 0.66in; background:var(--bg);
             position:relative; }
  .section + .section { break-before:page; }

  /* ---- bars / shared ---- */
  .bar { display:block; height:7px; border-radius:4px; background:#e8e2d8; overflow:hidden; }
  .bar-fill { display:block; height:100%; }

  .sec-head { margin-bottom:26px; }
  .sec-head h2 { font-size:27px; }
  .sec-head p { color:var(--ink-mute); margin-top:7px; max-width:64ch; }

  /* ---- cover ---- */
  .cover { padding:0; display:flex; flex-direction:column; }
  .cover-band { background:var(--navy); color:#f6f3ee; padding:30px 0.66in 26px; }
  .kicker { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.18em;
            text-transform:uppercase; opacity:.72; }
  .cover-product { font-family:'Fraunces',serif; font-size:23px; font-weight:600; margin-top:6px; }
  .cover-body { padding:48px 0.66in 0; flex:1; }
  .cover-body h1 { font-size:44px; line-height:1.08; letter-spacing:-0.01em; }
  .cover-scope { color:var(--ink-soft); margin-top:14px; font-size:16px; }
  .cover-domain { font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--ink-mute); }
  .benchmark { margin-top:26px; padding:13px 18px; border-radius:8px;
               background:var(--navy); color:#f6f3ee; font-weight:500; font-size:14px;
               display:inline-block; }
  .cover-score { display:flex; align-items:center; gap:30px; margin-top:34px;
                 padding:28px 32px; background:var(--card); border:1px solid var(--border);
                 border-radius:14px; }
  .cover-score-num { font-family:'Fraunces',serif; font-size:46px; font-weight:600; color:var(--navy); }
  .cover-score-num span { font-size:19px; color:var(--ink-mute); }
  .cover-grade { font-family:'JetBrains Mono',monospace; font-size:14px; font-weight:600;
                 text-transform:uppercase; letter-spacing:.05em; margin-top:2px; }
  .cover-verdict { margin-top:10px; color:var(--ink-soft); max-width:42ch; }
  .cover-position { margin-top:30px; padding:22px 26px; background:var(--navy);
                    color:#f1ede6; border-radius:12px; font-size:15px; line-height:1.6; }
  .cover-foot { padding:22px 0.66in; font-family:'JetBrains Mono',monospace;
                font-size:11px; color:var(--ink-mute); letter-spacing:.04em; }

  /* ---- scorecard ---- */
  .scorecard { display:grid; grid-template-columns:1.15fr repeat(4,1fr);
               border:1px solid var(--border); border-radius:12px; overflow:hidden;
               background:var(--card); }
  .sc-rowlabel { padding:13px 16px; font-size:12px; font-weight:500; color:var(--ink-soft);
                 background:var(--muted-bg); border-bottom:1px solid var(--border);
                 display:flex; align-items:center; }
  .sc-corner { background:var(--navy); }
  .sc-engine { padding:13px 12px; text-align:center; border-bottom:1px solid var(--border);
               border-left:1px solid var(--border); background:var(--navy); color:#f6f3ee; }
  .sc-engine-name { font-family:'Fraunces',serif; font-size:17px; font-weight:600; }
  .sc-engine-model { font-family:'JetBrains Mono',monospace; font-size:9.5px;
                     opacity:.7; margin-top:2px; }
  .sc-cell { padding:13px 14px; border-bottom:1px solid var(--border);
             border-left:1px solid var(--border); }
  .sc-gauge { display:flex; justify-content:center; padding:14px; }
  .sc-val { font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:600;
            margin-bottom:6px; }
  .sc-val span { color:var(--ink-mute); font-size:11px; }
  .scorecard > div:nth-last-child(-n+5) { border-bottom:none; }

  /* ---- engine cards (recognition / competition / perception) ---- */
  .ecards { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  .ecard { background:var(--card); border:1px solid var(--border); border-radius:12px;
           padding:18px 16px; }
  .ecard-empty { opacity:.65; }
  .ecard-name { font-family:'Fraunces',serif; font-size:17px; font-weight:600; }
  .ecard-score { font-family:'Fraunces',serif; font-size:33px; font-weight:600; margin-top:8px; }
  .ecard-score span { font-size:14px; color:var(--ink-mute); }
  .ecard-sub { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:.08em;
               text-transform:uppercase; color:var(--ink-mute); margin-bottom:10px; }
  .ecard-dl { margin-top:14px; }
  .ecard-dl dt { font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:.07em;
                 text-transform:uppercase; color:var(--ink-mute); margin-top:11px; }
  .ecard-dl dd { font-size:13.5px; font-weight:500; margin-top:2px; }

  .donut-wrap { display:flex; justify-content:center; margin:8px 0 12px; }
  .legend { list-style:none; }
  .legend li { display:flex; align-items:center; gap:6px; font-size:11px; margin-bottom:4px; }
  .dot { width:8px; height:8px; border-radius:2px; flex:none; }
  .leg-name { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .leg-pct { font-family:'JetBrains Mono',monospace; color:var(--ink-mute); }

  .src-list { list-style:none; margin-top:6px; }
  .src-list li { padding:9px 0; border-bottom:1px solid var(--border); }
  .src-list li:last-child { border-bottom:none; }
  .src-head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .src-name { font-weight:600; font-size:12.5px; }
  .src-score { font-family:'JetBrains Mono',monospace; font-weight:600; font-size:14px; }
  .src-note { font-size:11.5px; color:var(--ink-mute); margin-top:3px; }

  /* ---- summary ---- */
  .summary-trajectory { display:flex; align-items:center; gap:14px; margin-bottom:20px;
                        padding:14px 20px; background:var(--card); border:1px solid var(--border);
                        border-radius:10px; }
  .summary-trajectory span { font-family:'JetBrains Mono',monospace; font-size:10px;
                             letter-spacing:.1em; text-transform:uppercase; color:var(--ink-mute); }
  .summary-trajectory strong { font-family:'Fraunces',serif; font-size:20px; font-weight:600;
                               color:var(--navy); }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  .panel { background:var(--card); border:1px solid var(--border); border-radius:12px;
           padding:22px 24px; }
  .panel h3 { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.08em;
              text-transform:uppercase; margin-bottom:12px; color:var(--ink-soft); }
  .marked { list-style:none; }
  .marked li { padding:9px 0 9px 20px; position:relative; border-bottom:1px solid var(--border); }
  .marked li:last-child { border-bottom:none; }
  .marked li::before { content:""; position:absolute; left:0; top:15px; width:8px; height:8px;
                       border-radius:2px; background:var(--orange); }
  .position-box { margin-top:18px; padding:20px 24px; background:var(--navy); color:#f1ede6;
                  border-radius:12px; line-height:1.6; }

  /* ---- contextual ---- */
  .themes { display:flex; flex-wrap:wrap; gap:10px; }
  .theme-chip { background:var(--card); border:1px solid var(--border); border-radius:8px;
                padding:11px 16px; font-size:14px; font-weight:500; }

  /* ---- methodology + cta ---- */
  .method-list { list-style:none; }
  .method-list li { padding:12px 0 12px 18px; position:relative; border-bottom:1px solid var(--border);
                    font-size:13.5px; color:var(--ink-soft); }
  .method-list li::before { content:""; position:absolute; left:0; top:18px; width:7px; height:7px;
                            border-radius:2px; background:var(--navy); }
  .method-list strong { color:var(--ink); }
  .cta { margin-top:30px; padding:32px 34px; background:var(--grad); color:#fff;
         border-radius:14px; }
  .cta-kicker { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.16em;
                text-transform:uppercase; opacity:.85; }
  .cta h2 { font-size:25px; margin:8px 0 10px; color:#fff; }
  .cta p { font-size:14px; line-height:1.65; opacity:.95; max-width:62ch; }
  .cta-mark { margin-top:20px; font-family:'Fraunces',serif; font-size:17px; font-weight:600; }
  .dot-accent { display:inline-block; width:7px; height:7px; border-radius:50%;
                background:#fff; margin-left:3px; vertical-align:middle; }
</style>
</head>
<body>
  ${coverSection(analysis, synthesis, avg)}
  ${scorecardSection(synthesis)}
  ${recognitionSection(synthesis)}
  ${competitionSection(synthesis)}
  ${summarySection(synthesis)}
  ${contextualSection(synthesis)}
  ${perceptionSection(synthesis)}
  ${methodologySection(analysis)}
</body>
</html>`;
}

/** Compact branded HTML used as the email body. American English. */
export function renderEmailHtml(analysis: Analysis, synthesis: SynthesizeOutput): string {
  const { input } = analysis;
  const avg = averageScore(synthesis);
  const grade = GRADE_LABELS[synthesis.summary.overall_grade] ?? synthesis.summary.overall_grade;
  const scores = extractOverallScores(synthesis);
  const meets = avg >= INDUSTRY_BENCHMARK;

  const scoreRow = ENGINE_ORDER.map(
    (e) => `<td style="padding:8px 12px;text-align:center;border:1px solid #e2dcd2;">
      <div style="font-family:monospace;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#6b6e76;">${ENGINE_NAMES[e]}</div>
      <div style="font-size:22px;font-weight:700;color:${scoreColor(scores[e], 100)};">${scores[e]}</div>
    </td>`,
  ).join('');

  return `<div style="font-family:'DM Sans',Arial,sans-serif;color:#0e1116;max-width:560px;margin:0 auto;">
  <div style="height:4px;background:linear-gradient(90deg,#1f3a5f,#5a3a3a,#e25a1f);"></div>
  <div style="padding:28px 28px 8px;">
    <div style="font-family:monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b04a26;">
      Growth Marketing Studios &nbsp;&middot;&nbsp; AEO Visibility Audit
    </div>
    <h1 style="font-size:24px;margin:10px 0 6px;">Your audit for ${esc(input.brand)} is ready</h1>
    <p style="color:#6b6e76;font-size:14px;margin:0 0 20px;">
      Hi ${esc(input.contact.name)}, here is how the 4 major AI engines describe
      ${esc(input.brand)} (${esc(input.domain)}).
    </p>
    <div style="text-align:center;padding:18px;background:#efeae2;border-radius:10px;margin-bottom:14px;">
      <div style="font-size:44px;font-weight:700;color:#1f3a5f;line-height:1;">${avg}<span style="font-size:16px;color:#6b6e76;">/100</span></div>
      <div style="font-family:monospace;font-size:12px;margin-top:4px;">Overall grade: ${esc(grade)}</div>
    </div>
    <p style="font-size:13px;color:#6b6e76;margin:0 0 16px;text-align:center;">
      Scores above 75/100 meet industry visibility standards.
      ${meets ? `${esc(input.brand)} clears that bar.` : `${esc(input.brand)} is ${75 - avg} points short.`}
    </p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;"><tr>${scoreRow}</tr></table>
    <p style="font-size:14px;line-height:1.6;">
      The full 8-section report is attached as a PDF: per-engine scorecard,
      competitor share of voice, perception analysis, and the growth areas to
      fix first. The next step is a 20-minute call with a GMS specialist.
    </p>
    <p style="font-size:12px;color:#6b6e76;margin-top:24px;border-top:1px solid #e2dcd2;padding-top:14px;">
      Audit ${esc(analysis.analysis_id)} &nbsp;&middot;&nbsp; Growth Marketing Studios
    </p>
  </div>
</div>`;
}
