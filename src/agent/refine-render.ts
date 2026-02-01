import type { RefinedPlan } from "./refine-schema";

export function renderRefinedMarkdown(plan: RefinedPlan) {
  const lines: string[] = [];
  lines.push(`# 二阶段处理计划（基于全文）`);
  lines.push("");
  lines.push(`- run_id: \`${plan.run_id}\``);
  lines.push(`- based_on_run_id: \`${plan.based_on_run_id}\``);
  lines.push(`- generated_at: \`${plan.generated_at}\``);
  lines.push("");

  lines.push(`## 二阶段总览`);
  for (const s of plan.summary) lines.push(`- ${s}`);
  lines.push("");

  const groups: Array<["P0" | "P1" | "P2", string]> = [
    ["P0", "P0（立刻）"],
    ["P1", "P1（尽快）"],
    ["P2", "P2（稍后）"],
  ];

  for (const [p, title] of groups) {
    const items = plan.actions.filter((a) => a.priority === p);
    if (!items.length) continue;
    lines.push(`## ${title}`);
    for (const a of items) {
      lines.push(`- **${a.title}** (id: \`${a.id}\`)`);
      lines.push(`  - 原因: ${a.why}`);
      lines.push(`  - 步骤:`);
      for (const step of a.steps) lines.push(`    - ${step}`);
      lines.push(`  - 需要确认: ${a.requires_confirmation ? "是" : "否"}`);
    }
    lines.push("");
  }

  if (plan.notes?.length) {
    lines.push(`## 备注`);
    for (const n of plan.notes) lines.push(`- ${n}`);
    lines.push("");
  }

  return lines.join("\n");
}
