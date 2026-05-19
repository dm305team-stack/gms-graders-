# KPIs and Metrics

The measurement framework for AEO success. Every dashboard tile, scorecard, and KPI in the auditor must be defined from this module.

---

## Purpose of This Module

Traditional SEO metrics (organic click-through rate, keyword position, raw traffic) are largely obsolete for measuring AI visibility. A brand can be cited tens of thousands of times in AI answers without generating a single outbound click. This module defines the metrics that actually quantify AEO success.

---

## AI Share of Voice (SOV)

The flagship metric. Quantifies the proportion of AI-synthesized real estate, citations, and conversational recommendations that feature a specific brand relative to its competitors across a defined prompt set.

### Definition

AI SOV is an aggregate metric that heavily weights prominence:

- Maximum score: the brand is the primary recommended solution in the opening sentence of the AI response
- Diminished score: the brand is buried in a supplementary list, or mentioned only in a closing aside

### Why It Matters

If a brand is consistently omitted from early AI-synthesized category conversations, it signals an inability to pass RAG evidence filters. This compounds over time and effectively erases the brand from the modern discovery funnel.

### Two Sub-Metrics

AI SOV decomposes into two distinct measurements that the auditor must report separately.

---

## Mention-Based SOV

The frequency with which a brand is **contextually discussed** in the text of the AI's answer, regardless of whether a clickable citation is included.

### What It Captures

"Zero-click" brand awareness. Even when the user does not click through to a source, the brand has been positioned in their decision-making context.

### Example Calculation

For a query set of 100 prompts, run each through ChatGPT, Perplexity, Claude, and Gemini:

- Count answers where the brand name appears in the synthesized text
- Divide by total answers generated (100 × 4 engines = 400)
- Express as a percentage

If the brand is mentioned in 87 of 400 answers, **Mention-Based SOV = 21.75%**.

### Auditor Implementation Note

The mention detection must handle:
- Exact brand name matches
- Common abbreviations and alternate spellings
- Possessive forms ("Acme's product")
- Variations with and without "Inc," "LLC," "the"

Stem-matching or fuzzy matching is acceptable; substring-matching alone can produce false positives (e.g., a brand named "Apex" matched inside "apex predator").

---

## Citation-Based SOV

The frequency with which the engine provides a **clickable footnote, hyperlinked carousel card, or cited URL** directing the user back to the brand's domain.

### What It Captures

Direct attribution. The engine is not just discussing the brand but actively pointing the user at the brand's owned property as a source.

### Example Calculation

For the same 400 answers:

- Count answers where the brand's domain (or subdomain) appears as a cited source URL
- Divide by total answers generated
- Express as a percentage

If the brand domain is cited in 34 of 400 answers, **Citation-Based SOV = 8.5%**.

### Why Both Metrics Are Required

A high Mention-Based SOV with low Citation-Based SOV means the AI is talking about the brand based on third-party signals but is not directing users to the brand's owned content. This indicates:

- The brand has cultural/market authority
- The brand's own content fails to pass RAG structural filters

The fix here is on-page: structured data, semantic HTML, 200-400 word chunks, citations and statistics on owned pages.

A low Mention-Based SOV indicates the deeper problem of brand demand and off-site authority. The fix here is off-site: PR, Reddit, Wikipedia, G2, brand search volume.

---

## Citation Rate (Page-Level)

While SOV measures overall brand presence across a prompt set, Citation Rate measures the technical success of a specific page or URL.

### Definition

The percentage of AI-generated answers within a defined query cluster that explicitly cite a URL from the target domain.

### Example

For a query cluster of 30 prompts targeting "best plastic surgeons in Miami," run through all four engines (120 total answers). If the brand's domain is cited in 18 of 120 answers, **Citation Rate = 15%**.

### What It Indicates

The LLM algorithm deems the specific page authoritative enough to reference. High citation rate = high structural quality and relevance for that query cluster.

---

## URL Mention Rate (Commercial Quality Indicator)

Evaluates the commercial quality of citations by measuring whether a citation is accompanied by a recommendation.

