export function safeJsonParseLenient(s: string): unknown {
  const stripAnsi = (x: string) =>
    x
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
      .replace(/\r/g, "");

  const cleaned = stripAnsi(s)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
