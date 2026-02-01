# PROGRESS.md — huluwa-agent

> Purpose: give a decision-maker enough context to decide whether to keep/rollback/extend an idea.
>
> **Rule:** every meaningful change leaves a breadcrumb here.
>
> **Entry template (copy/paste):**
>
> - **YYYY-MM-DD HH:MM** — **<Title>**
>   - **Why:** <problem / goal>
>   - **Change:** <what changed, files touched>
>   - **Impact:** <what behavior changes / outputs change>
>   - **Risk:** <security / privacy / reliability / cost>
>   - **Mitigation:** <how we reduced risk (flags, defaults, caps)>
>   - **Verify:** <command + expected outputs>
>   - **Rollback:** <how to revert / disable>
>   - **Notes:** <optional>

---

## 2026-01-31

- **2026-01-31 00:xx** — **Bootstrap TS demo + Gmail OAuth + unread fetch**
  - **Why:** establish a local-first pipeline to read unread Gmail.
  - **Change:** added `src/gmail/client.ts`, `src/gmail/unread.ts`, `src/cli.ts` plus deps.
  - **Impact:** `npm run demo:gmail` can authorize + fetch unread metadata.
  - **Risk:** token storage on disk.
  - **Mitigation:** store secrets under `.secrets/` + `.gitignore`.
  - **Verify:** `npm run demo:gmail` → creates/uses `.secrets/token.json` and writes `output/*`.
  - **Rollback:** delete `.secrets/token.json` and remove gmail modules.

- **2026-01-31 00:xx** — **Plan generation (JSON + Markdown)**
  - **Why:** turn unread emails into an actionable triage plan.
  - **Change:** added plan schema/renderer + Claude Agent SDK `query()` integration.
  - **Impact:** produces `plan.json` (machine) + `plan.md` (human).
  - **Risk:** email metadata sent to Claude.
  - **Mitigation:** metadata-only (no full body) for stage-1.
  - **Verify:** `npm run demo:gmail` → `output/.../plan.json` + `plan.md`.
  - **Rollback:** disable plan stage or replace with local rules.

- **2026-01-31 00:xx** — **Fetch stage (read-only) for P0/P1 full messages**
  - **Why:** enable agent-like behavior (plan → gather more info → refine).
  - **Change:** added `src/gmail/full.ts`, `src/agent/execute-fetch.ts`.
  - **Impact:** downloads full content for selected items; does not change Gmail state.
  - **Risk:** sensitive content stored locally and/or sent to model.
  - **Mitigation:** scope to P0/P1; read-only.
  - **Verify:** run produces `fetched.json` and full payload files under run directory.
  - **Rollback:** skip fetch stage.

- **2026-01-31 00:xx** — **Refine stage (based on full content)**
  - **Why:** produce higher-quality actions using full email evidence.
  - **Change:** added `src/agent/refine.ts` + schema + renderer.
  - **Impact:** outputs `refined-plan.json` + `refined-plan.md`.
  - **Risk:** model sees more sensitive email content.
  - **Mitigation:** limited to P0/P1; later improved with compaction.
  - **Verify:** `npm run demo:gmail` → refined outputs in run folder.
  - **Rollback:** skip refine stage.

- **2026-01-31 08:47** — **Move legacy summarizer out of mainline**
  - **Why:** reduce confusion (two competing summarization paths).
  - **Change:** moved `src/agent/{summarize,render,schema}.ts` → `src/legacy/`.
  - **Impact:** mainline is plan→fetch→refine.
  - **Risk:** low.
  - **Mitigation:** kept legacy files for reference.
  - **Verify:** `npm run demo:gmail` succeeds.
  - **Rollback:** move files back.

