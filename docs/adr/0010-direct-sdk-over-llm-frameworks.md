# ADR-0010: Direct Anthropic SDK over LLM frameworks

- **Status**: Accepted
- **Date**: 2026-07-23

## Context

Phase 6 added a single LLM call: classify a maintenance request into a category and urgency ([ADR-0006](0006-llm-triage.md)). The obvious question — and a fair one to ask of anyone who has worked in this space — is why not reach for the popular LLM tooling: **LangChain** (provider abstraction, chains, RAG), **LangGraph** (stateful multi-step agent orchestration), **Langfuse** (LLM observability, tracing, evals). This ADR records the deliberate choice to use the plain Anthropic SDK, and the specific conditions under which each of those tools *would* earn its place — so the decision is a judgment, not an omission.

## Decisions

### LangChain — rejected: it abstracts a seam the code already owns

LangChain earns its weight when you compose multi-step pipelines, swap providers behind one interface, or build RAG. PropFlow's triage is **one structured-output call**. Provider-swappability — the headline reason people reach for LangChain — already exists here as the `TriageClassifier` abstraction: the [GCP study](../gcp.md) shows swapping Anthropic for Claude-on-Vertex is a one-class change. LangChain would replace a thirty-line domain seam with a framework dependency and a second abstraction on top, in an ecosystem where the TypeScript port trails the Python one. It would add surface area and remove nothing.

### LangGraph — rejected: there is no graph

LangGraph models agentic workflows: nodes, cycles, tool-use loops, human-in-the-loop, state carried across steps. Triage is deterministic and single-step — classify, then store. There is no loop, no tool call, no agent, no state machine *in the LLM interaction* (the work-order state machine is domain logic, unrelated). Adding LangGraph would be solving a problem the system does not have, which is over-engineering whatever the library's quality.

### Langfuse — deferred, not rejected: the right category, not yet the right time

Langfuse is different in kind — it is **observability for LLM calls** (per-call tracing, cost, latency, prompt versioning, evals), and that category genuinely fits. The gap it fills is already documented as an honest limitation: the [phase-6 notes](../notes/phase-6-ai-triage.md) call out "no eval harness," and [ADR-0005](0005-observability-stack.md) names tracing as the deferred next step. But at one best-effort call per work order, the existing observability (structured logs with the correlation id, the classification stored on the row for audit) is sufficient. Langfuse is the correct tool the moment triage volume, cost, or decision-criticality grows — it does not need to be present to be the planned answer.

### The principle: match the tool to the use case, not to the résumé

Every one of these tools is good at what it does; none of them matches a single structured-output classification behind a clean seam. Reaching for them here would be adopting complexity speculatively — the same anti-pattern the [outbox](0007-outbox-pattern.md) and [auth](0008-authentication.md) ADRs avoid on the infrastructure side, applied to the AI side.

## Consequences

- The AI integration stays one class (`AnthropicTriageClassifier`) behind one abstraction (`TriageClassifier`), fully unit-tested, provider-portable, with no framework in the dependency tree.
- The upgrade path is explicit rather than pre-built: **LangGraph** if triage becomes agentic (multi-step reasoning, tool-use, retrieval before classifying); **Langfuse** if LLM observability, prompt versioning or systematic evals become load-bearing; **LangChain** essentially never for this shape of problem — its value is in composition this system doesn't need.
- Honest limitation: this is the right call *for a single classification*. A product that grew several LLM features with shared prompt management, evals and cross-provider routing would re-open LangChain/Langfuse deliberately — the decision is scoped to the current use case, not a blanket position against the tools.
