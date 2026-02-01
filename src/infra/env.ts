export function envBool(name: string, defaultValue: boolean) {
  const v = process.env[name];
  if (v == null) return defaultValue;
  if (v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes") return true;
  if (v === "0" || v.toLowerCase() === "false" || v.toLowerCase() === "no") return false;
  return defaultValue;
}
