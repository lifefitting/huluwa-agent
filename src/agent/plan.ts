import fs from "node:fs";
import type { MailItem } from "../types";
import { PlanSchema, type Plan } from "./plan-schema";
import { runClaudeQuery, safeJsonParseLenient } from "../llm";
import { makeRunId } from "../infra/runid";

export async function generatePlan(params: { mails: MailItem[]; gmailQuery: string; maxResults: number }): Promise<Plan> {
  const { mails, gmailQuery, maxResults } = params;

  const now = new Date();
  const run_id = makeRunId(now);
  const generated_at = now.toISOString();

  // Keep inputs compact-ish for stability.
  const compactMails = mails.map((m) => ({
    id: m.id,
    threadId: m.threadId,
    from: m.from,
    subject: m.subject,
    date: m.date,
    // snippet can be long; keep it but cap length.
    snippet: m.snippet ? m.snippet.slice(0, 400) : undefined,
    labels: m.labels,
  }));

  const prompt = `你是一个严谨的邮件助理。\n\n我会给你 Gmail 未读邮件的元信息 JSON（不是全文）。你需要产出"处理计划"，用于后续自动化执行。\n\n只输出一个 JSON 对象（不要 markdown、不要代码块）。JSON 顶层必须包含以下字段：\n\n{\n  \"run_id\": string,\n  \"generated_at\": string,\n  \"query\": { \"gmail_query\": string, \"max_results\": number },\n  \"counts\": { \"total\": number, \"p0\": number, \"p1\": number, \"p2\": number },\n  \"items\": [ ... ],\n  \"notes\": string[] (可选)\n}\n\nitems 中每个元素：\n{\n  \"priority\": \"P0\"|\"P1\"|\"P2\",\n  \"id\": string,\n  \"threadId\": string (可选),\n  \"from\": string (可选),\n  \"subject\": string (可选),\n  \"date\": string (可选),\n  \"reason\": string,\n  \"next_steps\": string[1..3],\n  \"fetch\": \"none\"|\"thread\"|\"full_message\"\n}\n\n硬性要求：\n- 不能编造：items 里的 id/threadId/from/subject/date 必须来自输入 JSON。\n- reason 必须引用 subject/snippet 的证据（关键词或简述）。\n- counts 必须与 items 中的优先级数量一致。\n\n优先级规则：\n- P0：账号安全/付款/当日截止/客户紧急\n- P1：需要处理但不立刻\n- P2：通知/订阅/推广\n\n运行上下文：\n- gmail_query: ${gmailQuery}\n- max_results: ${maxResults}\n- run_id: ${run_id}\n- generated_at: ${generated_at}\n\n输入邮件 JSON：\n${JSON.stringify(compactMails, null, 2)}\n`;

  let resultText = "";
  try {
    resultText = await runClaudeQuery(prompt);
  } catch (e) {
    // Persist raw output for debugging
    try {
      fs.mkdirSync("output", { recursive: true });
      fs.writeFileSync("output/plan.raw.txt", resultText);
    } catch {
      // ignore
    }
    throw e;
  }

  const parsedJson = safeJsonParseLenient(resultText);
  const parsed = PlanSchema.safeParse(parsedJson);
  if (!parsed.success) {
    // Persist raw output for debugging
    try {
      fs.writeFileSync("output/plan.raw.txt", resultText);
    } catch {
      // ignore
    }
    throw new Error(`Invalid plan JSON: ${parsed.error.message}\nRaw saved to output/plan.raw.txt`);
  }

  // Trust-but-verify counts
  const counts = {
    total: parsed.data.items.length,
    p0: parsed.data.items.filter((x) => x.priority === "P0").length,
    p1: parsed.data.items.filter((x) => x.priority === "P1").length,
    p2: parsed.data.items.filter((x) => x.priority === "P2").length,
  };
  const mismatch =
    counts.total !== parsed.data.counts.total ||
    counts.p0 !== parsed.data.counts.p0 ||
    counts.p1 !== parsed.data.counts.p1 ||
    counts.p2 !== parsed.data.counts.p2;

  if (mismatch) {
    // Normalize counts to avoid downstream confusion.
    return { ...parsed.data, counts };
  }

  return parsed.data;
}

// JSON parsing moved to src/llm/json.ts
