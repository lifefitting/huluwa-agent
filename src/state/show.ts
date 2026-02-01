import fs from "node:fs";
import { loadState, statePath } from "./store";

function main() {
  const p = statePath();
  const s = loadState();
  const processedCount = Object.keys(s.processedMessageIds ?? {}).length;
  console.log(`[state] path: ${p}`);
  console.log(`[state] processedCount: ${processedCount}`);
  if (s.stats) console.log(`[state] stats: ${JSON.stringify(s.stats)}`);

  if (fs.existsSync(p)) {
    console.log("--- raw ---");
    console.log(fs.readFileSync(p, "utf8"));
  }
}

main();
