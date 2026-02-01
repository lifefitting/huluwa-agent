import fs from "node:fs";
import { statePath } from "./store";

function main() {
  const p = statePath();
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log(`[state] removed: ${p}`);
  } else {
    console.log(`[state] no state file to remove: ${p}`);
  }
}

main();
