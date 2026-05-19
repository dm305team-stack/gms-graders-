# RAG Mechanics

How LLMs retrieve, chunk, and synthesize content before generating citations.

---

## Purpose of This Module

Foundation module explaining the technical pipeline that determines whether a webpage gets cited by a generative engine. Use this module to explain mechanisms behind recommendations or when a report needs to justify why a specific structural change matters.

---

## The RAG Pipeline (End-to-End)

Standard LLMs rely on static parametric memory and are susceptible to:
- **Chronological decay**: outdated information from training cutoff
- **Hallucinations**: confident generation of plausible but false statements

Retrieval-Augmented Generation solves both by querying external knowledge bases in real time. The full pipeline:

1. User submits query
2. Query is converted to a vector embedding
3. Vector database returns nearest-neighbor chunks
4. Retrieved chunks are evaluated for consensus and information gain
5. Selected chunks are injected into LLM prompt as factual grounding
6. LLM generates the answer with inline citations to the source chunks

If content fails any stage of this pipeline, it cannot be cited. Each stage acts as an algorithmic filter that publishers must survive.

---

## Vector Embeddings (Semantic Layer)

Content is converted into high-dimensional numerical arrays, commonly 1,256 dimensions. These dense vectors capture semantic meaning, intent, and contextual relationships, not lexical keywords.

### Practical Implications

- An article about "employee retention strategies" maps near queries about "how to keep staff from quitting" even with zero shared keywords
- Polysemantic words like "Apple" the company vs "apple" the fruit are disambiguated by surrounding context vectors
- Content optimized for narrow single-keyword targeting will underperform versus content that builds a comprehensive entity cloud

### Optimization Principle: Entity Clouds

To maximize footprint in vector space, content must explore a deep constellation of related concepts, synonyms, and adjacent sub-topics. The wider the conceptual coverage, the higher the mathematical probability of intersecting with diverse user query vectors.

---

## Approximate Nearest Neighbor (ANN) Search

Pure K-Nearest Neighbor search is computationally prohibitive at billion-scale vector databases. Generative engines use ANN algorithms that trade a marginal accuracy loss for massive throughput.

Practical consequence: highly specific brand names, model numbers, or technical nomenclature may miss pure semantic matches. This is why engines combine semantic and lexical search.

---

## Hybrid Retrieval and Reciprocal Rank Fusion

Enterprise-grade generative engines run two parallel retrieval pipelines:

- **Dense semantic search**: Vector similarity, captures intent
- **Sparse lexical search (BM25)**: Exact keyword matching, captures precise terminology

Results from both are merged using **Reciprocal Rank Fusion (RRF)**, which mathematically prioritizes documents that rank highly across both methods.

### Implication

Content must satisfy both layers:
- Broad semantic coverage for intent matching
- Exact use of branded terms, product names, and technical vocabulary for lexical matching

A site that paraphrases its brand name or product names across pages weakens its lexical signal and risks losing the RRF advantage.

---

## Chunking: The Most Underrated Variable

Documents are segmented into smaller fragments called chunks before vectorization. Chunk size directly determines retrieval accuracy and citation likelihood.

### Chunk Size Mechanics

- **Too large**: spans multiple disparate topics, introduces semantic noise, dilutes overall vector score
- **Too small**: loses surrounding context required for LLM comprehension
- **Empirical sweet spot**: **200-400 words**, self-contained, semantically cohesive

### The 2.3x Citation Multiplier

Content formatted into self-contained, semantically cohesive blocks of 200-400 words receives **2.3 times more AI citations** than poorly segmented text.

### Hierarchical Chunking

Advanced RAG implementations nest small "child" chunks inside larger "parent" chunks:

- Semantic search runs against the granular child chunks for precision
- Once a match is identified, the system substitutes the parent chunk before passing to the LLM, preserving context

Publisher implication: structure content so that small blocks are highly specific AND surrounding sections enrich them with broader context.

### The "Scrambled Eggs" Failure Mode

Naive HTML parsing (stripping tags, flattening text) destroys document integrity. Headers blend into body copy. Tables become illegible token soup. This downstream causes hallucinations.

Mitigation: explicit semantic HTML with hierarchical H1/H2/H3 and clean paragraph boundaries. Semantic HTML acts as an explicit roadmap for the chunking algorithm.

---

## Anthropic Contextual Retrieval

Source: Anthropic (2024). Algorithmic breakthrough addressing the context-loss problem inherent in standard RAG.

### The Problem

In traditional RAG, an isolated chunk like "Revenue grew by 14% to $2.1 billion" loses critical metadata: whose revenue, and when?

### The Solution

Contextual Retrieval prepends auto-generated metadata to each chunk before embedding. A secondary LLM (such as Claude Haiku) writes a brief, situating description for every chunk:

```
"This chunk is from Acme Corp's Q2 2023 SEC financial filing regarding 
earnings: Revenue grew by 14% to $2.1 billion."
```

This produces Contextual Embeddings and Contextual BM25 representations.

### Documented Impact

**67% reduction in failed retrievals** when combined with Contextual Embeddings, Contextual BM25, and a reranking step.

### Publisher Implication: Density of Clarity

Pronouns and vague references at the start of paragraphs are algorithmic hazards. Every section of a webpage must be atomic, restating subject, brand name, and entity explicitly so that any extracted chunk retains self-evident meaning when isolated.

---

## Query Fan-Out (Decomposition)

Generative engines decompose complex, conversational, multi-intent queries into multiple sub-queries before retrieval.

### Example Decomposition

User query: "What are the best enterprise CRM software solutions for fintech startups under $50,000 with advanced API capabilities?"

System decomposes into:

1. Top enterprise CRM solutions by market share
2. CRM solutions tailored for fintech industry
3. Pricing models and total cost of ownership under $50,000
4. CRM systems with robust REST API architectures

RAG retrieves candidates for each sub-query independently, then merges results via Reciprocal Rank Fusion.

### Citation Impact of Fan-Out Coverage

Source: Surfer SEO study, 173,902 URLs across 10,000 keywords.

- Ranking for multiple fan-out sub-queries increases citation odds by **+161%** versus head-term-only pages
- Pages addressing main query AND fan-out variants capture **51% of all AI citations**
- Pages addressing only the head term capture **less than 20%** of citations

### The Volatility Constraint

Only **27% of fan-out sub-queries remain consistent** across repeated runs of the same search. The decomposition is stochastic and personalized.

### Strategic Implication

Do not attempt to optimize for individual, specific fan-out keywords. The variance is too high. Instead, build **hub-and-spoke topic clusters** and dense pillar pages that proactively anticipate a broad constellation of adjacent intents. This ensures the document intersects with whichever decomposition path the engine takes.

---

## How to Reference This Module in a Report

Use these inline anchor tags:

- `[research: 01-rag-mechanics.md §vector-embeddings]`
- `[research: 01-rag-mechanics.md §chunking-2-3x-multiplier]`
- `[research: 01-rag-mechanics.md §anthropic-contextual-retrieval]`
- `[research: 01-rag-mechanics.md §query-fan-out-161-percent]`
