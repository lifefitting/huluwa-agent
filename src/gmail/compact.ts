import type { gmail_v1 } from "googleapis";
import { getHeader } from "./utils";

function base64UrlDecode(input: string): string {
  // Gmail uses base64url (RFC 4648 §5)
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  return Buffer.from(padded, "base64").toString("utf8");
}

function walkParts(part: gmail_v1.Schema$MessagePart | undefined, out: gmail_v1.Schema$MessagePart[] = []) {
  if (!part) return out;
  out.push(part);
  for (const p of part.parts ?? []) walkParts(p, out);
  return out;
}

export type CompactFullMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  headers?: {
    from?: string;
    to?: string;
    subject?: string;
    date?: string;
  };
  text?: {
    plain?: string;
    html?: string;
  };
  attachments?: Array<{ filename?: string; mimeType?: string; size?: number }>;
};

export function compactFullMessage(msg: gmail_v1.Schema$Message, opts?: { maxTextChars?: number }) {
  const maxTextChars = opts?.maxTextChars ?? 8000;

  const headers = msg.payload?.headers;
  const flat = walkParts(msg.payload);

  const plainParts = flat.filter((p) => p.mimeType?.toLowerCase() === "text/plain" && p.body?.data);
  const htmlParts = flat.filter((p) => p.mimeType?.toLowerCase() === "text/html" && p.body?.data);

  const plain = plainParts
    .map((p) => base64UrlDecode(p.body?.data ?? ""))
    .join("\n\n")
    .slice(0, maxTextChars);

  // Cap HTML at 4000 chars — HTML is verbose and less useful for LLM analysis
  const html = htmlParts
    .map((p) => base64UrlDecode(p.body?.data ?? ""))
    .join("\n\n")
    .slice(0, Math.min(maxTextChars, 4000));

  const attachments = flat
    .filter((p) => (p.filename && p.filename.length > 0) || p.body?.attachmentId)
    .map((p) => ({
      filename: p.filename || undefined,
      mimeType: p.mimeType || undefined,
      size: p.body?.size || undefined,
    }))
    // cap list to avoid huge payload
    .slice(0, 20);

  const compact: CompactFullMessage = {
    id: msg.id ?? undefined,
    threadId: msg.threadId ?? undefined,
    internalDate: msg.internalDate ?? undefined,
    snippet: msg.snippet ?? undefined,
    headers: {
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      subject: getHeader(headers, "Subject"),
      date: getHeader(headers, "Date"),
    },
    text: {
      plain: plain || undefined,
      html: html || undefined,
    },
    attachments: attachments.length ? attachments : undefined,
  };

  return compact;
}
