import { createId } from '@paralleldrive/cuid2';

type FieldLike = {
  id: number | string;
  fieldMeta: Record<string, unknown> | null | undefined;
};

/**
 * Immutably assigns a stableId to:
 *   - any field that owns a visibility block (dependent), and
 *   - any field whose stableId is referenced by another field's rule AND that
 *     field already has an existing stableId (we do not infer or create
 *     references; we only ensure dependents have one).
 *
 * Preserves existing stableIds.
 */
export const assignFieldStableIds = <T extends FieldLike>(fields: T[]): T[] => {
  return fields.map((f) => {
    const meta = (f.fieldMeta ?? {}) as Record<string, unknown>;
    const hasVisibility = Boolean((meta as { visibility?: unknown }).visibility);

    if (!hasVisibility) return f;
    if (typeof meta.stableId === 'string' && meta.stableId.length > 0) return f;

    return {
      ...f,
      fieldMeta: { ...meta, stableId: createId() },
    };
  });
};
