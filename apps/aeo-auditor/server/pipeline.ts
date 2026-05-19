/**
 * AEO analysis pipeline.
 *
 * Phase 1: runs the real @gms/llm engines end to end (queries -> 4 engines ->
 * parse -> synthesize), renders the HTML report, and emails it. Capped to
 * AEO_MAX_QUERIES queries to keep a single run cheap and fast while the
 * plumbing is verified.
 *
 * Set AEO_MOCK_PIPELINE=true to skip every LLM call and use a canned
 * synthesis. That exercises the full form -> server -> report -> email path
 * without any API keys or cost.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createClient,
  getFastModel,
  GENERATE_QUERIES_PROMPT_V1,
  buildGenerateQueriesUserPrompt,
  PARSE_RESPONSE_PROMPT_V1,
  buildParseResponseUserPrompt,
  SYNTHESIZE_REPORT_PROMPT_V1,
  buildSynthesizeUserPrompt,
  loadResearchBase,
  type EngineId,
  type EngineReport,
  type GeneratedQuery,
  type GenerateQueriesOutput,
  type ParsedResponse,
  type EngineResults,
  type SynthesizeOutput,
} from '@gms/llm';

import { sendReportEmail } from './email.js';
import { renderPdf } from './pdf.js';
import { renderEmailHtml, renderReportHtml, extractOverallScores } from './report.js';
import type { Analysis, EngineLabel } from './types.js';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS_DIR = path.join(
  process.env.AEO_DATA_ROOT || path.join(APP_ROOT, '.aeo-data'),
  'reports',
);

/** llm EngineId -> AEO report label (OpenAI is "chatgpt" in the AEO domain). */
const ENGINE_LABEL: Record<EngineId, EngineLabel> = {
  openai: 'chatgpt',
  perplexity: 'perplexity',
  gemini: 'gemini',
  claude: 'claude',
};
const ENGINE_IDS: EngineId[] = ['openai', 'perplexity', 'gemini', 'claude'];
const REPORT_LABELS: EngineLabel[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];

/** Tolerant JSON extraction from an LLM response (handles ``` fences and prose). */
function extractJson<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t) as T;
}

/**
 * Run the full pipeline for one analysis. Mutates `analysis` in place:
 * status transitions, scores, report path, email outcome.
 */
export async function runPipeline(analysis: Analysis): Promise<void> {
  const log = (msg: string) => console.log(`[${analysis.analysis_id}] ${msg}`);
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  try {
    const synthesis =
      process.env.AEO_MOCK_PIPELINE === 'true'
        ? await runMockStages(analysis, log)
        : await runRealStages(analysis, log);

    analysis.synthesis = synthesis;
    analysis.overall_scores = extractOverallScores(synthesis);

    analysis.status = 'rendering';
    log('-> rendering report (HTML + PDF)');
    const reportHtml = renderReportHtml(analysis, synthesis);
    const htmlPath = path.join(REPORTS_DIR, `${analysis.analysis_id}.html`);
    fs.writeFileSync(htmlPath, reportHtml, 'utf8');
    analysis.report_path = htmlPath;

    const pdfPath = path.join(REPORTS_DIR, `${analysis.analysis_id}.pdf`);
    await renderPdf(reportHtml, pdfPath);
    analysis.pdf_path = pdfPath;
    log(`PDF rendered (${(fs.statSync(pdfPath).size / 1024).toFixed(0)} KB)`);

    analysis.status = 'emailing';
    log(`-> emailing report to ${analysis.input.contact.email}`);
    analysis.email = await sendReportEmail({
      to: analysis.input.contact.email,
      fullName: analysis.input.contact.name,
      brand: analysis.input.brand,
      domain: analysis.input.domain,
      analysisId: analysis.analysis_id,
      emailHtml: renderEmailHtml(analysis, synthesis),
      pdfPath,
    });

    analysis.status = 'done';
    analysis.finished_at = new Date().toISOString();
    log(`done in ${Math.round((Date.now() - analysis._t0) / 1000)}s`);
  } catch (err) {
    analysis.status = 'failed';
    analysis.error = err instanceof Error ? err.message : String(err);
    analysis.finished_at = new Date().toISOString();
    console.error(`[${analysis.analysis_id}] failed: ${analysis.error}`);
  }
}

// ---------------------------------------------------------------------------
// Real pipeline
// ---------------------------------------------------------------------------

