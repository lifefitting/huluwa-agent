import type { Plan } from "./plan-schema";

export function renderPlanMarkdown(plan: Plan) {
  const lines: string[] = [];

  lines.push(`# Gmail 未读处理计划`);
  lines.push("");
  lines.push(`- run_id: \`${plan.run_id}\``);
  lines.push(`- generated_at: \`${plan.generated_at}\``);
  lines.push(`- query: \`${plan.query.gmail_query}\``);
  lines.push(`- max_results: **${plan.query.max_results}**`);
  lines.push(
    `- counts: total=${plan.counts.total}, P0=${plan.counts.p0}, P1=${plan.counts.p1}, P2=${plan.counts.p2}`
  );
  lines.push("");

  const groups: Array<["P0" | "P1" | "P2", string]> = [
    ["P0", "需要立刻关注"],
    ["P1", "需要处理"],
    ["P2", "可稍后"],
  ];

  for (const [p, title] of groups) {
    const items = plan.items.filter((x) => x.priority === p);
    if (!items.length) continue;

    lines.push(`## ${title} (${p})`);
    for (const it of items) {
      const header = [it.subject ?? "(无标题)", it.from, it.date].filter(Boolean).join(" — ");
      lines.push(`- **${header}**`);

      const idLine = `  - id: \`${it.id}\`` + (it.threadId ? ` threadId: \`${it.threadId}\`` : "");
      lines.push(idLine);

      lines.push(`  - 原因: ${it.reason}`);
      lines.push(`  - 后续动作:`);
      for (const s of it.next_steps) lines.push(`    - ${s}`);
      if (it.fetch && it.fetch !== "none") lines.push(`  - 需要进一步抓取: **${it.fetch}**`);
    }
    lines.push("");
  }

  if (plan.notes?.length) {
    lines.push("## 备注");
    for (const n of plan.notes) lines.push(`- ${n}`);
    lines.push("");
  }

  return lines.join("\n");
}
