import type { gmail_v1 } from "googleapis";
import type { MailItem } from "../types";
import { getHeader } from "./utils";
import { withRetry } from "../infra/retry";

const BATCH_SIZE = 5;

export async function listUnreadMetadata(gmail: gmail_v1.Gmail, opts: { q: string; maxResults: number }) {
  const { q, maxResults } = opts;

  const list = await withRetry(
    () => gmail.users.messages.list({ userId: "me", q, maxResults }),
    { label: "gmail.messages.list" },
  );

  const ids = list.data.messages?.map((m) => m.id).filter(Boolean) as string[] | undefined;
  if (!ids?.length) return [] as MailItem[];

  const items: MailItem[] = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((id) =>
        withRetry(
          () => gmail.users.messages.get({
            userId: "me",
            id,
            format: "metadata",
            metadataHeaders: ["From", "Subject", "Date"],
          }),
          { label: `gmail.messages.get(${id})` },
        ),
      ),
    );

    for (const msg of results) {
      const headers = msg.data.payload?.headers;
      items.push({
        id: msg.data.id!,
        threadId: msg.data.threadId ?? undefined,
        from: getHeader(headers, "From"),
        subject: getHeader(headers, "Subject"),
        date: getHeader(headers, "Date"),
        snippet: msg.data.snippet ?? undefined,
        labels: msg.data.labelIds ?? undefined,
      });
    }
  }

  return items;
}