async function runRealStages(
  analysis: Analysis,
  log: (m: string) => void,
): Promise<SynthesizeOutput> {
  const { input } = analysis;
  const maxQueries = Math.max(1, Number(process.env.AEO_MAX_QUERIES || 6));
  let costUsd = 0;

  // Claude drives the auxiliary stages (queries, parsing, synthesis).
  const claude = createClient('claude'); // throws clearly if ANTHROPIC_API_KEY is missing
  const fastModel = getFastModel();

  // ---- Stage A: generate queries -----------------------------------------
  analysis.status = 'generating_queries';
  log('-> generating queries (Claude Haiku)');
  const queryResp = await claude.complete({
    system: GENERATE_QUERIES_PROMPT_V1,
    messages: [
      {
        role: 'user',
        content: buildGenerateQueriesUserPrompt({
          brand_name: input.brand,
          domain: input.domain,
          location: input.location,
          specialty: input.specialty,
          org_type: input.org_type,
          bilingual: true,
        }),
      },
    ],
    modelOverride: fastModel,
    enableCache: true,
    temperature: 0.4,
    maxTokens: 2048,
  });
  costUsd += queryResp.costUsd;
  const allQueries = extractJson<GenerateQueriesOutput>(queryResp.content).queries ?? [];
  const queries = allQueries.slice(0, maxQueries);
  if (!queries.length) throw new Error('query generation returned no queries');
  log(`generated ${allQueries.length} queries, running ${queries.length}`);

  // ---- Stage B: run engines ----------------------------------------------
  analysis.status = 'running_engines';
  const clients = buildEngineClients(log);
  if (!Object.keys(clients).length) {
    throw new Error('no AI engines available — check the engine API keys');
  }

  interface RawAnswer {
    query: GeneratedQuery;
    engine: EngineId;
    text: string;
  }
  const rawAnswers: RawAnswer[] = [];
  let engineCalls = 0;
  let engineErrors = 0;

  for (const query of queries) {
    const entries = Object.entries(clients) as [EngineId, ReturnType<typeof createClient>][];
    const settled = await Promise.allSettled(
      entries.map(([, client]) =>
        client.complete({
          messages: [{ role: 'user', content: query.query }],
          temperature: 0.5,
          maxTokens: 1024,
        }),
      ),
    );
    settled.forEach((result, i) => {
      const engine = entries[i][0];
      engineCalls += 1;
      if (result.status === 'fulfilled') {
        costUsd += result.value.costUsd;
        rawAnswers.push({ query, engine, text: result.value.content });
      } else {
        engineErrors += 1;
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        log(`engine ${engine} failed on "${query.query}": ${reason}`);
      }
    });
  }
  if (!rawAnswers.length) throw new Error('every engine call failed');
  log(`collected ${rawAnswers.length} engine answers (${engineErrors} failed)`);

  // ---- Stage C: parse responses ------------------------------------------
  analysis.status = 'parsing';
  log('-> parsing responses (Claude Haiku)');
  const parsed: Array<{ query: GeneratedQuery; engine: EngineId; parsed: ParsedResponse }> = [];
  for (const answer of rawAnswers) {
    try {
      const parseResp = await claude.complete({
        system: PARSE_RESPONSE_PROMPT_V1,
        messages: [
          {
            role: 'user',
            content: buildParseResponseUserPrompt({
              query: answer.query.query,
              response_text: answer.text,
              brand_name: input.brand,
              engine: ENGINE_LABEL[answer.engine],
            }),
          },
        ],
        modelOverride: fastModel,
        enableCache: true,
        temperature: 0,
        maxTokens: 1024,
      });
      costUsd += parseResp.costUsd;
      parsed.push({
        query: answer.query,
        engine: answer.engine,
        parsed: extractJson<ParsedResponse>(parseResp.content),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log(`parse failed for ${answer.engine}: ${reason}`);
    }
  }
  if (!parsed.length) throw new Error('no responses could be parsed');

  // ---- Stage D: synthesize ------------------------------------------------
  analysis.status = 'synthesizing';
  log('-> synthesizing report (Claude Sonnet)');
  const engineResults: EngineResults[] = REPORT_LABELS.map((label) => ({
    engine: label,
    parsed_responses: parsed
      .filter((p) => ENGINE_LABEL[p.engine] === label)
      .map((p) => ({ query: p.query.query, query_type: p.query.type, parsed: p.parsed })),
  }));

  const researchBase = loadResearchBase();

  const enrichedSystem = `${SYNTHESIZE_REPORT_PROMPT_V1}

---

ADDITIONAL CONTEXT — RESEARCH BASE FOR GROUNDING:

The narrative outputs (narrative_themes, key_strengths, growth_areas, sources_evaluation) must be grounded in the AEO research base below. Reference findings inline using tags like [research: 04-effect-sizes.md §statistics-addition]. Mark claims that cannot be grounded as [INFERENCE - operator review required].

When suggesting growth areas, tie each recommendation to a specific mechanism documented in the research (Structured Data Multiplier, Princeton/GT effect sizes, Evertune brand mentions multiplier, CITABLE framework, GEO-16 pillars).

<aeo_research_base>
${researchBase}
</aeo_research_base>

REMINDER: The output format remains valid JSON only, exactly as specified above. The research base informs the content of narrative fields but does not change the JSON schema.`;

  const synthResp = await claude.complete({
    system: enrichedSystem,
    messages: [
      {
        role: 'user',
        content: buildSynthesizeUserPrompt({
          brand_name: input.brand,
          domain: input.domain,
          location: input.location,
          specialty: input.specialty,
          org_type: input.org_type,
          engine_results: engineResults,
        }),
      },
    ],
    temperature: 0.3,
    maxTokens: 8000,
    enableCache: true,
  });
  costUsd += synthResp.costUsd;

  analysis.cost_usd = Number(costUsd.toFixed(4));
  analysis.stats = {
    queries: queries.length,
    engine_calls: engineCalls,
    engine_errors: engineErrors,
  };
  return extractJson<SynthesizeOutput>(synthResp.content);
}

/**
 * Build one client per engine.
 *
 * Perplexity is opt-in: it is only attempted when PERPLEXITY_API_KEY is set
 * AND ENABLE_PERPLEXITY === 'true'. When not enabled it is skipped silently,
 * with no client constructed and no error log. The other three engines are
 * always attempted; a genuinely missing key is logged.
 */
function buildEngineClients(
  log: (m: string) => void,
): Partial<Record<EngineId, ReturnType<typeof createClient>>> {
  const clients: Partial<Record<EngineId, ReturnType<typeof createClient>>> = {};
  for (const engine of ENGINE_IDS) {
    if (engine === 'perplexity') {
      const enabled =
        Boolean(process.env.PERPLEXITY_API_KEY) &&
        process.env.ENABLE_PERPLEXITY === 'true';
      if (!enabled) continue;
    }
    try {
      clients[engine] = createClient(engine);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log(`engine ${engine} unavailable, skipping: ${reason}`);
    }
  }
  return clients;
}

// ---------------------------------------------------------------------------
// Mock pipeline — no API keys, no cost. Exercises report + email plumbing.
// ---------------------------------------------------------------------------

async function runMockStages(
  analysis: Analysis,
  log: (m: string) => void,
): Promise<SynthesizeOutput> {
  const stages: Analysis['status'][] = [
    'generating_queries',
    'running_engines',
    'parsing',
    'synthesizing',
  ];
  for (const stage of stages) {
    analysis.status = stage;
    log(`-> ${stage} (mock)`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  analysis.cost_usd = 0;
  analysis.stats = { queries: 6, engine_calls: 24, engine_errors: 0 };
  return mockSynthesis(analysis);
}

/** Build a mock EngineReport: scores derived from `overall`, plus the rest. */
function mockEngine(overall: number, rest: Omit<EngineReport, 'scores'>): EngineReport {
  return {
    scores: {
      brand_recognition: Math.round(overall * 0.18),
      market_position: Math.round(overall * 0.08),
      presence_quality: Math.round(overall * 0.2),
      brand_perception: Math.round(overall * 0.42),
      share_of_voice: Math.round(overall * 0.09),
      overall,
    },
    ...rest,
  };
}

function mockSynthesis(analysis: Analysis): SynthesizeOutput {
  const brand = analysis.input.brand || 'the practice';

  return {
    by_engine: {
      chatgpt: mockEngine(41, {
        confidence_pct: 67,
        market_position_label: 'challenger',
        archetype: 'specialist',
        competitors_top: [
          { name: 'Miami Aesthetic Institute', share_pct: 31 },
          { name: 'Coral Gables Plastic Surgery', share_pct: 22 },
          { name: 'South Beach Cosmetic Group', share_pct: 14 },
        ],
        narrative_themes: ['Board-certified specialist', 'Strong before/after results'],
        key_strengths: ['Consistent specialty framing', 'Positive tone in every mention'],
        growth_areas: ['Named in only 2 of 6 queries', 'Loses head-to-head comparisons'],
        trajectory: 'stable',
        sources_evaluation: [
          { name: 'Practice website', type: 'official_website', score: 74, note: 'Authoritative but rarely cited back by the engine.' },
          { name: 'RealSelf profile', type: 'review_platform', score: 61, note: 'Thin review volume versus competitors.' },
        ],
      }),
      perplexity: mockEngine(54, {
        confidence_pct: 84,
        market_position_label: 'challenger',
        archetype: 'premium',
        competitors_top: [
          { name: 'Miami Aesthetic Institute', share_pct: 27 },
          { name: 'Bal Harbour Surgical Arts', share_pct: 19 },
          { name: 'Coral Gables Plastic Surgery', share_pct: 16 },
        ],
        narrative_themes: ['Premium positioning', 'Cited across medical directories'],
        key_strengths: ['Strong directory and citation footprint', 'Real-time sources reinforce credibility'],
        growth_areas: ['Few patient testimonials surfaced', 'Pricing pages absent from answers'],
        trajectory: 'positive',
        sources_evaluation: [
          { name: 'Healthgrades', type: 'directory', score: 88, note: 'Drives most of the positive signal here.' },
          { name: 'Google Business Profile', type: 'directory', score: 79, note: 'Consistent NAP data, good review rating.' },
          { name: 'Practice website', type: 'official_website', score: 72, note: 'Clear specialty pages, light on schema.' },
        ],
      }),
      gemini: mockEngine(47, {
        confidence_pct: 73,
        market_position_label: 'niche_player',
        archetype: 'traditionalist',
        competitors_top: [
          { name: 'Coral Gables Plastic Surgery', share_pct: 29 },
          { name: 'Miami Aesthetic Institute', share_pct: 21 },
          { name: 'Aventura Cosmetic Center', share_pct: 13 },
        ],
        narrative_themes: ['Reputation tied to the surgeon name', 'Local search visibility'],
        key_strengths: ['Surfaces well in location queries', 'Google review rating cited directly'],
        growth_areas: ['Limited topical depth per procedure', 'Sparse third-party editorial coverage'],
        trajectory: 'stable',
        sources_evaluation: [
          { name: 'Google Maps listing', type: 'directory', score: 81, note: 'Primary source the engine leans on.' },
          { name: 'Practice website', type: 'official_website', score: 70, note: 'Indexed, but few procedure-specific pages.' },
        ],
      }),
      claude: mockEngine(38, {
        confidence_pct: 62,
        market_position_label: 'niche_player',
        archetype: 'specialist',
        competitors_top: [
          { name: 'Miami Aesthetic Institute', share_pct: 34 },
          { name: 'Bal Harbour Surgical Arts', share_pct: 18 },
        ],
        narrative_themes: ['Recognized as a careful specialist', 'Low overall mention volume'],
        key_strengths: ['No reputational risk in any answer', 'Specialty depth acknowledged when named'],
        growth_areas: ['Rarely named without a direct brand prompt', 'Almost no citable authority sources'],
        trajectory: 'stable',
        sources_evaluation: [
          { name: 'Practice website', type: 'official_website', score: 68, note: 'The only source the engine could anchor to.' },
        ],
      }),
    },
    summary: {
      overall_grade: 'developing',
      key_strengths: [
        `${brand} is described in positive terms whenever an AI engine surfaces it.`,
        'Specialty positioning stays consistent across all four engines.',
        'No reputational red flags appear in any engine response.',
      ],
      growth_areas: [
        'Mention frequency is low. Engines default to larger regional competitors.',
        'Few authoritative third-party sources cite the practice.',
        'Share of voice trails the top competitor by more than 20 points.',
      ],
      narrative_themes: [
        'Specialist, not yet a default recommendation',
        'Sentiment is an asset, visibility is the gap',
        'Competitors win on citation depth, not reputation',
      ],
      trajectory: 'stable',
      competitive_position: `${brand} reads as a credible specialist but is not yet a first-line recommendation in AI search. Competitors with deeper citation footprints capture most of the share of voice.`,
    },
  };
}
