# Citation Formats

Bibliographic references for every source cited in this research base. Use this module to format the "Sources" section of generated reports and to verify that all claims trace to verifiable origins.

---

## Purpose of This Module

When the auditor generates a client-facing report, every quantitative claim must be traceable. This module provides the canonical citation format for each source and defines how the auditor renders them in output.

---

## Primary Academic Sources

### Princeton / Georgia Tech GEO Study (2023)

**Citation format**:
> Aggarwal, P., et al. (2023). *GEO: Generative Engine Optimization.* arXiv:2311.09735. Princeton University, Georgia Tech, IIT Delhi, Allen Institute for AI.

**URL**: https://arxiv.org/abs/2311.09735

**Used for**:
- All Princeton/GT effect sizes (Statistics Addition, Quotation Addition, Cite Sources, Fluency, Authoritative Tone, Keyword Stuffing penalty)
- Foundational establishment of GEO as a distinct discipline

**In-report short form**:
> Princeton/Georgia Tech GEO Study (arXiv:2311.09735)

---

### GEO-16 Framework Study (2025)

**Citation format**:
> Kumar, A., Palkhouski, L. (2025). *AI Answer Engine Citation Behavior: An Empirical Analysis of the GEO-16 Framework.* arXiv:2509.10762. UC Berkeley / Wrodium Research.

**URL**: https://arxiv.org/abs/2509.10762

**Used for**:
- The G ≥ 0.70 and H ≥ 12 thresholds
- 78% cross-engine citation rate finding
- Page quality odds ratio (4.2)
- Engine-specific GEO scores (Brave 0.727, Google AI Overviews 0.687, Perplexity 0.300)
- The 16-pillar framework structure
- Methodology basis (1,702 citations analyzed across 1,100 URLs, 70 prompts)

**In-report short form**:
> GEO-16 Framework Study (arXiv:2509.10762)

---

## Industry Research Sources

### Anthropic Contextual Retrieval

**Citation format**:
> Anthropic. (2024). *Contextual Retrieval.* Anthropic Research.

**URL**: https://www.anthropic.com/news/contextual-retrieval

**Used for**:
- 67% reduction in failed retrievals finding
- Contextual Embeddings and Contextual BM25 methodology
- Implications for chunk-level clarity and entity restatement

**In-report short form**:
> Anthropic Contextual Retrieval (2024)

---

### Google Information Gain Patent

**Citation format**:
> Google LLC. (2020). *Contextual estimation of link information gain.* US Patent Application US20200349181A1.

**URL**: https://patents.google.com/patent/US20200349181A1/en

**Used for**:
- The algorithmic basis for redundancy penalization
- The 17.9% exact-match accuracy uplift for Information Gain-aware RAG
- The mechanism behind the skyscraper-content penalty

**In-report short form**:
> Google Information Gain Patent (US20200349181A1)

---

### Surfer SEO Fan-Out Study

**Citation format**:
> Surfer SEO. *Fan-Out Citation Analysis.* 173,902 URLs across 10,000 keywords.

**Used for**:
- +161% citation odds for multi-fan-out ranking
- 51% citation share captured by fan-out-comprehensive pages
- <20% citation share for head-term-only pages
- 27% volatility of fan-out sub-queries across runs

**In-report short form**:
> Surfer SEO Fan-Out Study (173,902 URLs)

---

### Ahrefs Unlinked Mentions Study (2025)

**Citation format**:
> Ahrefs. (2025, May). *AI Overview Correlation Analysis: Unlinked Brand Mentions as the Highest-Correlating Metric.*

**Used for**:
- The finding that unlinked brand mentions are the single highest-correlating metric for Google AI Overviews appearance
- The basis for shifting digital PR from backlinks to mentions

**In-report short form**:
> Ahrefs Unlinked Mentions Study (May 2025)

---

### Evertune Brand Mentions Analysis

**Citation format**:
> Evertune. *AI Citation Frequency Analysis Across 75,000 Brands.*

**Used for**:
- 10x multiplier for top-quartile web mention brands
- Brand search volume correlation (r = 0.334) as the strongest single predictor of AI citation
- 2.8x ChatGPT citation likelihood for brands mentioned across 4+ non-affiliated forums

**In-report short form**:
> Evertune Brand Analysis (75,000 brands)

---

### Search Engine Land Industry Topography Study

**Citation format**:
> Search Engine Land. *AI Citation Concentration Analysis Across 11 Industries (HHI Index Study).*

**Used for**:
- Identification of concentrated vs diverse industry sectors
- Universal authority rankings (Reddit ~66K, Wikipedia ~25K, YouTube ~19K, etc.)
- HHI-based classification for strategy differentiation

**In-report short form**:
> Search Engine Land HHI Study

---

### AmICited Framework (Mention vs Recommendation)

**Citation format**:
> AmICited Evaluation Framework. *Definitional Distinction Between AI Mentions and Recommendations.*

**Used for**:
- The structural definition of Mention vs Recommendation status
- The basis for separate Mention-Based SOV and Citation-Based SOV measurements

**In-report short form**:
> AmICited Framework

---

## Technical Framework Sources

### RAGAS (Retrieval Augmented Generation Assessment)

**Citation format**:
> RAGAS Open-Source Framework. *Context Recall, Context Precision, Citation Precision and Coverage Metrics.*

**Used for**:
- Technical RAG pipeline evaluation metrics
- For advanced clients with proprietary RAG implementations

---

### Amazon Bedrock Evaluations

**Citation format**:
> Amazon Web Services. *Bedrock Evaluations: RAG System Performance Metrics.*

**URL**: https://aws.amazon.com/blogs/machine-learning/evaluate-models-or-rag-systems-using-amazon-bedrock-evaluations-now-generally-available/

**Used for**:
- Managed RAG evaluation methodology
- Technical KPI definitions for enterprise clients

---

## Standardized In-Report Citation Format

When the auditor generates a report, it should render citations in this consistent style:

### Inline Format

```
Adding statistics to your content can deliver +15% to +40% citation 
visibility uplift [Princeton/GT GEO Study, arXiv:2311.09735].
```

### Footnote Style (for detailed reports)

```
Adding statistics to your content can deliver +15% to +40% citation 
visibility uplift.¹

¹ Aggarwal, P., et al. (2023). GEO: Generative Engine Optimization. 
arXiv:2311.09735.
```

### End-of-Report Sources Section

Every report must include a "Sources" section listing every cited study in full bibliographic format, ordered alphabetically by author or sponsoring organization.

---

## How to Reference This Module

When generating a report's Sources section, pull from this module exclusively. Do not invent citations or paraphrase study titles. If a claim in a report cannot be matched to a source in this module, the claim must be flagged as `[INFERENCE — operator review required]` (see `00-master-framework.md §mandatory-grounding-rule`).

---

## Last Verified

This module reflects sources documented as of the original research compilation. The auditor should periodically verify URLs and citation accuracy, particularly for arXiv preprints which may receive revised versions.