### Definition

The percentage of answers where the brand is BOTH cited (URL appears as source) AND mentioned prominently within the prose.

### What a Bad Ratio Reveals

A high Citation Rate coupled with a low URL Mention Rate is a critical failure mode. It means:

- The AI is extracting the brand's content as factual training data
- The AI is NOT recommending the brand by name to the user
- The brand is contributing its intellectual property to competitor recommendations

This is one of the most underdiagnosed problems in AEO. The auditor must flag it explicitly.

### Example Bad Ratio

A page has 22% Citation Rate but only 4% URL Mention Rate. The AI is using the page to answer questions but recommending competitors. The fix:

- Strengthen brand-entity association on the page (E-E-A-T, named authors, brand-anchored claims)
- Add internal linking and brand-positioned conclusions
- Pursue off-site brand mention density (so the AI associates the topic with the brand, not just the page)

---

## Volatility and Sample Size Requirements

Source: cross-reference with `01-rag-mechanics.md §query-fan-out-volatility`.

Only **27% of fan-out sub-queries remain consistent** across repeated runs of the same search. This means single-run measurements are statistically unreliable.

### Sampling Protocol

For each prompt in the audit set:

- **Minimum runs per engine**: 5
- **Recommended runs per engine**: 10
- **Aggregate**: report mean and standard deviation, not single observations

For a 100-prompt audit across 4 engines at 10 runs each, the total API calls reach 4,000 generations. Plan API budget and prompt caching accordingly.

### Confidence Reporting

The auditor should report SOV and Citation Rate with confidence intervals when sample sizes permit, or at minimum flag low-N measurements as "preliminary."

---

## Technical RAG Evaluation Metrics (Advanced)

For technical audits of clients running their own RAG systems, or for diagnostic deep-dives:

### Context Recall

Proportion of relevant documents successfully retrieved from the knowledge base. A measurement of retrieval completeness.

### Context Precision

Proportion of retrieved chunks that were actually relevant to the query. A measurement of retrieval accuracy.

### Citation Precision and Coverage

Score from 0 to 1 indicating whether the model successfully cited all the information that could have been supported by retrieved passages. Helps identify when RAG systems are missing attribution opportunities.

### Frameworks That Implement These Metrics

- **RAGAS** (Retrieval Augmented Generation Assessment) — open-source Python framework
- **Amazon Bedrock Evaluations** — managed service for RAG pipeline auditing

These are most relevant for clients with proprietary RAG implementations, not for standard web-content AEO audits.

---

## The Auditor's Reporting Tile Structure

Recommended dashboard tiles for client-facing reports:

| Tile | Metric | Display Format |
|---|---|---|
| Top-line visibility | AI Share of Voice (combined) | Percentage with competitor comparison |
| Awareness | Mention-Based SOV | Percentage + delta vs prior period |
| Commercial attribution | Citation-Based SOV | Percentage + delta |
| Page-level performance | Citation Rate (top pages) | Sorted table |
| Health check | URL Mention Rate ratio | Ratio with red-yellow-green status |
| Engine breakdown | SOV by engine (ChatGPT, Perplexity, Claude, Gemini) | Stacked bar chart |
| Competitor benchmark | SOV gap vs top 3 competitors | Comparative bar chart |
| Structural quality | GEO Score (G) | Numeric with threshold marker (0.70) |
| Pillar coverage | H (pillars hit out of 16) | Progress indicator |

---

## How to Reference This Module in a Report

Use these inline anchor tags:

- `[research: 06-kpis-and-metrics.md §ai-share-of-voice]`
- `[research: 06-kpis-and-metrics.md §mention-based-sov]`
- `[research: 06-kpis-and-metrics.md §citation-based-sov]`
- `[research: 06-kpis-and-metrics.md §citation-rate]`
- `[research: 06-kpis-and-metrics.md §url-mention-rate]`
- `[research: 06-kpis-and-metrics.md §volatility-sampling]`
- `[research: 06-kpis-and-metrics.md §technical-rag-metrics]`
