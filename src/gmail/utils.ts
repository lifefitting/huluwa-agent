import type { gmail_v1 } from "googleapis";

export function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string) {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? undefined;
}
