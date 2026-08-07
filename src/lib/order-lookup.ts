export const ORDER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function classifyOrderLookup(
  input: string,
): { kind: "uuid"; value: string } | { kind: "phone"; value: string } | null {
  const raw = input.trim();
  if (ORDER_UUID_RE.test(raw)) return { kind: "uuid", value: raw };
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 12
    ? { kind: "phone", value: digits.slice(-10) }
    : null;
}
