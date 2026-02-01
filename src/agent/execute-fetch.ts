import fs from "node:fs";
import path from "node:path";
import type { gmail_v1 } from "googleapis";
import type { Plan } from "./plan-schema";
import { fetchFullMessage, fetchThread } from "../gmail/full";
import { compactFullMessage } from "../gmail/compact";
import { envBool } from "../infra/env";

const BATCH_SIZE = 5;

export async function executeFetchStage(gmail: gmail_v1.Gmail, plan: Plan) {
  const baseDir = path.join(process.cwd(), "output", "runs", plan.run_id);
  const storeRawFull = envBool("STORE_RAW_FULL", false);

  const fullDir = path.join(baseDir, "full");
  const fullCompactDir = path.join(baseDir, "full-compact");
  const threadDir = path.join(baseDir, "thread");

  if (storeRawFull) fs.mkdirSync(fullDir, { recursive: true });
  fs.mkdirSync(fullCompactDir, { recursive: true });
  fs.mkdirSync(threadDir, { recursive: true });

  const targets = plan.items.filter(
    (it) => (it.priority === "P0" || it.priority === "P1") && it.fetch && it.fetch !== "none"
  );

  const fetched: Array<{ id: string; kind: string; outPath: string }> = [];

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (it) => {
        if (it.fetch === "thread" && it.threadId) {
          const data = await fetchThread(gmail, it.threadId);
          const outPath = path.join(threadDir, `${it.threadId}.json`);
          fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
          return { id: it.id, kind: "thread", outPath } as const;
        }

        // Default to full_message
        const data = await fetchFullMessage(gmail, it.id);

        // Persist compacted version (preferred for downstream model input)
        const compacted = compactFullMessage(data);
        const outPath = path.join(fullCompactDir, `${it.id}.compact.json`);
        fs.writeFileSync(outPath, JSON.stringify(compacted, null, 2));

        // Optionally persist raw full message (debug only; contains more sensitive data)
        if (storeRawFull) {
          const rawPath = path.join(fullDir, `${it.id}.json`);
          fs.writeFileSync(rawPath, JSON.stringify(data, null, 2));
        }

        return { id: it.id, kind: "full_message_compact", outPath } as const;
      }),
    );

    fetched.push(...results);
  }

  fs.writeFileSync(path.join(baseDir, "fetched.json"), JSON.stringify(fetched, null, 2));

  return { baseDir, fetchedCount: fetched.length, fetched };
}
