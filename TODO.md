# TODO (huluwa-agent)

## Security (priority)
- [ ] **Switch summarization/planning from Claude to local Ollama** to avoid leaking sensitive email content off-device.
  - Scope: replace `@anthropic-ai/claude-agent-sdk` usage in:
    - `src/agent/plan.ts`
    - `src/agent/refine.ts`
  - Keep: Gmail OAuth + unread fetch + full fetch pipeline.
  - Add: local pre-processing / redaction before any model call (even local), and size limits for full message payload.
  - Optional: Claude as fallback, default disabled.

## Mainline completion checklist
- [x] Gmail local OAuth (credentials + token) works
- [x] Fetch unread metadata → `output/unread.json`
- [x] Generate plan → `output/plan.json` + `output/plan.md`
- [x] Fetch full content for P0/P1 based on plan → `output/<run_id>/full/*.json` + `fetched.json`
- [x] Refine plan + summary based on full content → `output/<run_id>/refined-plan.json` + `refined-plan.md`