- **2026-01-31 08:51–08:54** — **Output layout: runs/ + latest/ + legacy/**
  - **Why:** stop overwriting outputs; make it easy to inspect latest run.
  - **Change:** CLI now writes per-run to `output/runs/<run_id>/...` and mirrors to `output/latest/...`; moved old top-level outputs to `output/legacy/`.
  - **Impact:** stable run history; easier debugging.
  - **Risk:** path changes could break external scripts.
  - **Mitigation:** keep `latest/` stable as integration point.
  - **Verify:** `npm run demo:gmail` → new `output/runs/<run_id>` + updated `output/latest/*`.
  - **Rollback:** revert CLI path changes.

- **2026-01-31 09:03** — **Store compact full-message artifacts (full-compact/)**
  - **Why:** reduce token bloat and limit sensitive data exposure.
  - **Change:** added `src/gmail/compact.ts`; fetch stage writes `full-compact/*.compact.json` and `fetched.json` points to compact.
  - **Impact:** refine stage can operate on compact payloads.
  - **Risk:** compaction may drop info needed for certain emails.
  - **Mitigation:** keep important headers + plain/html text (capped) + attachment list.
  - **Verify:** run folder includes `full-compact/` and `fetched.json` kind=`full_message_compact`.
  - **Rollback:** point fetched.json back to raw full.

- **2026-01-31 09:05–09:08** — **LLM adapter layer (prep for Ollama)**
  - **Why:** make LLM backend swappable (Claude ↔ Ollama) without touching business logic.
  - **Change:** added `src/llm/*`; `plan.ts/refine.ts` use adapter.
  - **Impact:** central place to change model/provider behavior.
  - **Risk:** low (refactor).
  - **Mitigation:** verified via full pipeline run.
  - **Verify:** `npm run demo:gmail` succeeds; outputs generated.
  - **Rollback:** inline previous query/parse logic.

- **2026-01-31 09:21–09:22** — **Default privacy: do NOT store raw full-message JSON**
  - **Why:** raw Gmail full payload is sensitive; minimize local retention.
  - **Change:** added `STORE_RAW_FULL` (default false) + `src/infra/env.ts`; fetch stage only writes `full-compact/` unless flag enabled.
  - **Impact:** run folders usually have no `full/` directory.
  - **Risk:** reduced debug visibility.
  - **Mitigation:** opt-in flag for debugging.
  - **Verify:** new run → no `full/`, only `full-compact/`.
  - **Rollback:** set `STORE_RAW_FULL=true` or revert fetch stage.

- **2026-01-31 09:24** — **Idempotency control (skip already-processed message IDs)**
  - **Why:** avoid re-processing the same unread emails over and over (duplicate fetch/refine + repeated notifications).
  - **Change:** added state store `output/state.json` + filtering logic:
    - `src/state/store.ts` (load/save/markProcessed)
    - `src/state/idempotency.ts` (filterNewMessages)
    - `src/cli.ts` filters unread mails before planning
    - `.env.example` adds `IDEMPOTENCY=true`
  - **Impact:** by default, only *new* unread message IDs (not in `output/state.json`) are planned/fetched/refined.
  - **Risk:** a still-unread email might be skipped if it was processed once but still needs attention.
  - **Mitigation:** can disable via `IDEMPOTENCY=false` to re-run; future improvement: track "handled" separately from "seen".
  - **Verify:** run `npm run demo:gmail` → should write `output/state.json` and log `Unread after idempotency filter: X`.
  - **Rollback:** set `IDEMPOTENCY=false` or remove `src/state/*` + revert CLI filtering.

- **2026-01-31 10:xx** — **Idempotency observability (operator-facing explanation)**
  - **Why:** make it obvious *why* a run did nothing (skipped as already-seen), without needing to read code.
  - **Change:**
    - `output/latest/idempotency.md` is written when `processed_this_run=0`
    - CLI logs now include `skipped=<n>`
    - `src/state/store.ts` adds `stats` (updatedAt, processedCount)
  - **Impact:** decision-makers can quickly see if a run skipped due to idempotency and how to override.
  - **Risk:** low.
  - **Mitigation:** file contains only counts + instructions (no email content).
  - **Verify:** rerun `npm run demo:gmail` after state exists → `output/latest/idempotency.md` appears.
  - **Rollback:** remove idempotency.md generation + stats fields.

- **2026-01-31 10:xx** — **State operator commands (show/reset)**
  - **Why:** make it easy to inspect/reset idempotency state during debugging and iteration.
  - **Change:**
    - `src/state/show.ts` + npm script `state:show`
    - `src/state/reset.ts` + npm script `state:reset`
  - **Impact:** quick visibility and reset of `output/state.json` without manual file editing.
  - **Risk:** accidental reset could cause re-processing.
  - **Mitigation:** reset is explicit, separate command.
  - **Verify:** `npm run state:show` / `npm run state:reset`.
  - **Rollback:** remove scripts and files.

---

- **2026-01-31 10:15** — **Project cleanup + README**
  - **Why:** reduce noise (old runs/old code) and provide a clear entry point for new readers.
  - **Change:**
    - Archived prior run folders under `output/archive/<timestamp>/...` and reset `output/latest/`
    - Removed legacy summarizer code from the main tree (previously in `src/legacy/`)
    - Added `README.md` with capabilities + quickstart + security notes
  - **Impact:** repo is easier to navigate; default output folder is clean.
  - **Risk:** removing run history can hide debugging evidence.
  - **Mitigation:** archived instead of hard-deleting (under `output/archive/`).
  - **Verify:** `ls output` shows only `archive/` + fresh `latest/`; `cat README.md` exists.
  - **Rollback:** restore archived folders from `output/archive/<timestamp>/`.

---

## Pending / ideas

- Switch planning/refine LLM from Claude to local Ollama to avoid off-device email leakage (see `TODO.md`).
- Improve idempotency semantics: separate "seen" vs "handled" vs "still-unread".
- Add cron schedule (L2) once mainline definition is agreed.
