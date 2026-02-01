import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const StateSchema = z.object({
  version: z.literal(1),
  processedMessageIds: z.record(
    z.string(),
    z.object({
      firstSeenAt: z.string(),
      lastSeenAt: z.string(),
      lastRunId: z.string(),
    }),
  ),
  stats: z
    .object({
      updatedAt: z.string(),
      processedCount: z.number(),
    })
    .optional(),
});

export type State = z.infer<typeof StateSchema>;

const DEFAULT_STATE: State = {
  version: 1,
  processedMessageIds: {},
  stats: { updatedAt: new Date(0).toISOString(), processedCount: 0 },
};

export function statePath() {
  return path.join(process.cwd(), "output", "state.json");
}

export function loadState(): State {
  const p = statePath();
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = StateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return DEFAULT_STATE;

    // normalize stats
    if (!parsed.data.stats) {
      parsed.data.stats = {
        updatedAt: new Date(0).toISOString(),
        processedCount: Object.keys(parsed.data.processedMessageIds ?? {}).length,
      };
    }

    return parsed.data;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: State, nowIso = new Date().toISOString()) {
  // keep stats current
  state.stats = {
    updatedAt: nowIso,
    processedCount: Object.keys(state.processedMessageIds ?? {}).length,
  };

  const p = statePath();
  const tmpPath = p + ".tmp";
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  fs.renameSync(tmpPath, p);
}

export function markProcessed(state: State, messageIds: string[], runId: string, nowIso = new Date().toISOString()) {
  for (const id of messageIds) {
    const prev = state.processedMessageIds[id];
    state.processedMessageIds[id] = {
      firstSeenAt: prev?.firstSeenAt ?? nowIso,
      lastSeenAt: nowIso,
      lastRunId: runId,
    };
  }

  // stats will be updated by saveState()
}
