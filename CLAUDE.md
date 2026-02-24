# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run demo:gmail      # Run main Gmail triage pipeline
bun run demo:feishu     # Run Feishu/Lark meeting minutes demo
bun run state:show      # Display current idempotency state
bun run state:reset     # Clear processed message history
```

No build step is needed — bun executes TypeScript directly. There are no test or lint scripts defined yet.

## Architecture

This is a multi-agent autonomous pipeline for email triage, built around a Chinese folklore theme ("葫芦兄弟" / Gourd Brothers). Each "brother" is an AI agent with a distinct persona and role.

### Current Pipeline (Phase 0 MVP)

The main entry point is `src/cli.ts`. On each run it executes these sequential stages:

1. **Gmail OAuth + fetch unread metadata** (`src/gmail/`) — read-only scope
2. **Idempotency filter** (`src/state/idempotency.ts`) — skip already-seen message IDs via `output/state.json`
3. **Plan generation** (`src/agent/plan.ts`) — LLM call with 二娃 persona; classifies emails P0/P1/P2 and emits fetch hints
4. **Evidence fetch** (`src/agent/execute-fetch.ts`) — fetches full bodies for P0/P1 items only, compacted to ~8KB each
5. **Refine plan** (`src/agent/refine.ts`) — second LLM call incorporating the evidence
6. **Persist state** — writes to `output/runs/<run_id>/` and mirrors to `output/latest/`

### Key Design Patterns

**Schema-first LLM outputs:** All LLM outputs are validated via Zod schemas (`src/agent/plan-schema.ts`, `src/agent/refine-schema.ts`). New agent stages should follow this pattern.

**Persona injection:** `src/brothers/personas/erwa.ts` defines the 二娃 system prompt. Future brothers go in `src/brothers/personas/`. The persona shapes LLM behavior — 二娃 is conservative and evidence-driven.

**LLM abstraction:** Use `src/llm/claude.ts` (`runClaudeQuery`) for all LLM calls. This is the swap point for local Ollama (a planned TODO) — don't call the Anthropic SDK directly from business logic.

**Output layout:** Each run produces an immutable directory `output/runs/<run_id>/` plus a `output/latest/` mirror. Do not break this layout — downstream tooling reads `latest/`.

**Configuration hierarchy:** `~/.config/huluwa-agent/.env` (user secrets) → project `.env` → `process.env`. Gmail OAuth credentials live at `~/.config/huluwa-agent/credentials.json` (never in the repo).

### Planned Multi-Agent Architecture (Phases 1–5)

See `docs/architecture.md` for the full design. The intended brothers:
- **大娃 (Da-wa)**: Orchestrator — coordinates agents via DAG plans
- **二娃 (Er-wa)**: Information gatherer — Gmail, Feishu, Slack, RSS *(partially implemented)*
- **三娃 (San-wa)**: Security gate — PII redaction, confirmation before writes
- **四娃 (Si-wa)**: Executor — draft creation, labels, replies *(requires 三娃 gate)*
- **五娃 (Wu-wa)**: Transformer — summarize, translate, deduplicate
- **六娃 (Liu-wa)**: Scheduler — cron/event triggers
- **七娃 (Qi-wa)**: Memory — semantic search, RAG

The pipeline is currently **read-only**. Any future write operations must pass through a 三娃 confirmation gate.

### Module Map

| Path | Role |
|------|------|
| `src/cli.ts` | Main entry point and pipeline orchestration |
| `src/agent/` | LLM plan/refine stages + fetch orchestration |
| `src/brothers/personas/` | Agent system prompts |
| `src/gmail/` | Gmail API client and data compaction |
| `src/feishu/` | Lark/Feishu API client (not yet in main pipeline) |
| `src/llm/` | LLM adapter layer (Claude SDK wrapper) |
| `src/state/` | Idempotency store + CLI state commands |
| `src/infra/` | Shared utilities: env parsing, retry, run IDs |
| `src/types.ts` | Shared TypeScript types |
