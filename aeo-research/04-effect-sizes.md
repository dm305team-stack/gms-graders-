# Effect Sizes

The quantified uplift values that the auditor cites when generating prioritized recommendations.

---

## Purpose of This Module

This is the recommendation engine's source of truth. Every "if you do X, you will see Y% improvement" claim in a generated report must reference this module. Use these numbers verbatim and always cite the underlying study.

---

## Primary Source: Princeton / Georgia Tech GEO Study

Reference: **arXiv:2311.09735**, "GEO: Generative Engine Optimization" (Princeton University, Georgia Tech, IIT Delhi, Allen Institute for AI, November 2023).

The foundational academic study establishing causal effect sizes for GEO interventions. Tested specific content manipulation strategies across a vast benchmark of queries.

### Methodology Note

Effect sizes vary by the website's pre-existing search rank. The study used a scale from Rank-1 (highest visibility) to Rank-5 (lowest visibility). Interventions tend to deliver larger relative gains for lower-ranked sites, but the absolute lift methodology applies across the board.

---

## The Master Effect Size Table

| Intervention | Methodology | Effect Size |
|---|---|---|
| **Statistics Addition** | Embedding quantitative data, specific metrics, and proprietary statistics directly into prose | **+15% to +40% visibility boost**. For lower-ranked (Rank-5) sites: **97.9% relative improvement** |
| **Quotation Addition** | Integrating direct quotes from recognized subject matter experts and industry leaders | **+30% to +40% visibility boost**. For Rank-5 sites: **99.7% relative improvement** |
| **Cite Sources** | Adding explicit, formatted outbound citations to primary research and authoritative domains | **+31.4% average boost**. For bottom-tier pages: **115.1% relative improvement** |
| **Fluency Optimization** | Structuring prose for absolute clarity; eliminating convoluted syntax | **+15% to +30% visibility boost**. Compounds with statistics for **+5.5% additional** |
| **Authoritative Tone** | Writing in objective, declarative statements; eliminating passive voice and ambiguity | **+12.6% boost for Rank-4 sites**. Primarily prevents misinterpretation of nuanced claims |
| **Keyword Stuffing** | Excessive exact-match keyword density | **-10% citation rate**. Active penalty |

---

## Why These Tactics Work (Underlying Mechanism)

LLMs function as automated academics. They are trained on vast corpora of peer-reviewed literature, legal documentation, and formal datasets. Their confidence scoring mechanisms inherently weight text that mirrors academic rigor:

- Specific statistics
- Direct quotes from named sources
- Explicit citations to primary research
- Declarative fluency without ambiguity

Content that resembles a well-sourced academic paper outperforms content that resembles a marketing landing page, even when both convey similar information.

---

## Detailed Tactic Specifications

### Statistics Addition (+15-40% / 97.9% Rank-5)

The intervention requires statistics that are:

- **Specific and quantitative**: "patient satisfaction increased 34%" not "patient satisfaction improved"
- **Verifiable and sourced**: ideally proprietary first-party data or cited from primary research
- **Dense**: embedded throughout the prose, not concentrated in a single section
- **Contextual**: every statistic explained with its methodology or source attribution inline

Failure modes that nullify the effect:
- Statistics quoted from competitor content (duplication penalty under Information Gain)
- Vague percentages without sources or denominators
- Statistics that contradict known consensus (contradiction-resolution penalty)

### Quotation Addition (+30-40% / 99.7% Rank-5)

The highest-leverage intervention by absolute uplift. Required characteristics:

- **Named expert with verifiable identity**: "Dr. Jane Smith, Director of Cardiac Surgery at Cleveland Clinic" not "an industry expert"
- **Direct quote attribution**: full quote in quotation marks, not paraphrased
- **Linkable provenance**: the expert should be findable via their institutional affiliation or LinkedIn profile
- **Topic-relevant authority**: the quoted person must be a recognized authority in the subject matter

### Cite Sources (+31.4% average / 115.1% Rank-5)

The intervention with the largest delta for bottom-tier pages. Requires:

