/**
 * Brief renderer — produces the AEO Deep Audit Brief HTML/PDF.
 *
 * Visual + structural source of truth: server/templates/brief-master.html.
 * That file is read once at module load only to extract its <style> block
 * (CSS + base64 GMS logo) verbatim. The brief's HTML is then generated
 * programmatically per audit, populated from analysis.synthesis (frozen
 * SYNTHESIZE_REPORT_PROMPT_V1 output) and analysis.input.
 *
 * Engine count is dynamic: only engines marked active by ENABLE_PERPLEXITY
 * appear in scorecard, per-engine, and competitive sections. The master spec
 * assumes 4 engines; with Perplexity opted-out the layout adapts to 3.
 *
 * Footnotes: every [research: module §anchor] tag found in narrative strings
 * is numbered in order of first appearance, replaced inline by <sup>N</sup>,
 * and emitted as a bibliography on page 10. Tags map to canonical citations
 * when known; otherwise the module path is shown verbatim.
 *
 * No LLM contract is modified. Fields the JSON does not provide
 * (6 recommendations, multi-paragraph verdict prose, scorecard/competitive
 * context paragraphs) fall back to score-band templates or canonical content.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EngineReport, SynthesizeOutput } from '@gms/llm';
import type { Analysis, EngineLabel } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MASTER_PATH = path.resolve(__dirname, 'templates/brief-master.html');

/** Extract the master spec's <style> block once. Contains the base64 logo. */
const STYLE_BLOCK: string = (() => {
  const html = fs.readFileSync(MASTER_PATH, 'utf8');
  const m = html.match(/<style>([\s\S]*?)<\/style>/i);
  if (!m) throw new Error('brief-master.html: <style> block not found');
  return `<style>${m[1]}</style>`;
})();

/**
 * Phase 2 print overrides — fix orphan pages, equalize margins, and apply
 * orphan/widow control for PDF rendering. Appended after STYLE_BLOCK so the
 * cascade resolves to these rules. The master spec at brief-master.html stays
 * untouched.
 *
 * Design model preserved: each .page section equals one physical page via
 * min-height: 11in + internal padding + absolute-positioned .page-footer.
 * @page margins stay at 0 — section padding does the visual margin work.
 */
const PRINT_OVERRIDES = `<style>
  /* Root cause of the 17-page render: the master uses .page { min-height:11in }
     with @page { size: letter; margin: 0 }, but Chromium routinely renders the
     section's box slightly taller than 11in (sub-pixel font metrics + the
     summed margins of internal blocks). Any overshoot, even by a few pixels,
     pushes each section into a second physical page (with the absolute-
     positioned footer alone, producing the orphan-footer symptom).

     Fix: clamp .page to exactly 11in with overflow:hidden so each section
     occupies exactly one physical page. Combined with the content tightening
     below this prevents both overflow AND visible clipping. */
  .page:not(.cover) {
    height: 11in;
    min-height: 11in;
    max-height: 11in;
    overflow: hidden;
    padding: 0.6in 0.75in 0.65in 0.75in;
  }
  .cover { height: 11in; min-height: 11in; max-height: 11in; overflow: hidden; }
  .page-footer { left: 0.75in; right: 0.75in; bottom: 0.3in; }

  /* Cover: trim the oversized vertical padding so content fits in 11in. */
  .cover-top { padding: 0.55in 0.75in 0; }
  .cover-body { padding: 0.85in 0.75in 0; }
  .cover-title { font-size: 56px; line-height: 1.05; }
  .cover-scope { margin-top: 22px; font-size: 16px; }
  .cover-verdict { margin-top: 56px; padding: 26px 0; }
  .cover-score-num { font-size: 124px; line-height: 0.85; }
  .cover-tagline { margin-top: 44px; font-size: 14px; }
  .cover-foot { padding: 20px 0.75in 0.45in; }

  /* Section header: trim oversized h2 and lede margins. */
  .sec-head { margin-bottom: 22px; }
  .sec-head h2 { font-size: 36px; }
  .sec-head .sec-lede { margin-top: 10px; font-size: 14.5px; }
  .sec-divider { margin: 24px 0; }

  /* Keep section headers attached to the content that follows them, so a
     page never ends with an orphaned "01 / EXECUTIVE VERDICT" header. */
  .sec-head, h1, h2, h3, h4 {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* Don't let small content blocks split mid-element across page boundaries. */
  .e-card,
  .method-card,
  .rec-item,
  .fn-item,
  .theme-row,
  .score-table tr,
  .comp-table tr,
  .cover-verdict,
  .ns-contact-block,
  .ns-mark,
  .inference-box {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Orphans/widows: never strand 1-2 lines of a paragraph or list item on a
     page boundary. Three-line minimum on both sides of a break. */
  p, li, dd,
  .verdict-prose p,
  .scorecard-context,
  .ns-body,
  .mc-body,
  .rec-desc,
  .fn-body {
    orphans: 3;
    widows: 3;
  }

  /* Verdict prose: tighten paragraph spacing. */
  .verdict-lede { font-size: 28px; line-height: 1.22; margin-bottom: 28px; }
  .verdict-prose p { font-size: 15px; line-height: 1.55; margin-bottom: 14px; }
  .inference-box { margin-top: 22px; padding: 18px 22px; }

  /* Methodology: trim card padding. */
  .method-grid { gap: 22px; margin-top: 4px; }
  .method-card { padding: 18px 20px; }
  .method-card .mc-title { font-size: 20px; margin-top: 6px; }
  .method-card .mc-body { font-size: 13.5px; line-height: 1.5; margin-top: 9px; }
  .engine-list { margin-top: 12px; }
  .engine-list li { padding: 5px 0; font-size: 13px; }

  /* Scorecard: tighten rows. */
  .score-table th, .score-table td { padding: 11px 12px; }
  .score-table td.dim { font-size: 13.5px; }
  .score-table td.dim .dim-note { font-size: 11px; }
  .scorecard-context { margin-top: 22px; font-size: 13px; line-height: 1.55; }

  /* Per-Engine page: tighten cards so the 2x2 grid fits alongside the section
     header without orphaning the header on its own page. */
  .engines-grid { gap: 16px; margin-top: 4px; }
  .e-card { padding: 16px 18px; }
  .e-card-head { padding-bottom: 10px; margin-bottom: 10px; }
  .e-card-name { font-size: 22px; }
  .e-card-score { font-size: 20px; }
  .e-card-meta { gap: 5px 14px; margin-bottom: 10px; }
  .e-card-meta dd { font-size: 13.5px; }
  .e-card-sources { padding-top: 10px; }
  .e-card-sources .src-label { margin-bottom: 8px; }
  .src-row { padding: 6px 0; font-size: 12.5px; }

  /* Strengths/Growth: trim list items. */
  .two-col .col { padding: 18px 22px 0; }
  .two-col h3 { margin-bottom: 12px; }
  .two-col li { padding: 11px 0; font-size: 13.5px; line-height: 1.5; }

  /* Competitive table. */
  .comp-table th, .comp-table td { padding: 9px 12px; }
  .comp-table td { font-size: 13px; }
  .comp-bar-wrap { height: 4px; margin-top: 5px; }

  /* Recommendations page: trim padding so the 6-item list stays on one page. */
  .rec-list { margin-top: 4px; }
  .rec-item { padding: 16px 0; gap: 18px; }
  .rec-num { font-size: 44px; }
  .rec-body .rec-title { font-size: 21px; margin-bottom: 6px; }
  .rec-body .rec-desc { font-size: 13px; line-height: 1.5; }
  .rec-meta { gap: 10px; padding-left: 16px; }
  .rec-meta-row .rm-label { font-size: 9px; margin-bottom: 3px; }
  .rec-meta-row .rm-value { font-size: 12px; }

  /* Competitive landscape context paragraph: keep it with the table above. */
  .comp-table + .scorecard-context {
    break-before: avoid;
    page-break-before: avoid;
  }
  .scorecard-context, .scorecard-context p { orphans: 4; widows: 4; }

  /* Footnotes: tighter so 8-12 entries fit on one page. */
  .fn-item { padding: 11px 0; }

  /* Next Steps: give the ns-mark consistent breathing room from the page
     bottom; the master's natural flow can leave it cramped or pushed off. */
  .ns-block { padding-bottom: 0.4in; }
  .ns-mark { margin-top: 48px; }
</style>`;

