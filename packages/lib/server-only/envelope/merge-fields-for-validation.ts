type ExistingField = { id: number; type: string; recipientId: number; fieldMeta: unknown };
type IncomingField = { id?: number | null; type: string; recipientId: number; fieldMeta: unknown };

/**
 * Merge existing envelope fields with an incoming payload into the shape the
 * visibility validator expects. Incoming rows that match an existing id REPLACE
 * the existing row; incoming rows with no id get a negative sentinel. Existing
 * rows that aren't in the incoming payload are carried through unchanged.
 */
export const mergeFieldsForValidation = (
  existing: ExistingField[],
  incoming: IncomingField[],
): Array<{ id: number; type: string; recipientId: number; fieldMeta: unknown }> => {
  const existingById = new Map(existing.map((f) => [f.id, f] as const));
  const merged: Array<{ id: number; type: string; recipientId: number; fieldMeta: unknown }> = [];
  const usedIds = new Set<number>();

  incoming.forEach((inc, idx) => {
    if (inc.id != null && existingById.has(inc.id)) {
      usedIds.add(inc.id);
      merged.push({
        id: inc.id,
        type: inc.type,
        recipientId: inc.recipientId,
        fieldMeta: inc.fieldMeta,
      });
    } else {
      merged.push({
        id: -(idx + 1),
        type: inc.type,
        recipientId: inc.recipientId,
        fieldMeta: inc.fieldMeta,
      });
    }
  });

  for (const f of existing) {
    if (!usedIds.has(f.id)) merged.push(f);
  }
  return merged;
};
