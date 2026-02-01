import { query } from "@anthropic-ai/claude-agent-sdk";
import { withRetry } from "../infra/retry";

export async function runClaudeQuery(prompt: string): Promise<string> {
  return withRetry(() => runClaudeQueryOnce(prompt), {
    attempts: 2,
    baseDelayMs: 2000,
    label: "runClaudeQuery",
  });
}

async function runClaudeQueryOnce(prompt: string): Promise<string> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 120_000);

  try {
    const q = query({
      prompt,
      options: {
        cwd: process.cwd(),
        tools: [],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: 1,
        model: process.env.CLAUDE_MODEL,
        abortController,
      },
    });

    let resultText = "";
    let sawSuccess = false;

    for await (const msg of q) {
      if (msg.type === "auth_status") {
        const tail = (msg.output ?? []).slice(-2).join("\n");
        if (tail) console.log(`[claude-auth] ${tail}`);
        if (msg.error) console.log(`[claude-auth] error: ${msg.error}`);
      }

      if (msg.type === "result" && msg.subtype === "success") {
        resultText = msg.result;
        sawSuccess = true;
      }

      if (msg.type === "result" && msg.subtype !== "success") {
        throw new Error(`Claude Agent SDK failed: ${msg.subtype}: ${msg.errors?.join("; ") ?? ""}`);
      }
    }

    if (!sawSuccess || !resultText.trim()) {
      throw new Error("Claude returned no result text");
    }

    return resultText;
  } finally {
    clearTimeout(timeout);
  }
}
