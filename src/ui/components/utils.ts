import type { LayerItem } from "./types";

/**
 * Recursively flatten a component's layer tree.
 * Children of instance layers are surfaced with
 * parentInstanceName / parentComponentName metadata.
 */
export function flattenLayers(layers: LayerItem[]): LayerItem[] {
  const result: LayerItem[] = [];

  function walk(items: LayerItem[], parentName?: string, parentComp?: string) {
    for (const layer of items) {
      result.push({
        ...layer,
        ...(parentName ? { parentInstanceName: parentName } : {}),
        ...(parentComp ? { parentComponentName: parentComp } : {}),
      });

      if (layer.children && layer.children.length > 0) {
        walk(layer.children, layer.name, layer.componentName ?? parentComp);
      }
    }
  }

  walk(layers);
  return result;
}

// ════════════════════════════════════════════════════════════
//  Fuzzy matching for variant value renaming
//  e.g. old="Normal" → new="Default"
// ════════════════════════════════════════════════════════════

const VALUE_SYNONYMS: [string, string][] = [
  ["default", "normal"],
  ["default", "base"],
  ["default", "regular"],
  ["default", "none"],
  ["active", "pressed"],
  ["active", "selected"],
  ["hover", "hovered"],
  ["focus", "focused"],
  ["disabled", "inactive"],
  ["disabled", "off"],
  ["enabled", "active"],
  ["enabled", "on"],
  ["on", "true"],
  ["on", "yes"],
  ["off", "false"],
  ["off", "no"],
  ["sm", "small"],
  ["md", "medium"],
  ["lg", "large"],
  ["xl", "extra-large"],
  ["xl", "extra large"],
  ["primary", "main"],
  ["secondary", "alt"],
  ["secondary", "alternate"],
  ["tertiary", "subtle"],
  ["ghost", "text"],
  ["outline", "outlined"],
  ["filled", "contained"],
  ["solid", "filled"],
];

/**
 * Find the best matching new value for an old variant value.
 * Returns the matched new value, or null if no good match.
 *
 * Strategy (ordered by confidence):
 * 1. Exact match (case-insensitive, trimmed)
 * 2. Known synonym pairs
 * 3. Substring containment
 */
export function fuzzyMatchValue(
  oldValue: string,
  newValues: string[]
): string | null {
  const oldLower = oldValue.toLowerCase().trim();

  // 1. Exact match (case-insensitive)
  const exact = newValues.find(
    (v) => v.toLowerCase().trim() === oldLower
  );
  if (exact) return exact;

  // 2. Synonym match
  for (const [a, b] of VALUE_SYNONYMS) {
    if (oldLower === a) {
      const match = newValues.find((v) => v.toLowerCase().trim() === b);
      if (match) return match;
    }
    if (oldLower === b) {
      const match = newValues.find((v) => v.toLowerCase().trim() === a);
      if (match) return match;
    }
  }

  // 3. Substring containment (bidirectional)
  const substring = newValues.find(
    (v) =>
      v.toLowerCase().includes(oldLower) ||
      oldLower.includes(v.toLowerCase())
  );
  if (substring) return substring;

  return null;
}

/**
 * Build an automatic value mapping from old variant options to new ones.
 * Unmapped old values get mapped to the new default if no match is found.
 */
export function buildValueMapping(
  oldOptions: string[],
  newOptions: string[],
  newDefault: string
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedNew = new Set<string>();

  // Pass 1: exact matches (highest priority)
  for (const oldVal of oldOptions) {
    const exactMatch = newOptions.find(
      (n) =>
        n.toLowerCase().trim() === oldVal.toLowerCase().trim() &&
        !usedNew.has(n)
    );
    if (exactMatch) {
      mapping[oldVal] = exactMatch;
      usedNew.add(exactMatch);
    }
  }

  // Pass 2: fuzzy matches for remaining
  for (const oldVal of oldOptions) {
    if (mapping[oldVal]) continue;
    const remaining = newOptions.filter((n) => !usedNew.has(n));
    const fuzzy = fuzzyMatchValue(oldVal, remaining);
    if (fuzzy) {
      mapping[oldVal] = fuzzy;
      usedNew.add(fuzzy);
    }
  }

  // Pass 3: fallback to default for any still unmapped
  for (const oldVal of oldOptions) {
    if (!mapping[oldVal]) {
      mapping[oldVal] = newDefault;
    }
  }

  return mapping;
}
