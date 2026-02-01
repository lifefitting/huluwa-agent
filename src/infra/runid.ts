import crypto from "node:crypto";

export function formatRunTimestamp(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
}

export function makeRunId(d = new Date()) {
  return `${formatRunTimestamp(d)}-${crypto.randomUUID()}`;
}
