/**
 * Build a PostgREST `or` filter for case-insensitive search.
 * User text is stripped of filter grammar (commas, dots, parentheses, wildcards)
 * and quoted so it cannot add extra conditions.
 */
export function ilikeAny(columns: readonly string[], raw: string, maxLen = 80): string | null {
  const cleaned = raw
    .replace(/[%_\\,().:*"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  if (!cleaned) return null;
  const pattern = `%${cleaned}%`;
  return columns.map((column) => `${column}.ilike."${pattern}"`).join(',');
}
