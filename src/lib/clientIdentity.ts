const normalizeIdentityPart = (value: string | number | null | undefined) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function buildDeterministicClientId(
  scope: string,
  parts: Array<string | number | null | undefined>,
  index?: number,
) {
  const normalizedScope = normalizeIdentityPart(scope) || "item";
  const normalizedParts = parts
    .map((part) => normalizeIdentityPart(part))
    .filter(Boolean);

  if (typeof index === "number") {
    normalizedParts.push(`idx-${index}`);
  }

  return [normalizedScope, ...normalizedParts].join(":") || `${normalizedScope}:unknown`;
}

export function attachDeterministicClientIds<T>(
  items: T[],
  scope: string,
  getParts: (item: T, index: number) => Array<string | number | null | undefined>,
) {
  const occurrenceMap = new Map<string, number>();

  return items.map((item, index) => {
    const baseId = buildDeterministicClientId(scope, getParts(item, index));
    const occurrence = occurrenceMap.get(baseId) ?? 0;
    occurrenceMap.set(baseId, occurrence + 1);

    return {
      ...item,
      client_id: occurrence === 0 ? baseId : `${baseId}:dup-${occurrence}`,
    };
  });
}
