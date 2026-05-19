# Evidence Graphs

How LLMs evaluate factual integrity, resolve contradictions, and decide which retrieved chunks deserve citation versus mere mention.

---

## Purpose of This Module

Once chunks are retrieved (see `01-rag-mechanics.md`), they still must survive a reasoning layer that evaluates their factual integrity. This module covers that evaluation phase. Use it when explaining why content can be retrieved but not cited, or why some pages dominate AI citations despite mediocre traffic.

---

## Evidence Graphs and Entity Linking

Retrieving a document is only the first hurdle. Before assigning a citation, the LLM constructs dynamic **evidence graphs** to validate factual integrity.

### How It Works

In this reasoning phase, the AI performs explicit entity linking:

1. Transforms unstructured natural language into machine-readable nodes
2. Identifies entities within retrieved documents
3. Verifies them against external identifiers (Wikidata Q-IDs, Wikipedia, established knowledge graphs)
4. Builds a temporary knowledge graph where nodes are entities and edges are documented relationships

If the engine cannot resolve an entity with high confidence, the chunk's citation probability drops sharply.

---

## Cross-Document Consensus (Evidence Density)

When evaluating evidence graphs, LLMs seek **cross-document confirmation**, also called **evidence density** or **consensus**.

### Mechanism

The reasoning layer cross-references retrieved chunks against one another:

- If multiple independent, high-authority domains agree on a factual claim, that claim achieves high evidence density and is selected for generation
- If a retrieved source contradicts the prevailing consensus, the reasoning layer flags it as an outlier and suppresses its citation

### Strategic Implication: Contrarianism Penalty

In traditional SEO, contrarian or provocative claims often performed well as clickbait. In generative engines, contrarian claims act as **negative signals** unless they are supported by overwhelming, verifiable primary data.

A brand asserting unique positioning must back claims with proprietary data, not opinion. Otherwise the engine treats them as outliers and downgrades them in citation ranking.

---

## Mention vs Recommendation Status

The AmICited evaluation framework distinguishes two citation states:

### Mention

The AI acknowledges the entity as background context without endorsing it.

Example phrasing in output:
> "Some sources, such as Brand X, suggest..."

### Recommendation

The LLM treats the source as authoritative evidence, integrating it into the core factual output.

Example phrasing in output:
> "According to industry leader Brand X, the evidence shows..."

### Why This Distinction Matters

A brand can have high mention frequency but low recommendation frequency. The first builds awareness; the second drives commercial outcome. The auditor must measure both separately (see `06-kpis-and-metrics.md §mention-based-sov-vs-citation-based-sov`).

---

## The Structured Data Multiplier

Structured data is the single highest-leverage technical intervention available to publishers. The computational overhead of inferring entity relationships from unstructured prose introduces uncertainty that depresses citation confidence.

### Quantified Impact

| Content Format | Citation Accuracy |
|---|---|
| Unstructured text (LLM must infer entities) | 62% |
| Standard JSON-LD schema | 94% |
| JSON-LD with verified Q-IDs and full knowledge-graph integration | 97% |

### Why This Works

Structured data provides a **deterministic translation layer** that maps directly to the model's internal knowledge graph. It removes inference cost. The LLM does not have to guess "is this entity the same as the one in Wikipedia?" because the JSON-LD declares the identity explicitly.

### Required Schema Types by Use Case

- **Organization**: For brand and entity recognition
- **Product**: For commercial intent queries
- **FAQPage**: For Q&A-style retrieval matching
- **Article / NewsArticle**: For freshness and authorship signals
- **Person**: For author authority and E-E-A-T grounding
- **Service / LocalBusiness**: Critical for local AEO (medical, legal, real estate)
- **Review / AggregateRating**: For trust signals

The implementation must mirror the visible text on the page. JSON-LD that contradicts visible content triggers a contradiction-resolution penalty.

---

## Information Gain (The Anti-Skyscraper Patent)

Source: Google patent US20200349181A1, "Contextual estimation of link information gain."

### What It Does

Traditional SEO rewarded "skyscraper" content: long-form articles that aggregated and paraphrased everything already ranking for a keyword. Generative engines now actively penalize this redundancy.

The Information Gain algorithm generates a score representing the net-new information a document contributes beyond what the system has already processed from baseline documents.

### Pipeline Behavior

If the RAG system retrieves 50 documents that all repeat the same industry consensus, it filters out the duplicates. It elevates and cites sources that contribute:

- Unique datasets
- Proprietary statistics
- Novel analytical frameworks
- Exclusive expert quotations
- First-party research

### Quantified Impact

RAG architectures that prioritize document Information Gain achieve a **+17.9% increase in exact-match accuracy** versus naive RAG systems. This proves novel contribution is a primary driver of source selection.

### Strategic Implication

Two failure modes that the auditor must flag:

1. **Pure aggregation pages**: Content that summarizes industry knowledge without adding new data
2. **Paraphrase pages**: Content that restates competitor positions in slightly different words

Both score low on Information Gain and will struggle to earn citations regardless of structural quality.

### What Wins on Information Gain

- Original surveys, polls, or proprietary data
- Unique case studies with verifiable numbers
- Expert interviews with named sources
- Internal benchmarking or analytics not published elsewhere
- New analytical frameworks or methodologies

---

## How to Reference This Module in a Report

Use these inline anchor tags:

- `[research: 02-evidence-graphs.md §cross-document-consensus]`
- `[research: 02-evidence-graphs.md §mention-vs-recommendation]`
- `[research: 02-evidence-graphs.md §structured-data-multiplier]`
- `[research: 02-evidence-graphs.md §information-gain]`
