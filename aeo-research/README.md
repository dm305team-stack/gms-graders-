# AEO Research Base

Modular, LLM-optimized research base for the AEO Visibility Auditor web app. Designed to be injected as context into Anthropic API calls (with prompt caching) when generating audit reports.

---

## Directory Structure

```
aeo-research/
├── README.md                       # This file
├── 00-master-framework.md          # Always-injected core. CITABLE + GEO-16 unified.
├── 01-rag-mechanics.md             # Vector embeddings, chunking, query fan-out
├── 02-evidence-graphs.md           # Consensus, contradictions, Info Gain, structured data
├── 03-authority-signals.md         # Off-site mentions, brand SoV, HHI by industry
├── 04-effect-sizes.md              # Princeton/GT uplift table for recommendations
├── 05-engine-specific.md           # Per-engine thresholds (Brave, Google, Perplexity, etc.)
├── 06-kpis-and-metrics.md          # AI SOV, Citation Rate, URL Mention Rate, RAGAS
└── 07-citation-formats.md          # Bibliographic references for every claim
```

---

## Integration Pattern (Node.js Backend on Hostinger)

### 1. Load and concatenate at server startup

```javascript
import fs from 'fs';
import path from 'path';

const RESEARCH_DIR = './aeo-research';

function loadResearchModule(filename) {
  return fs.readFileSync(path.join(RESEARCH_DIR, filename), 'utf-8');
}

// Always-loaded core
const MASTER_FRAMEWORK = loadResearchModule('00-master-framework.md');

// Lazy-loaded modules by use case
const ALL_MODULES = [
  '00-master-framework.md',
  '01-rag-mechanics.md',
  '02-evidence-graphs.md',
  '03-authority-signals.md',
  '04-effect-sizes.md',
  '05-engine-specific.md',
  '06-kpis-and-metrics.md',
  '07-citation-formats.md',
].map(loadResearchModule).join('\n\n---\n\n');
```

### 2. Inject with prompt caching

```javascript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

async function generateAuditReport(brandData, urlAnalysis) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: 'You are the AEO Visibility Auditor for Growth Marketing Studios. Generate forensic, source-cited audit reports grounded exclusively in the research base below.',
      },
      {
        type: 'text',
        text: `<aeo_research_base>\n${ALL_MODULES}\n</aeo_research_base>\n\nGrounding rules:\n1. Every quantitative claim must reference a research module using inline tags like [research: 04-effect-sizes.md §statistics-addition]\n2. Mark unsupported claims as [INFERENCE - operator review required]\n3. Use the citation formats from 07-citation-formats.md for the report's Sources section\n4. Apply engine-specific recommendations per 05-engine-specific.md`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Generate the audit report. Brand data: ${JSON.stringify(brandData)}. URL analysis: ${JSON.stringify(urlAnalysis)}`,
      },
    ],
  });

  return response.content[0].text;
}
```

### 3. Verify caching is active

After the first call, response.usage should show:
- `cache_creation_input_tokens`: large (initial write)
- `cache_read_input_tokens`: 0 on first call, large on subsequent calls within 5 minutes

Verify in production logs to confirm the research base is being cached, not re-charged on each request.

---

## When to Load Which Modules

For maximum context efficiency, you can load only the relevant modules per endpoint:

| Endpoint | Modules to Load |
|---|---|
| Full audit report | All modules (00 through 07) |
| GEO Score calculation only | 00, 02 (structured data), 04 (effect sizes) |
| Engine-specific recommendations | 00, 04, 05 |
| Authority gap analysis | 00, 03 |
| Technical RAG audit (advanced) | 00, 01, 02, 06 |
| Quick recommendations | 00, 04 |

The master framework (00) is always required as the operational base.

---

## Maintenance Protocol

When new research becomes available:

1. Add new findings to the appropriate module (or create a new one)
2. Update `00-master-framework.md` module map if a new file is added
3. Add the new source citation to `07-citation-formats.md`
4. Test that the auditor correctly cites the new finding in generated reports

Do not embed new research directly in code or system prompts. All research must live in this directory for traceability.

---

## Token Budget (Approximate)

Combined size of all 8 modules: approximately 25K-30K tokens.

With Anthropic prompt caching:
- First call: full token cost for write
- Subsequent calls within 5 minutes: 10% cost for cached reads
- Effective cost per audit at scale: under 5 cents in cached-read mode

For Sonnet 4.5 pricing, verify current rates at docs.claude.com.

---

## License and Attribution

This research base is compiled from publicly available academic sources, industry studies, and public patents (full citations in `07-citation-formats.md`). The synthesis, modular structure, and operational integration for the AEO Visibility Auditor are proprietary to Growth Marketing Studios.
