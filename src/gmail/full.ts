import type { gmail_v1 } from "googleapis";
import { withRetry } from "../infra/retry";

export async function fetchFullMessage(gmail: gmail_v1.Gmail, messageId: string) {
  const msg = await withRetry(
    () => gmail.users.messages.get({ userId: "me", id: messageId, format: "full" }),
    { label: `gmail.messages.get(${messageId})` },
  );
  return msg.data;
}

export async function fetchThread(gmail: gmail_v1.Gmail, threadId: string) {
  const t = await withRetry(
    () => gmail.users.threads.get({ userId: "me", id: threadId }),
    { label: `gmail.threads.get(${threadId})` },
  );
  return t.data;
}