const INDUSTRY_BENCHMARK = 75;
const ALL_ENGINES: EngineLabel[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];

/** Engines the pipeline actually runs (Perplexity is opt-in). */
export function activeEngines(): EngineLabel[] {
  const perplexityOn = process.env.ENABLE_PERPLEXITY === 'true';
  return ALL_ENGINES.filter((e) => (e === 'perplexity' ? perplexityOn : true));
}

const ENGINE_NAMES: Record<EngineLabel, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
};

/** Per the master spec's methodology page. */
const ENGINE_MODELS: Record<EngineLabel, string> = {
  chatgpt: 'GPT-5',
  perplexity: 'Sonar',
  gemini: '2.5 Pro',
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

/**
 * Best-effort map from research-base anchor → canonical academic citation.
 * Unmapped tags fall back to the module path itself.
 */
const RESEARCH_CITATIONS: Record<string, string> = {
  '01-rag-mechanics.md §anthropic-contextual-retrieval':
    'Anthropic. (2024). Contextual Retrieval. anthropic.com/news/contextual-retrieval.',
  '02-evidence-graphs.md §structured-data-multiplier':
    'Kumar, A., Palkhouski, L. (2025). AI Answer Engine Citation Behavior: An Empirical Analysis of the GEO-16 Framework. arXiv:2509.10762.',
  '03-authority-signals.md §cross-platform-consistency-2-8x':
    'Evertune. Cross-Platform Citation Analysis; supported in Ahrefs Unlinked Mentions Study (May 2025).',
  '03-authority-signals.md §evertune-10x-multiplier':
    'Evertune. AI Citation Frequency Analysis Across 75,000 Brands.',
  '03-authority-signals.md §industry-hhi-topography':
    'Search Engine Land. AI Citation Concentration Analysis Across 11 Industries (HHI Index Study).',
  '03-authority-signals.md §ahrefs-unlinked-mentions':
    'Ahrefs. (2025). Unlinked Brand Mentions and Google AI Overviews Correlation Study.',
  '04-effect-sizes.md §statistics-addition':
    'Aggarwal, P., et al. (2023). GEO: Generative Engine Optimization. arXiv:2311.09735. Princeton University, Georgia Tech, IIT Delhi, Allen Institute for AI.',
  '04-effect-sizes.md §named-expert-quotation':
    'Aggarwal, P., et al. (2023). GEO: Generative Engine Optimization. arXiv:2311.09735.',
  '04-effect-sizes.md §outbound-citation':
    'Aggarwal, P., et al. (2023). GEO: Generative Engine Optimization. arXiv:2311.09735.',
  '05-engine-specific.md §perplexity-threshold':
    'AEO research base — engine-specific behavior, Perplexity citation thresholds.',
  '05-engine-specific.md §google-ai-overviews-threshold':
    'AEO research base — engine-specific behavior, Google AI Overviews thresholds.',
  '05-engine-specific.md §strategy-by-engine':
    'AEO research base — engine-specific behavior, strategy by engine.',
  '05-engine-specific.md §priority-matrix':
    'AEO research base — engine-specific behavior, priority matrix.',
  '06-fan-out.md §query-fan-out-coverage':
    'Surfer SEO. Fan-Out Citation Analysis. 173,902 URLs across 10,000 keywords.',
  '06-fan-out.md §fan-out-variance':
    'Surfer SEO. Fan-Out Citation Analysis.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function averageScore(synthesis: SynthesizeOutput, engines: EngineLabel[]): number {
  const values = engines
    .map((e) => synthesis.by_engine[e]?.scores.overall)
    .filter((v): v is number => typeof v === 'number');
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function extractOverallScores(synthesis: SynthesizeOutput): Record<EngineLabel, number> {
  return {
    chatgpt: Math.round(synthesis.by_engine.chatgpt?.scores.overall ?? 0),
    perplexity: Math.round(synthesis.by_engine.perplexity?.scores.overall ?? 0),
    gemini: Math.round(synthesis.by_engine.gemini?.scores.overall ?? 0),
    claude: Math.round(synthesis.by_engine.claude?.scores.overall ?? 0),
  };
}

function joinEngines(names: string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function numWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] || String(n);
}

/** Strip common org suffixes for the masthead label. */
function shortBrand(brand: string): string {
  const trimmed = brand.trim();
  const SUFFIXES =
    /\s+(Plastic Surgery|Aesthetics?|Dental|Dermatology|Medicine|Clinic|Group|MD|DDS|DMD|Practice|Center|Inc\.?|LLC)\.?$/i;
  return trimmed.replace(SUFFIXES, '').slice(0, 48) || trimmed;
}

function collectTopCompetitors(
  synthesis: SynthesizeOutput,
  engines: EngineLabel[],
  limit: number,
): string[] {
  const tally = new Map<string, number>();
  for (const e of engines) {
    const list = synthesis.by_engine[e]?.competitors_top ?? [];
    for (const c of list) {
      const k = c.name.trim();
      tally.set(k, (tally.get(k) || 0) + c.share_pct);
    }
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

// ---------------------------------------------------------------------------
// Footnote registry
//
// Scans narrative strings for [research: module §anchor] tags. First-appearance
// order assigns numbers; subsequent tags reuse the assigned number. Renders the
// numbered <sup> in place and emits a bibliography for page 10.
//
// [INFERENCE — operator review required] markers are stripped from inline text
// and surfaced as a small italic "[review]" note instead of as a footnote.
// ---------------------------------------------------------------------------

interface FootnoteEntry {
  num: number;
  tag: string;
  citation: string;
}

class FootnoteRegistry {
  private map = new Map<string, FootnoteEntry>();
  private order: FootnoteEntry[] = [];

  /** Process narrative text: escape HTML, replace [research:] tags with
   *  <sup>N</sup>, strip [INFERENCE] markers. Returns ready-to-insert HTML. */
  narr(text: string | undefined | null): string {
    if (!text) return '';
    let out = esc(text);
    out = out.replace(/\[research:\s*([^\]]+?)\]/g, (_m, body: string) => {
      const tag = body.trim();
      let entry = this.map.get(tag);
      if (!entry) {
        const num = this.order.length + 1;
        const citation =
          RESEARCH_CITATIONS[tag] ||
          `Research base — aeo-research/${tag.replace(/\s+§\s*/, ' §')}.`;
        entry = { num, tag, citation };
        this.map.set(tag, entry);
        this.order.push(entry);
      }
      return `<sup>${entry.num}</sup>`;
    });
    out = out.replace(
      /\[INFERENCE[^\]]*\]/g,
      '<em style="color:#A8A8A8;font-size:0.85em;font-style:italic;">[review]</em>',
    );
    return out;
  }

  entries(): FootnoteEntry[] {
    return [...this.order];
  }
}

// ---------------------------------------------------------------------------
// Score-band templates
// ---------------------------------------------------------------------------

function coverVerdictTemplate(avg: number, brand: string): string {
  if (avg < 20) {
    return `${brand} is currently invisible to AI engines across the measured query types tested in this audit.`;
  }
  if (avg < INDUSTRY_BENCHMARK) {
    return `${brand} is present but below the threshold AI engines reliably surface from. The structural gap is documented in the sections that follow.`;
  }
  return `${brand} meets the industry visibility threshold across the engines tested. The sections below detail where the brand leads and where to extend.`;
}

// ---------------------------------------------------------------------------
// Shared page chrome
// ---------------------------------------------------------------------------

function masthead(analysis: Analysis): string {
  return `<div class="masthead">
    <div class="gms-logo-img gms-logo-mast" role="img" aria-label="Growth Marketing Studios"></div>
    <div class="meta">${esc(analysis.analysis_id)} · ${esc(shortBrand(analysis.input.brand))}</div>
  </div>`;
}

function pageFooter(analysis: Analysis, label: string, num: string): string {
  return `<div class="page-footer">
    <span class="doc-id">${esc(analysis.analysis_id)}</span>
    <span>${esc(label)}</span>
    <span class="page-num">${num}</span>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Cover (page 1)
// ---------------------------------------------------------------------------

function renderCoverPage(
  analysis: Analysis,
  synthesis: SynthesizeOutput,
  engines: EngineLabel[],
): string {
  const input = analysis.input;
  const avg = averageScore(synthesis, engines);
  const grade =
    GRADE_LABELS[synthesis.summary.overall_grade] || cap(synthesis.summary.overall_grade || '');
  const meets = avg >= INDUSTRY_BENCHMARK;
  const date = new Date(analysis.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const engineList = joinEngines(engines.map((e) => ENGINE_NAMES[e]));
  const scope = `A forensic audit of brand visibility across ${engines.length} large language model engines — ${engineList} — for ${esc(
    input.specialty.toLowerCase(),
  )} queries in ${esc(input.location)}.`;
  const verdict = coverVerdictTemplate(avg, input.brand);

  return `<section class="page cover">
  <div class="cover-top">
    <div class="gms-logo-img gms-logo-cover" role="img" aria-label="Growth Marketing Studios"></div>
    <div class="cover-doc-meta">
      <div>Deep Audit Brief</div>
      <div class="doc-id">${esc(analysis.analysis_id)}</div>
      <div>${esc(date)}</div>
    </div>
  </div>
  <div class="cover-body">
    <div class="cover-eyebrow">AEO Visibility Audit · Confidential</div>
    <h1 class="cover-title">${esc(input.brand)}</h1>
    <p class="cover-scope">${scope}</p>
    <div class="cover-domain">${esc(input.domain)}</div>
    <div class="cover-verdict">
      <div class="cover-score-block">
        <div class="cover-score-label">Cross-engine score</div>
        <div class="cover-score-num">${avg}<span class="denom"> / 100</span></div>
        <div class="cover-score-grade">${esc(grade)} · ${
          meets ? 'Meets industry threshold' : 'Below industry threshold'
        }</div>
      </div>
      <div class="cover-verdict-text">
        <div class="vlabel">Verdict</div>
        <p>${esc(verdict)}</p>
      </div>
    </div>
    <p class="cover-tagline">Industry visibility threshold sits at ${INDUSTRY_BENCHMARK} / 100. This audit identifies the structural reasons behind the score, the competitive set in those answers, and the prioritized path to challenger status in 3 to 6 months.</p>
  </div>
  <div class="cover-foot">
    <span>Prepared by Growth Marketing Studios</span>
    <span>Confidential &mdash; for the named recipient only</span>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Executive Verdict (page 2)
// ---------------------------------------------------------------------------

function renderVerdictPage(
  analysis: Analysis,
  synthesis: SynthesizeOutput,
  engines: EngineLabel[],
  fn: FootnoteRegistry,
): string {
  const input = analysis.input;
  const avg = averageScore(synthesis, engines);
  const totalQueries = analysis.stats?.queries ?? 6;
  const totalResponses = totalQueries * engines.length;

  const anyRecognition = engines.some(
    (e) => (synthesis.by_engine[e]?.scores.brand_recognition ?? 0) > 0,
  );
  const lede = anyRecognition
    ? `${input.brand} appears in some AI-engine responses for this audit, but at a frequency below the level that drives reliable customer discovery.`
    : `${input.brand} does not appear in any of the ${totalResponses} AI-engine responses generated for this audit.`;

  const competitorNames = collectTopCompetitors(synthesis, engines, 4);
  const compList = competitorNames.length
    ? competitorNames.map(esc).join(', ')
    : 'larger regional competitors';

  const confidencePcts = engines
    .map((e) => synthesis.by_engine[e]?.confidence_pct)
    .filter((v): v is number => typeof v === 'number');
  const confMin = confidencePcts.length ? Math.min(...confidencePcts) : 0;
  const confMax = confidencePcts.length ? Math.max(...confidencePcts) : 0;

  const overalls = engines
    .map((e) => ({
      name: ENGINE_NAMES[e],
      score: synthesis.by_engine[e]?.scores.overall ?? 0,
    }))
    .sort((a, b) => a.score - b.score);
  const floor = overalls[0];
  const ceiling = overalls[overalls.length - 1];

  const p1 = `Across the ${engines.length} engines tested with ${totalQueries} customer-style queries each, the brand was ${
    anyRecognition ? 'rarely named' : 'not named once'
  }. The competitive set in those answers is dominated by ${compList}. The pattern is consistent with the Evertune finding that brand search volume is the single strongest predictor of AI citation frequency${fn.narr(
    '[research: 03-authority-signals.md §evertune-10x-multiplier]',
  )}.`;

  const p2 = `Engine confidence in the brand entity ranges from ${confMin} percent (${esc(
    overalls[0]?.name ?? '—',
  )}) to ${confMax} percent (${esc(
    overalls[overalls.length - 1]?.name ?? '—',
  )}), which means the engines can recognize the brand if asked directly, but they will not surface it unprompted. The score ceiling on this audit was ${esc(
    ceiling?.name ?? '—',
  )} at ${ceiling?.score ?? 0} / 100; the floor was ${esc(floor?.name ?? '—')} at ${
    floor?.score ?? 0
  } / 100. ${
    avg < INDUSTRY_BENCHMARK
      ? `All ${engines.length} engines sit below the ${INDUSTRY_BENCHMARK} / 100 industry threshold.`
      : `Most engines clear the ${INDUSTRY_BENCHMARK} / 100 industry threshold.`
  }`;

  const p3 = fn.narr(synthesis.summary.competitive_position || '');

  // Inference box: trigger if any engine returned no real sources.
  const blankEngine =
    engines.find((e) => {
      const sources = synthesis.by_engine[e]?.sources_evaluation ?? [];
      if (sources.length === 0) return true;
      if (sources.length === 1) {
        const name = sources[0]?.name ?? '';
        const score = Number(sources[0]?.score ?? 0);
        return /n\/a|sin fuentes|no source|unable/i.test(name) || score === 0;
      }
      return false;
    }) || null;

  const inferenceBox = blankEngine
    ? `<div class="inference-box">
        <div class="inf-label">Inference — operator review required</div>
        <p>${ENGINE_NAMES[blankEngine]} returned no source citations across the prompts in this run. This may reflect a response-format limitation during data collection rather than true absence of citation behavior. A re-audit with adjusted ${ENGINE_NAMES[blankEngine]} prompting is recommended before drawing structural conclusions about that engine specifically.</p>
      </div>`
    : '';

  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">01 / EXECUTIVE VERDICT</div>
    <h2>What the engines <em>see</em>, and what they don't.</h2>
  </div>
  <div class="sec-divider"></div>
  <p class="verdict-lede">${esc(lede)}</p>
  <div class="verdict-prose">
    <p>${p1}</p>
    <p>${p2}</p>
    ${p3 ? `<p>${p3}</p>` : ''}
  </div>
  ${inferenceBox}
  ${pageFooter(analysis, 'Executive Verdict', '02 / 10')}
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Methodology (page 3)
// ---------------------------------------------------------------------------

function renderMethodologyPage(analysis: Analysis, engines: EngineLabel[]): string {
  const queries = analysis.stats?.queries ?? 6;
  const total = queries * engines.length;
  const engineList = engines
    .map(
      (e) =>
        `<li><span class="en-name">${ENGINE_NAMES[e]}</span><span class="en-model">${ENGINE_MODELS[e]}</span></li>`,
    )
    .join('');

  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">02 / METHODOLOGY</div>
    <h2>How this audit was <em>produced</em>.</h2>
    <p class="sec-lede">${queries} customer-style queries that never name the brand, run against ${engines.length} large language model engines, parsed for mentions, position, sentiment, competitor citations and cited sources. Scored against the academic GEO-16 framework and the CITABLE content-engineering checklist.</p>
  </div>
  <div class="method-grid">
    <div class="method-card">
      <div class="mc-num">01</div>
      <div class="mc-title">Engines and models</div>
      <div class="mc-body">Industry coverage across the engines that drive early-funnel customer research today.</div>
      <ul class="engine-list">${engineList}</ul>
    </div>
    <div class="method-card">
      <div class="mc-num">02</div>
      <div class="mc-title">Query design</div>
      <div class="mc-body">${queries} customer-style queries generated for the brand's geography and specialty, none of them containing the brand name. Each query is then executed against every engine in the same run, producing ${total} total engine responses for analysis.</div>
    </div>
    <div class="method-card">
      <div class="mc-num">03</div>
      <div class="mc-title">Scoring framework</div>
      <div class="mc-body">Five components per engine &mdash; brand recognition, market position, presence quality, brand perception, share of voice &mdash; rolling up to a 0&ndash;100 score per engine and a cross-engine total. Built on the GEO-16 framework (UC Berkeley, 2025) and grounded in the Princeton / Georgia Tech GEO effect-size study (2023).</div>
    </div>
    <div class="method-card">
      <div class="mc-num">04</div>
      <div class="mc-title">Limits</div>
      <div class="mc-body">Diagnostic snapshot, not a placement guarantee. Engine outputs vary between runs by design &mdash; only 27 percent of query fan-out sub-queries remain consistent across repeated invocations. Production AEO monitoring averages 5&ndash;10 runs per prompt to smooth this variance.</div>
    </div>
  </div>
  ${pageFooter(analysis, 'Methodology', '03 / 10')}
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Scorecard (page 4)
// ---------------------------------------------------------------------------

function renderScorecardPage(
  analysis: Analysis,
  synthesis: SynthesizeOutput,
  engines: EngineLabel[],
): string {
  const dims: Array<{
    label: string;
    note: string;
    key: keyof EngineReport['scores'];
    max: number;
  }> = [
    { label: 'Brand recognition', note: 'Engine names the brand unprompted', key: 'brand_recognition', max: 20 },
    { label: 'Market position', note: 'Where the engine places the brand vs. competitors', key: 'market_position', max: 10 },
    { label: 'Presence quality', note: 'Depth of detail when the engine does engage', key: 'presence_quality', max: 20 },
    { label: 'Brand perception', note: 'Sentiment and source quality — highest weight', key: 'brand_perception', max: 40 },
    { label: 'Share of voice', note: 'Slice of category answers naming this brand', key: 'share_of_voice', max: 10 },
  ];

  const headers = engines
    .map(
      (e) =>
        `<th class="engine-h"><div class="eh-name">${ENGINE_NAMES[e]}</div><div class="eh-model">${ENGINE_MODELS[e]}</div></th>`,
    )
    .join('');

  const rows = dims
    .map((d) => {
      const cells = engines
        .map(
          (e) =>
            `<td class="val">${Math.round(
              synthesis.by_engine[e]?.scores[d.key] ?? 0,
            )}<span class="denom"> / ${d.max}</span></td>`,
        )
        .join('');
      return `<tr><td class="dim">${d.label}<div class="dim-note">${d.note}</div></td>${cells}</tr>`;
    })
    .join('');

  const totals = engines
    .map((e) => {
      const o = Math.round(synthesis.by_engine[e]?.scores.overall ?? 0);
      const cls = o < INDUSTRY_BENCHMARK ? 'val poor' : 'val';
      return `<td class="${cls}">${o}<span class="denom"> / 100</span></td>`;
    })
    .join('');

  const allLow = engines.every(
    (e) => (synthesis.by_engine[e]?.scores.brand_recognition ?? 0) < 3,
  );
  const context = allLow
    ? `<strong>Reading the table.</strong> Brand recognition and share of voice are at or near zero across every engine: a signal the brand is not present in the engines' parametric memory or retrieval pool for this category. Variance in perception scores is driven by how each engine handles the queries when it cannot find the brand, not by anything the brand is doing right.`
    : `<strong>Reading the table.</strong> The five components are weighted differently. Perception carries the most weight and is the easiest component for any provider to score high on through tone alone, so a high perception score does not by itself indicate a healthy audit. Recognition and share-of-voice are the hardest, most diagnostic components.`;

  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">03 / CROSS-ENGINE SCORECARD</div>
    <h2>Five dimensions, ${numWord(engines.length)} engines, <em>one verdict</em>.</h2>
    <p class="sec-lede">Each engine rates the brand from 0 to 100, built from five weighted components.</p>
  </div>
  <table class="score-table">
    <thead><tr><th>Dimension</th>${headers}</tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row"><td class="dim">Total</td>${totals}</tr>
    </tbody>
  </table>
  <p class="scorecard-context">${context}</p>
  ${pageFooter(analysis, 'Cross-Engine Scorecard', '04 / 10')}
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Per-Engine Findings (page 5)
// ---------------------------------------------------------------------------

function renderPerEnginePage(
  analysis: Analysis,
  synthesis: SynthesizeOutput,
  engines: EngineLabel[],
): string {
  const cards = engines
    .map((e) => {
      const r = synthesis.by_engine[e];
      if (!r) {
        return `<div class="e-card">
        <div class="e-card-head"><div class="e-card-name">${ENGINE_NAMES[e]}</div></div>
        <p style="font-size:13px;color:var(--muted)">No usable signal from this engine in this run.</p>
      </div>`;
      }
      const sources = (r.sources_evaluation ?? []).slice(0, 4);
      const sourcesHtml = sources.length
        ? sources
            .map((s) => {
              const raw = Number(s.score) || 0;
              const score = raw <= 10 ? Math.round(raw * 10) : Math.round(raw);
              return `<div class="src-row"><span class="src-name">${esc(
                s.name,
              )}</span><span class="src-score">${score}</span></div>`;
            })
            .join('')
        : `<div class="src-empty">No sources evaluated — engine returned no citations</div>`;

      return `<div class="e-card">
      <div class="e-card-head">
        <div class="e-card-name">${ENGINE_NAMES[e]}</div>
        <div class="e-card-score">${Math.round(
          r.scores.brand_perception ?? 0,
        )}<span class="denom"> / 40</span></div>
      </div>
      <dl class="e-card-meta">
        <dt>Position</dt><dd>${esc(
          POSITION_LABELS[r.market_position_label] ?? r.market_position_label,
        )}</dd>
        <dt>Archetype</dt><dd>${esc(cap(r.archetype))}</dd>
        <dt>Confidence</dt><dd>${Math.round(r.confidence_pct)}%</dd>
      </dl>
      <div class="e-card-sources">
        <div class="src-label">Top cited sources</div>
        ${sourcesHtml}
      </div>
    </div>`;
    })
    .join('');

  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">04 / PER-ENGINE FINDINGS</div>
    <h2>The sources <em>each engine</em> reaches for.</h2>
    <p class="sec-lede">Where the brand is absent, this is where each engine looks instead. These are the platforms a comeback strategy has to enter first.</p>
  </div>
  <div class="engines-grid">${cards}</div>
  ${pageFooter(analysis, 'Per-Engine Findings', '05 / 10')}
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Strengths / Growth Areas (page 6)
// ---------------------------------------------------------------------------

function renderStrengthsGrowthPage(
  analysis: Analysis,
  synthesis: SynthesizeOutput,
  fn: FootnoteRegistry,
): string {
  const strengths = (synthesis.summary.key_strengths || []).slice(0, 6);
  const growth = (synthesis.summary.growth_areas || []).slice(0, 6);

  const sLis = strengths.length
    ? strengths.map((s) => `<li>${fn.narr(s)}</li>`).join('')
    : `<li style="color:var(--muted)">No strengths recorded for this run.</li>`;
  const gLis = growth.length
    ? growth.map((g) => `<li>${fn.narr(g)}</li>`).join('')
    : `<li style="color:var(--muted)">No growth areas recorded for this run.</li>`;

  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">05 / STRUCTURAL ANALYSIS</div>
    <h2>What works in the brand's favor, and <em>what doesn't</em>.</h2>
    <p class="sec-lede">The structural conditions that shape what AI engines say about the brand today, and the levers that move them.</p>
  </div>
  <div class="two-col">
    <div class="col">
      <h3>Working in favor</h3>
      <ul>${sLis}</ul>
    </div>
    <div class="col">
      <h3>Working against</h3>
      <ul>${gLis}</ul>
    </div>
  </div>
  ${pageFooter(analysis, 'Structural Analysis', '06 / 10')}
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Competitive Landscape (page 7)
// ---------------------------------------------------------------------------

function renderCompetitivePage(
  analysis: Analysis,
  synthesis: SynthesizeOutput,
  engines: EngineLabel[],
): string {
  const enginesWithComps = engines.filter(
    (e) => (synthesis.by_engine[e]?.competitors_top?.length ?? 0) > 0,
  );

  if (enginesWithComps.length === 0) {
    return `<section class="page">
      ${masthead(analysis)}
      <div class="sec-head">
        <div class="sec-num">06 / COMPETITIVE LANDSCAPE</div>
        <h2>Who the engines name <em>instead</em>.</h2>
        <p class="sec-lede">No engine in this run returned a competitor set rich enough to chart. This is itself a finding: when engines decline to name providers, the brand cannot enter the answer through competitive displacement — it has to enter through authority-platform presence (see page 5).</p>
      </div>
      ${pageFooter(analysis, 'Competitive Landscape', '07 / 10')}
    </section>`;
  }

  const namesUnion = new Set<string>();
  for (const e of enginesWithComps) {
    for (const c of synthesis.by_engine[e]?.competitors_top ?? []) {
      namesUnion.add(c.name.trim());
    }
  }
  const rows = [...namesUnion].sort();

  const headers = enginesWithComps.map((e) => `<th class="num">${ENGINE_NAMES[e]}</th>`).join('');
  const maxShare = Math.max(
    1,
    ...enginesWithComps.flatMap((e) =>
      (synthesis.by_engine[e]?.competitors_top ?? []).map((c) => c.share_pct),
    ),
  );

  const body = rows
    .map((name) => {
      const cells = enginesWithComps
        .map((e) => {
          const c = (synthesis.by_engine[e]?.competitors_top ?? []).find(
            (x) => x.name.trim() === name,
          );
          if (!c) return `<td class="num">&mdash;</td>`;
          const width = Math.round((c.share_pct / maxShare) * 100);
          return `<td class="num">${c.share_pct}%<div class="comp-bar-wrap"><div class="comp-bar" style="width:${width}%"></div></div></td>`;
        })
        .join('');
      return `<tr><td class="surgeon">${esc(name)}</td>${cells}</tr>`;
    })
    .join('');

  const brandRow = `<tr style="background:var(--bg-alt)"><td class="surgeon" style="font-family:'Instrument Serif',serif;font-style:italic;font-size:16px">${esc(
    analysis.input.brand,
  )}</td>${enginesWithComps
    .map(() => `<td class="num" style="color:var(--signal)">0%</td>`)
    .join('')}</tr>`;

  const silentEngines = engines.filter((e) => !enginesWithComps.includes(e));
  const silentNote = silentEngines.length
    ? `${joinEngines(silentEngines.map((e) => ENGINE_NAMES[e]))} did not return named providers in this run. `
    : '';

  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">06 / COMPETITIVE LANDSCAPE</div>
    <h2>Who the engines name <em>instead</em>.</h2>
    <p class="sec-lede">The providers AI engines surface in the brand's category. Their share is durable because it is built on brand search volume and cross-platform citation depth — the strongest single predictors of AI citation frequency.</p>
  </div>
  <table class="comp-table">
    <thead><tr><th>Provider</th>${headers}</tr></thead>
    <tbody>
      ${body}
      ${brandRow}
    </tbody>
  </table>
  <p class="scorecard-context"><strong>What this pattern means.</strong> ${silentNote}The named-provider engines are the ones actively making recommendations in this category. The challenger move targets the authority sources those engines cite (page 5).</p>
  ${pageFooter(analysis, 'Competitive Landscape', '07 / 10')}
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Prioritized Recommendations (pages 8–9) — CANONICAL
// JSON has no recommendations field. These 6 are the canonical set from the
// master spec, with light geo/specialty substitution. The [research:] tags
// inline route through the footnote registry alongside the JSON's tags.
// ---------------------------------------------------------------------------

interface Recommendation {
  title: string;
  desc: string;
  tier: 'critical' | 'high' | 'medium';
  lift: string;
  effort: string;
}

function canonicalRecommendations(input: Analysis['input']): Recommendation[] {
  const geo = input.location.split(',')[0]?.trim() || input.location;
  const specialty = input.specialty.toLowerCase();
  return [
    {
      title: 'Claim and complete authority directory profiles',
      desc: `Verified, complete profiles on the top-tier directories AI engines cite to validate ${specialty} providers. Presence on four or more non-affiliated platforms unlocks a 2.8× ChatGPT citation multiplier [research: 03-authority-signals.md §cross-platform-consistency-2-8x].`,
      tier: 'critical',
      lift: '+180% odds',
      effort: 'Medium',
    },
    {
      title: 'Implement JSON-LD schema with Q-ID verified entities',
      desc: `Organization, Person and FAQPage schemas, with Wikidata Q-ID references where they exist. This is a low-effort intervention that moves citation accuracy from 62 percent to 97 percent and unlocks Gemini Knowledge Graph entry [research: 02-evidence-graphs.md §structured-data-multiplier].`,
      tier: 'critical',
      lift: '62% → 97%',
      effort: 'Low',
    },
    {
      title: 'Restructure owned-site content into 200–400 word semantic blocks',
      desc: `Self-contained chunks with explicit entity restatement at every section opening — name, location, credentials stated atomically. This produces a documented 2.3× citation multiplier and aligns with Anthropic's Contextual Retrieval methodology [research: 01-rag-mechanics.md §anthropic-contextual-retrieval].`,
      tier: 'high',
      lift: '2.3× citations',
      effort: 'Medium',
    },
    {
      title: 'Embed statistics, named-expert quotes and outbound citations into prose',
      desc: `The Princeton / Georgia Tech GEO study documents independent uplift effects: statistics addition (+15–40%), named-expert quotation (+30–40%), and outbound citation to primary sources (+31.4% average) [research: 04-effect-sizes.md §statistics-addition]. These tactics compound and apply to every page on the owned site.`,
      tier: 'high',
      lift: '+30 to +40%',
      effort: 'Medium',
    },
    {
      title: `Own the ${geo} geo-cluster before a competitor does`,
      desc: `${geo} is an underserved geographic micro-market in this category. Hub-and-spoke pillar pages around the geo qualifier, with full fan-out coverage of local intent queries, can capture an uncontested niche before larger regional names extend their reach [research: 06-fan-out.md §query-fan-out-coverage].`,
      tier: 'high',
      lift: '+161% odds',
      effort: 'High',
    },
    {
      title: 'Build branded search demand through PR and named-author content',
      desc: `Brand search volume correlates at r = 0.334 with AI citation frequency — the strongest single predictor in the Evertune analysis of 75,000 brands. Top-quartile brands by web mentions earn more than 10× the AI citations of the next quartile down [research: 03-authority-signals.md §evertune-10x-multiplier]. This is the long-arc move: targeted PR, contributor placements in relevant press, named-author thought leadership.`,
      tier: 'medium',
      lift: '10× citations',
      effort: 'High',
    },
  ];
}

function renderRecommendationsPage(analysis: Analysis, fn: FootnoteRegistry): string {
  const recs = canonicalRecommendations(analysis.input);
  const renderItem = (r: Recommendation, i: number) => `<div class="rec-item">
    <div class="rec-num">${String(i + 1).padStart(2, '0')}</div>
    <div class="rec-body">
      <div class="rec-title">${esc(r.title)}</div>
      <div class="rec-desc">${fn.narr(r.desc)}</div>
    </div>
    <div class="rec-meta">
      <div class="rec-meta-row"><span class="rm-label">Tier</span><span class="tier tier-${r.tier}">${cap(
        r.tier,
      )}</span></div>
      <div class="rec-meta-row"><span class="rm-label">Expected lift</span><span class="rm-value lift">${esc(
        r.lift,
      )}</span></div>
      <div class="rec-meta-row"><span class="rm-label">Effort</span><span class="rm-value">${esc(
        r.effort,
      )}</span></div>
    </div>
  </div>`;

  const firstHalf = recs.slice(0, 3).map((r, i) => renderItem(r, i)).join('');
  const secondHalf = recs.slice(3, 6).map((r, i) => renderItem(r, i + 3)).join('');

  const pageA = `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">07 / PRIORITIZED RECOMMENDATIONS</div>
    <h2>Sequenced moves, in <em>order of leverage</em>.</h2>
    <p class="sec-lede">Each recommendation cites the academic source for its expected effect size. Tiers reflect a combination of expected lift and prerequisite sequencing — some moves must land first to make the next ones work.</p>
  </div>
  <div class="rec-list">${firstHalf}</div>
  ${pageFooter(analysis, 'Prioritized Recommendations', '08 / 10')}
</section>`;

  const pageB = `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">07 / PRIORITIZED RECOMMENDATIONS · CONTINUED</div>
  </div>
  <div class="rec-list">${secondHalf}</div>
  ${pageFooter(analysis, 'Prioritized Recommendations', '09 / 10')}
</section>`;

  return pageA + pageB;
}

// ---------------------------------------------------------------------------
// Section: Sources & Footnotes (page 10)
// ---------------------------------------------------------------------------

function renderFootnotesPage(analysis: Analysis, fn: FootnoteRegistry): string {
  const entries = fn.entries();
  if (!entries.length) {
    return `<section class="page">
      ${masthead(analysis)}
      <div class="sec-head">
        <div class="sec-num">08 / SOURCES &amp; FOOTNOTES</div>
        <h2>The research <em>behind every claim</em>.</h2>
        <p class="sec-lede">No research citations were surfaced in this audit run.</p>
      </div>
      ${pageFooter(analysis, 'Sources & Footnotes', '10 / 10')}
    </section>`;
  }
  const items = entries
    .map(
      (e) => `<div class="fn-item">
    <div class="fn-num">${String(e.num).padStart(2, '0')}</div>
    <div class="fn-body">${esc(e.citation)}<span class="fn-ref">${esc(e.tag)}</span></div>
  </div>`,
    )
    .join('');

  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">08 / SOURCES &amp; FOOTNOTES</div>
    <h2>The research <em>behind every claim</em>.</h2>
    <p class="sec-lede">Every quantitative effect size cited in this audit is grounded in a peer-reviewed paper, public patent or large-sample industry study. Numbers here match the superscript markers throughout the brief.</p>
  </div>
  <div class="footnotes">${items}</div>
  ${pageFooter(analysis, 'Sources & Footnotes', '10 / 10')}
</section>`;
}

// ---------------------------------------------------------------------------
// Section: Next Steps (page 11)
// ---------------------------------------------------------------------------

function renderNextStepsPage(analysis: Analysis): string {
  const date = new Date(analysis.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `<section class="page">
  ${masthead(analysis)}
  <div class="sec-head">
    <div class="sec-num">09 / NEXT STEPS</div>
    <h2>Where this <em>goes</em> from here.</h2>
  </div>
  <div class="sec-divider"></div>
  <div class="ns-block">
    <div class="ns-lede">This audit is the <em>diagnosis</em>. The build is what follows.</div>
    <p class="ns-body">The numbers in this brief describe a structural gap between how AI engines describe ${esc(
      analysis.input.brand,
    )} and how they describe the leaders of its category. The pattern is fixable — the authority platforms that drive citations are open directories, and the geographic micro-market is uncontested.</p>
    <p class="ns-body">The work to close the gap is sequenced &mdash; some moves must land first to make later ones work &mdash; and it is the kind of execution we do every day for ${esc(
      analysis.input.specialty.toLowerCase(),
    )} practices. We would propose a 30-minute strategy session to walk through the recommendations in this brief, prioritize against the commercial calendar, and scope the engagement that fits.</p>
    <div class="ns-contact">
      <div class="ns-contact-block">
        <div class="nsc-label">Direct line</div>
        <div class="nsc-value"><a href="tel:+13056060395">305 . 606 . 0395</a></div>
        <div class="nsc-sub">Ferminius Fleites &mdash; Strategist</div>
      </div>
      <div class="ns-contact-block">
        <div class="nsc-label">Email</div>
        <div class="nsc-value" style="font-size:21px"><a href="mailto:support@growthmarketingstudios.com">support@growthmarketingstudios.com</a></div>
        <div class="nsc-sub">growthmarketingstudios.com</div>
      </div>
    </div>
    <div class="ns-mark">
      <div class="gms-logo-img gms-logo-ns" role="img" aria-label="Growth Marketing Studios"></div>
      <div class="ns-mark-meta">Prepared ${esc(
        date,
      )}<br>Audit ${esc(analysis.analysis_id)}<br>Confidential</div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Top-level renderer
// ---------------------------------------------------------------------------

export function renderReportHtml(analysis: Analysis, synthesis: SynthesizeOutput): string {
  const engines = activeEngines();
  const fn = new FootnoteRegistry();

  // Order matters: footnote registry accumulates in document order.
  const cover = renderCoverPage(analysis, synthesis, engines);
  const verdict = renderVerdictPage(analysis, synthesis, engines, fn);
  const methodology = renderMethodologyPage(analysis, engines);
  const scorecard = renderScorecardPage(analysis, synthesis, engines);
  const perEngine = renderPerEnginePage(analysis, synthesis, engines);
  const strengthsGrowth = renderStrengthsGrowthPage(analysis, synthesis, fn);
  const competitive = renderCompetitivePage(analysis, synthesis, engines);
  const recommendations = renderRecommendationsPage(analysis, fn);
  // Footnotes page must render after all citing sections so all tags are registered.
  const footnotes = renderFootnotesPage(analysis, fn);
  const nextSteps = renderNextStepsPage(analysis);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AEO Deep Audit Brief &mdash; ${esc(analysis.input.brand)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
${STYLE_BLOCK}
${PRINT_OVERRIDES}
</head>
<body>
${cover}
${verdict}
${methodology}
${scorecard}
${perEngine}
${strengthsGrowth}
${competitive}
${recommendations}
${footnotes}
${nextSteps}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Compact branded HTML used as the email body. The brief PDF is what's
// attached; this is the message wrapper. Contract unchanged from prior state.
// ---------------------------------------------------------------------------

export function renderEmailHtml(analysis: Analysis, synthesis: SynthesizeOutput): string {
  const { input } = analysis;
  const contact = analysis.contact;
  const fullName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : 'there';
  const engines = activeEngines();
  const avg = averageScore(synthesis, engines);
  const grade = GRADE_LABELS[synthesis.summary.overall_grade] ?? synthesis.summary.overall_grade;
  const meets = avg >= INDUSTRY_BENCHMARK;

  const scoreRow = engines
    .map((e) => {
      const score = Math.round(synthesis.by_engine[e]?.scores.overall ?? 0);
      const color = score < 40 ? '#b04a26' : score < INDUSTRY_BENCHMARK ? '#e25a1f' : '#3f7a4f';
      return `<td style="padding:8px 12px;text-align:center;border:1px solid #e2dcd2;">
      <div style="font-family:monospace;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#6b6e76;">${ENGINE_NAMES[e]}</div>
      <div style="font-size:22px;font-weight:700;color:${color};">${score}</div>
    </td>`;
    })
    .join('');

  return `<div style="font-family:'DM Sans',Arial,sans-serif;color:#0e1116;max-width:560px;margin:0 auto;">
  <div style="height:4px;background:linear-gradient(90deg,#1f3a5f,#5a3a3a,#e25a1f);"></div>
  <div style="padding:28px 28px 8px;">
    <div style="font-family:monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b04a26;">Growth Marketing Studios &nbsp;&middot;&nbsp; AEO Visibility Audit</div>
    <h1 style="font-size:24px;margin:10px 0 6px;">Your audit for ${esc(input.brand)} is ready</h1>
    <p style="color:#6b6e76;font-size:14px;margin:0 0 20px;">Hi ${esc(
      fullName,
    )}, here is how the major AI engines describe ${esc(input.brand)} (${esc(input.domain)}).</p>
    <div style="text-align:center;padding:18px;background:#efeae2;border-radius:10px;margin-bottom:14px;">
      <div style="font-size:44px;font-weight:700;color:#1f3a5f;line-height:1;">${avg}<span style="font-size:16px;color:#6b6e76;">/100</span></div>
      <div style="font-family:monospace;font-size:12px;margin-top:4px;">Overall grade: ${esc(grade)}</div>
    </div>
    <p style="font-size:13px;margin:0 0 16px;text-align:center;color:${
      meets ? '#6b6e76' : '#b04a26'
    };">
      ${
        meets
          ? `Scores above ${INDUSTRY_BENCHMARK}/100 meet industry visibility standards. Your brand clears that bar.`
          : 'Your score is below industry standards. AI engines run into obstacles when recommending you.'
      }
    </p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:20px;"><tr>${scoreRow}</tr></table>
    <p style="font-size:14px;line-height:1.6;">The full multi-page Deep Audit Brief is attached as a PDF: per-engine scorecard, competitor share of voice, perception analysis, and the growth areas to fix first. The next step is a 20-minute call with a GMS specialist.</p>
    <p style="font-size:12px;color:#6b6e76;margin-top:24px;border-top:1px solid #e2dcd2;padding-top:14px;">Audit ${esc(
      analysis.analysis_id,
    )} &nbsp;&middot;&nbsp; Growth Marketing Studios</p>
  </div>
</div>`;
}
