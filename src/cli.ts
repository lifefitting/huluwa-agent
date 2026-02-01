import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

import { getGmailClient } from "./gmail/client";
import { listUnreadMetadata } from "./gmail/unread";
import { generatePlan } from "./agent/plan";
import { renderPlanMarkdown } from "./agent/plan-render";
import { executeFetchStage } from "./agent/execute-fetch";
import { refineWithFull } from "./agent/refine";
import { renderRefinedMarkdown } from "./agent/refine-render";
import { filterNewMessages } from "./state/idempotency";
import { loadState, saveState, markProcessed } from "./state/store";

// Graceful shutdown on SIGINT
let shuttingDown = false;
process.on("SIGINT", () => {
  if (shuttingDown) {
    console.log("\n[demo] Force exit.");
    process.exit(1);
  }
  shuttingDown = true;
  console.log("\n[demo] Caught SIGINT, shutting down gracefully (press Ctrl+C again to force)…");
  setTimeout(() => {
    console.log("[demo] Grace period expired, exiting.");
    process.exit(1);
  }, 5000);
});

async function main() {
  const q =
    process.env.GMAIL_QUERY ??
    "is:unread in:inbox newer_than:7d -category:promotions -category:social";
  const rawMax = Number(process.env.GMAIL_MAX_RESULTS ?? 20);
  const maxResults = Number.isNaN(rawMax) ? 20 : rawMax;

  console.log(`[demo] Gmail query: ${q}`);
  console.log(`[demo] maxResults: ${maxResults}`);

  console.log(`[demo] Initializing Gmail client (OAuth)…`);
  const gmail = await getGmailClient();

  console.log(`[demo] Fetching unread metadata…`);
  const mailsAll = await listUnreadMetadata(gmail, { q, maxResults });
  console.log(`[demo] Unread fetched (raw): ${mailsAll.length}`);

  const newIds = new Set(filterNewMessages(mailsAll.map((m) => m.id)));
  const mails = mailsAll.filter((m) => newIds.has(m.id));
  const skipped = mailsAll.length - mails.length;
  console.log(`[demo] Unread after idempotency filter: ${mails.length} (skipped=${skipped})`);

  const outRoot = path.join(process.cwd(), "output");
  const runsRoot = path.join(outRoot, "runs");
  const latestRoot = path.join(outRoot, "latest");

  fs.mkdirSync(runsRoot, { recursive: true });
  fs.mkdirSync(latestRoot, { recursive: true });

  // Note: per-run directory is created after we have plan.run_id
  fs.writeFileSync(path.join(latestRoot, "unread.json"), JSON.stringify(mails, null, 2));

  if (mails.length === 0) {
    const md = "# Gmail 未读处理计划\n\n当前没有（或没有新的）匹配查询的未读邮件。\n";

    // Explain idempotency decision for operators/decision makers
    const idempo = `# Idempotency\n\n- raw_unread: ${mailsAll.length}\n- processed_this_run: 0\n- skipped_as_seen: ${skipped}\n\nIf you want to re-process all unread anyway, run with: \`IDEMPOTENCY=false npm run demo:gmail\`\n`;
    fs.writeFileSync(path.join(latestRoot, "idempotency.md"), idempo);

    fs.writeFileSync(path.join(latestRoot, "plan.md"), md);
    fs.writeFileSync(
      path.join(latestRoot, "plan.json"),
      JSON.stringify(
        {
          run_id: "(empty)",
          generated_at: new Date().toISOString(),
          query: { gmail_query: q, max_results: maxResults },
          counts: { total: 0, p0: 0, p1: 0, p2: 0 },
          items: [],
          notes: ["No (new) unread mails matched the query."],
        },
        null,
        2
      )
    );
    console.log(md);
    return;
  }

  console.log(`[demo] Generating plan with Claude Agent SDK…`);
  const plan = await generatePlan({ mails, gmailQuery: q, maxResults });

  const runDir = path.join(runsRoot, plan.run_id);
  fs.mkdirSync(runDir, { recursive: true });

  // Persist inputs/outputs per-run
  fs.writeFileSync(path.join(runDir, "unread.json"), JSON.stringify(mails, null, 2));
  fs.writeFileSync(path.join(runDir, "plan.json"), JSON.stringify(plan, null, 2));
  const planMd = renderPlanMarkdown(plan);
  fs.writeFileSync(path.join(runDir, "plan.md"), planMd);

  // Also keep a convenient latest/ mirror
  fs.writeFileSync(path.join(latestRoot, "plan.json"), JSON.stringify(plan, null, 2));
  fs.writeFileSync(path.join(latestRoot, "plan.md"), planMd);

  console.log(`Wrote ${path.join(runDir, "plan.json")} and plan.md (latest/ also updated)`);

  // Stage 2 (read-only execution): fetch full/thread content for P0/P1 items that request it.
  console.log(`[demo] Fetching full content for plan (P0/P1 only, read-only)…`);
  const fetchResult = await executeFetchStage(gmail, plan);
  console.log(`[demo] Fetch complete: ${fetchResult.fetchedCount} item(s). Saved under ${fetchResult.baseDir}`);

  console.log(`[demo] Refining plan + summary based on full content…`);
  const refined = await refineWithFull({ baseDir: fetchResult.baseDir, plan });
  fs.writeFileSync(path.join(fetchResult.baseDir, "refined-plan.json"), JSON.stringify(refined, null, 2));
  const refinedMd = renderRefinedMarkdown(refined);
  fs.writeFileSync(path.join(fetchResult.baseDir, "refined-plan.md"), refinedMd);

  // mirror refined outputs to latest/
  fs.writeFileSync(path.join(latestRoot, "refined-plan.json"), JSON.stringify(refined, null, 2));
  fs.writeFileSync(path.join(latestRoot, "refined-plan.md"), refinedMd);

  // update idempotency state: mark processed message IDs (from this run)
  const state = loadState();
  markProcessed(
    state,
    mails.map((m) => m.id),
    plan.run_id
  );
  saveState(state);

  console.log(`[demo] Wrote refined plan to ${path.join(fetchResult.baseDir, "refined-plan.json")} (latest/ also updated)`);
  console.log(`[demo] Updated state: ${path.join(outRoot, "state.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
