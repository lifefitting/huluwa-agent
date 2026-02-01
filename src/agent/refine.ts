import fs from "node:fs";
import path from "node:path";
import type { gmail_v1 } from "googleapis";
import type { Plan } from "./plan-schema";
import { RefinedPlanSchema, type RefinedPlan } from "./refine-schema";
import { compactFullMessage } from "../gmail/compact";
import { runClaudeQuery, safeJsonParseLenient } from "../llm";
import { makeRunId } from "../infra/runid";
import { ERWA_PERSONA } from "../brothers/personas/erwa";

export async function refineWithFull(params: { baseDir: string; plan: Plan }) {
  const { baseDir, plan } = params;

  const fetchedPath = path.join(baseDir, "fetched.json");
  const fetched = JSON.parse(fs.readFileSync(fetchedPath, "utf8")) as Array<{ id: string; kind: string; outPath: string }>;

  const fullDocs: Array<{ id: string; kind: string; data: unknown }> = [];
  for (const f of fetched) {
    const raw = fs.readFileSync(f.outPath, "utf8");
    const parsed = JSON.parse(raw);

    // fetched.json now points to already-compacted payloads for full messages.
    // Keep a fallback just in case we encounter legacy runs.
    const compacted = f.kind === "full_message"
      ? compactFullMessage(parsed as gmail_v1.Schema$Message)
      : parsed;
    fullDocs.push({ id: f.id, kind: f.kind, data: compacted });
  }

  const now = new Date();
  const run_id = makeRunId(now);
  const generated_at = now.toISOString();

  const prompt = `${ERWA_PERSONA}\n---\n\n我会给你：\n1) 第一阶段处理计划（plan.json）\n2) 对其中 P0/P1 邮件抓取到的 Gmail full message JSON（可能包含 headers、snippet、payload 等）\n\n任务：\n- 基于"全文信息"，生成二阶段处理计划（RefinedPlan），要求更具体、更可执行、避免不必要动作。\n- 不要做任何真实执行，只输出计划。\n\n输出要求：\n- 只输出一个 JSON 对象（不要 markdown、不要代码块）。\n- actions 里每条必须有：priority、title、why、steps（1-6条）。\n- requires_confirmation 默认 true（所有会改变邮箱状态/发送消息/删除的动作都必须 true；只读检查也可以 true）。\n\nRefinedPlan JSON 结构：\n{\n  \"run_id\": string,\n  \"based_on_run_id\": string,\n  \"generated_at\": string,\n  \"summary\": string[],\n  \"actions\": [ { \"id\": string, \"priority\": \"P0\"|\"P1\"|\"P2\", \"title\": string, \"why\": string, \"steps\": string[], \"requires_confirmation\": boolean } ],\n  \"notes\": string[] (可选)\n}\n\n输入：\n- based_on_plan: ${JSON.stringify(plan, null, 2)}\n- full_messages: ${JSON.stringify(fullDocs, null, 2)}\n- based_on_run_id: ${plan.run_id}\n- new_run_id: ${run_id}\n- generated_at: ${generated_at}\n`;

  const resultText = await runClaudeQuery(prompt);

  const parsedJson = safeJsonParseLenient(resultText);
  const parsed = RefinedPlanSchema.safeParse(parsedJson);
  if (!parsed.success) {
    fs.writeFileSync(path.join(baseDir, "refined.raw.txt"), resultText);
    throw new Error(`Invalid refined plan JSON: ${parsed.error.message} (raw saved to refined.raw.txt)`);
  }

  // Normalize metadata
  const refined: RefinedPlan = {
    ...parsed.data,
    run_id: parsed.data.run_id || run_id,
    based_on_run_id: parsed.data.based_on_run_id || plan.run_id,
    generated_at: parsed.data.generated_at || generated_at,
  };

  return refined;
}

// JSON parsing moved to src/llm/json.ts
