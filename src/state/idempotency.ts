import { envBool } from "../infra/env";
import { loadState } from "./store";

export function isIdempotencyEnabled() {
  return envBool("IDEMPOTENCY", true);
}

export function shouldProcessMessage(messageId: string) {
  if (!isIdempotencyEnabled()) return true;
  const state = loadState();
  return !state.processedMessageIds[messageId];
}

export function filterNewMessages(ids: string[]) {
  if (!isIdempotencyEnabled()) return ids;
  const state = loadState();
  return ids.filter((id) => !state.processedMessageIds[id]);
}