- **Outbound links to primary sources**: peer-reviewed papers, government data, established authoritative domains
- **Inline citation format**: visible citation brackets or footnote indicators within the prose
- **High citation density**: multiple cited sources per major claim, not one citation at the end of an article

The auditor should flag pages with zero outbound citations as a critical Rank-5 priority.

### Fluency Optimization (+15-30%)

Less glamorous but compounds with other tactics. Requires:

- **Plain prose without jargon stuffing**
- **Sentence variation but no run-on constructions**
- **Active voice as default**
- **Clear paragraph structure**: one idea per paragraph, topic sentence first

Combined with Statistics Addition, fluency adds an additional +5.5% on top of the base uplift.

### Authoritative Tone (+12.6% Rank-4)

Smallest but still meaningful uplift. Avoid:

- Hedging language ("might," "could possibly," "in some cases")
- Passive constructions ("it has been suggested that...")
- Apologetic framing ("we believe," "in our humble opinion")

Prefer:

- Declarative statements grounded in evidence
- Direct attribution: "X causes Y because Z"
- Confident summaries that present the conclusion before the qualification

### Keyword Stuffing (-10% Penalty)

The auditor must flag this as an anti-pattern. Modern LLMs detect and penalize excessive exact-match repetition. The classical SEO tactic of repeating the target keyword 15-20 times per page now actively reduces citation rate by 10%.

Threshold heuristics for the auditor:
- Same exact phrase repeated more than 6 times in a single page
- Keyword density above 3.5% for any single phrase
- Stuffed alt tags, repeated header phrasings, footer keyword dumps

---

## Compounding Effect Multipliers

Source: cross-referenced with `02-evidence-graphs.md`.

These multiplicative effects stack with the base Princeton/GT interventions:

| Multiplier | Source | Compounding Effect |
|---|---|---|
| Proper chunking (200-400 words) | RAG mechanics | **2.3x citation rate** |
| JSON-LD schema implementation | Structured data | Citation accuracy 62% → 94% |
| Q-ID verified JSON-LD | Knowledge graph | Citation accuracy 94% → 97% |
| Information Gain optimization | Google patent | **+17.9% exact-match accuracy** |
| Top 25% web mentions (brand SoV) | Evertune study | **10x more AI citations** |
| Cross-platform consensus (4+ forums) | Authority signals | **2.8x ChatGPT citation likelihood** |
| Query fan-out coverage | Surfer SEO study | **+161% citation odds** |

---

## Recommendation Prioritization Logic

When the auditor generates a list of recommendations, it should prioritize by:

1. **Expected absolute lift** (Princeton/GT base uplift)
2. **Current rank tier** of the page (Rank-5 pages get larger relative gains)
3. **Implementation cost** (JSON-LD takes hours; getting a Wikipedia page takes months)
4. **Multiplier potential** (interventions that unlock multiple multipliers rank higher)

Suggested priority sequence for a typical Rank-3 to Rank-5 page:

1. Add proper JSON-LD schema (62% → 94% accuracy, low effort)
2. Restructure content into 200-400 word blocks (2.3x multiplier, low effort)
3. Embed 5-10 specific statistics with sources (+15-40%, medium effort)
4. Add direct expert quotations (+30-40%, medium-high effort)
5. Add outbound citations to primary sources (+31.4%, low effort)
6. Build query fan-out coverage via H2/H3 hub-and-spoke (+161% odds, high effort)
7. Pursue Wikipedia / Reddit / G2 presence (10x and 2.8x multipliers, very high effort)

---

## How to Reference This Module in a Report

Use these inline anchor tags:

- `[research: 04-effect-sizes.md §statistics-addition]`
- `[research: 04-effect-sizes.md §quotation-addition]`
- `[research: 04-effect-sizes.md §cite-sources]`
- `[research: 04-effect-sizes.md §fluency-optimization]`
- `[research: 04-effect-sizes.md §authoritative-tone]`
- `[research: 04-effect-sizes.md §keyword-stuffing-penalty]`
- `[research: 04-effect-sizes.md §compounding-multipliers]`
