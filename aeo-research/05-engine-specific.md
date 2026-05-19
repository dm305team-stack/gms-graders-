# Engine-Specific Optimization

Per-engine thresholds, sourcing philosophies, and differentiated optimization strategies for ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews, and Brave Summary.

---

## Purpose of This Module

Generative engines do NOT share a monolithic sourcing philosophy. The same page can score citation in Perplexity and zero citation in Brave. Use this module when the auditor generates engine-specific recommendations or when explaining cross-engine variance in a client report.

---

## Engine-Specific Quality Thresholds

Source: GEO-16 study (arXiv:2509.10762), based on 1,702 citations analyzed.

Each engine's average GEO Score for cited pages reveals its quality threshold:

| Engine | Average GEO Score of Cited Pages | Sourcing Philosophy |
|---|---|---|
| **Brave Summary** | **G = 0.727** | Highest demand for structured quality. Strict structural and authority requirements. |
| **Google AI Overviews** | **G = 0.687** | High threshold, near-Brave levels. Strong preference for structured, established domains. |
| **Perplexity** | **G = 0.300** | Drastically lower threshold. Heavy algorithmic preference for unstructured, community-driven content (Reddit, forums, UGC). |

### Implication

A page optimized to a GEO Score of 0.50 may earn Perplexity citations but be invisible in Brave and Google AI Overviews. A page at 0.75 will appear across all three.

The auditor must report per-engine projected citation likelihood, not a single overall number, because the strategic implications differ.

---

## Strategy by Engine

### Brave Summary (G = 0.727 threshold)

Brave demands the highest structural quality. Optimization priorities:

1. **JSON-LD schema is mandatory** — pages without structured data are rarely cited
2. **Hierarchical semantic HTML** with clean H1/H2/H3 structure
3. **Visible metadata**: last-updated timestamps, author bios with credentials
4. **Verifiable claims** with inline source citations
5. **Block-structured content** in 200-400 word chunks

Brave functions almost like a strict academic referee. Sloppy or unstructured content is filtered out before it ever reaches the synthesis layer.

### Google AI Overviews (G = 0.687 threshold)

Similar to Brave but with stronger weighting on traditional E-E-A-T signals:

1. **Structured data + traditional SEO authority** both matter
2. **Author credentials and named contributors** strongly weighted
3. **Domain reputation** (DR, established citation history) still plays a role
4. **Freshness signals** (recent updates, current dates)
5. **Unlinked brand mentions** are the highest-correlating off-site signal (see `03-authority-signals.md §ahrefs-unlinked-mentions`)

Google AI Overviews retains residual influence from the traditional Google algorithm, but layers AEO requirements on top.

### Perplexity (G = 0.300 threshold)

The most permissive engine in structural terms but with strong preference for:

1. **Reddit threads** — disproportionately cited as authoritative source
2. **Forum discussions** in industry communities
3. **User-generated content** (Quora answers, review platforms)
4. **YouTube transcripts** for how-to and explainer queries
5. **Recent, freshly-published content** (Perplexity heavily favors recency)

### Strategy for Perplexity Specifically

If a brand is invisible in Perplexity:

- Audit the brand's Reddit presence in relevant subreddits
- Identify Quora questions in the topic area and ensure expert answers exist
- Pursue G2 / Capterra / Trustpilot reviews with detailed, structured testimonials
- Encourage organic UGC in industry forums
- Publish content with visible recent dates (Perplexity penalizes stale content heavily)

A brand can have zero JSON-LD and a sub-par site and still dominate Perplexity if it owns the community conversation.

### ChatGPT (No Public GEO-16 Score)

ChatGPT's threshold has not been measured publicly in the same study, but cross-platform consistency data provides guidance:

- Brands with **positive mentions across 4+ non-affiliated forums** are **2.8x more likely** to be cited by ChatGPT (see `03-authority-signals.md §cross-platform-consistency-2-8x`)
- ChatGPT relies heavily on Reddit, Wikipedia, and Quora for general queries
- ChatGPT's training cutoff matters: content older than the model version's cutoff is in parametric memory, while live web grounding (via tools) follows similar mechanics to other engines

### Strategy for ChatGPT

- Ensure brand presence across diverse third-party platforms (G2, Reddit, Wikipedia, industry forums, LinkedIn discussions)
- Build brand search volume to feed the parametric-memory advantage
- For ChatGPT with web browsing or search tools enabled, optimization follows general RAG mechanics from `01-rag-mechanics.md`

### Claude (Anthropic)

Claude's web-search and tool-use behavior follows Anthropic's Contextual Retrieval methodology (see `01-rag-mechanics.md §anthropic-contextual-retrieval`). Strategic implications:

- **Atomic chunk clarity** is critical — Claude is the engine most sensitive to context-loss in isolated chunks
- **Self-contained paragraphs** that restate subjects, brand names, and entities
- **High-density information per chunk**: no padding, no narrative meandering
- **Citation honesty**: Claude tends to weight sources that visibly cite their own sources

### Gemini (Google)

Gemini draws from Google's index but applies its own synthesis layer. Similar profile to Google AI Overviews with some additional weighting on:

- **YouTube content** (Google ecosystem advantage)
- **Google Business Profile data** for local queries
- **Schema.org structured data** in Google's preferred formats
- **Google's Knowledge Graph entities** with verified Q-IDs

---

## Cross-Engine Optimization Priority Matrix

For a brand starting from zero AI visibility, the auditor should sequence interventions:

### Tier 1: Universal Foundation (Helps All Engines)

1. JSON-LD schema implementation (Organization, Product/Service, FAQPage)
2. Semantic HTML with proper H1/H2/H3
3. 200-400 word content blocks
4. Visible last-updated timestamps
5. Inline citations and named-expert quotations

This tier moves the page from G ≈ 0.20 to G ≈ 0.50 territory.

### Tier 2: Structural Polish (Brave, Google AI Overviews)

1. Comprehensive JSON-LD with all relevant schema types
2. Q-ID verified entity definitions
3. Hub-and-spoke content architecture with deep H2/H3 coverage
4. First-party statistics and proprietary data
5. Outbound citations to primary research

This tier targets G ≥ 0.70 for cross-engine citation.

### Tier 3: Off-Site Authority (Perplexity, ChatGPT)

1. Reddit presence in industry subreddits
2. Wikipedia page (with verified sourcing)
3. G2 / Capterra / industry-specific review platform presence
4. Quora expert answers
5. Coverage in trusted third-party publications (unlinked mentions count)

This tier unlocks the Evertune 10x multiplier and the cross-platform 2.8x multiplier.

### Tier 4: Brand Demand Engineering (All Engines)

1. Build branded search volume through PR, content marketing, and earned media
2. Cultivate named-author thought leadership
3. Pursue partnerships and co-mentions with established authorities
4. Engineer "as featured in" placements in universal authorities

This tier raises the strongest single predictor of AI citation: brand search volume (r = 0.334).

---

## How to Reference This Module in a Report

Use these inline anchor tags:

- `[research: 05-engine-specific.md §brave-threshold]`
- `[research: 05-engine-specific.md §google-ai-overviews-threshold]`
- `[research: 05-engine-specific.md §perplexity-threshold]`
- `[research: 05-engine-specific.md §strategy-by-engine]`
- `[research: 05-engine-specific.md §priority-matrix]`
