# Research Notes: Transformer Architecture

## Key Concepts

The transformer architecture was introduced in "Attention Is All You Need" (Vaswani et al., 2017).

### Self-Attention Mechanism
- Computes attention weights across all positions in a sequence
- Scales as O(n²) with sequence length
- Multi-head attention allows the model to attend to different representation subspaces

### Key People
- **Ashish Vaswani** — lead author at Google Brain
- **Jakob Uszkoreit** — co-author, later founded Inceptive
- **Ilya Sutskever** — applied transformers to GPT at OpenAI

## Open Questions
1. Can we achieve sub-quadratic attention without losing quality?
2. What is the relationship between scale and emergent capabilities?
3. Does the "bitter lesson" (Rich Sutton) fully explain transformer success?

## Hypotheses
- **Scaling hypothesis**: Performance improves predictably with compute, data, and parameters
- **Emergent capabilities**: Some abilities appear discontinuously at certain scales
- These two hypotheses may be in tension — smooth scaling vs. sudden emergence

## Events
- 2017: Original transformer paper published
- 2018: BERT released by Google
- 2020: GPT-3 demonstrates few-shot learning
- 2022: ChatGPT launches, reaching 100M users in 2 months

> "The key insight is that attention can replace recurrence entirely." — Vaswani et al.
