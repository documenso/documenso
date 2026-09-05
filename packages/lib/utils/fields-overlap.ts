/**
 * Utilities for detecting overlapping fields in the envelope editor.
 *
 * Fields can be unintentionally placed on top of each other during the authoring
 * process. This does not render well in the editor and behaves unpredictably during
 * signing (fields can sit on top of one another depending on their state), so we warn
 * the user when a significant overlap is detected.
 *
 * All positional values are expected as percentages (0-100) of the page dimensions,
 * matching how fields are stored in the editor and database.
 */

/**
 * The minimum proportion (0-1) of the smaller field's area that must be covered by
 * another field for the pair to be considered an "overlap" worth warning about.
 *
 * A small amount of overlap (e.g. touching edges) is common and harmless, so we only
 * flag pairs where one field covers at least this fraction of the other.
 */
export const FIELD_OVERLAP_THRESHOLD = 0.4;

/**
 * The position and size of a field on a page. Enough on its own to compare two
 * fields geometrically, without needing them to be identifiable.
 */
type FieldGeometry = {
  envelopeItemId: string;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

type OverlapFieldInput = FieldGeometry & {
  /**
   * A stable identifier used to reference the field in the returned pairs.
   * Use the client-side `formId` in the editor, or the database `id` elsewhere.
   */
  id: string | number;
};

export type TFieldOverlapPair<T extends OverlapFieldInput> = {
  fieldA: T;
  fieldB: T;
  /**
   * The proportion (0-1) of the smaller field's area covered by the intersection.
   */
  overlapRatio: number;
};

/**
 * Returns the area of the intersection between two fields, in squared percentage units.
 *
 * Returns 0 when the fields do not intersect.
 */
const getIntersectionArea = (fieldA: FieldGeometry, fieldB: FieldGeometry): number => {
  const overlapX = Math.max(
    0,
    Math.min(fieldA.positionX + fieldA.width, fieldB.positionX + fieldB.width) -
      Math.max(fieldA.positionX, fieldB.positionX),
  );

  const overlapY = Math.max(
    0,
    Math.min(fieldA.positionY + fieldA.height, fieldB.positionY + fieldB.height) -
      Math.max(fieldA.positionY, fieldB.positionY),
  );

  return overlapX * overlapY;
};

/**
 * Detects pairs of fields that overlap by at least the given threshold.
 *
 * Two fields are only compared when they share the same envelope item and page.
 * The overlap ratio is measured against the smaller of the two fields, so a small
 * field that is mostly covered by a large field is still flagged.
 *
 * @param fields The fields to check. Positional values must be percentages (0-100).
 * @param threshold The minimum overlap ratio (0-1) to flag. Defaults to {@link FIELD_OVERLAP_THRESHOLD}.
 */
export const getOverlappingFieldPairs = <T extends OverlapFieldInput>(
  fields: T[],
  threshold: number = FIELD_OVERLAP_THRESHOLD,
): TFieldOverlapPair<T>[] => {
  const pairs: TFieldOverlapPair<T>[] = [];

  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      const fieldA = fields[i];
      const fieldB = fields[j];

      if (fieldA.envelopeItemId !== fieldB.envelopeItemId || fieldA.page !== fieldB.page) {
        continue;
      }

      const fieldAArea = fieldA.width * fieldA.height;
      const fieldBArea = fieldB.width * fieldB.height;

      if (fieldAArea <= 0 || fieldBArea <= 0) {
        continue;
      }

      const intersectionArea = getIntersectionArea(fieldA, fieldB);

      if (intersectionArea <= 0) {
        continue;
      }

      const overlapRatio = intersectionArea / Math.min(fieldAArea, fieldBArea);

      if (overlapRatio >= threshold) {
        pairs.push({ fieldA, fieldB, overlapRatio });
      }
    }
  }

  return pairs;
};

/**
 * Returns true if any pair of fields overlaps by at least the given threshold.
 */
export const hasOverlappingFields = <T extends OverlapFieldInput>(
  fields: T[],
  threshold: number = FIELD_OVERLAP_THRESHOLD,
): boolean => {
  return getOverlappingFieldPairs(fields, threshold).length > 0;
};

/**
 * The overlap ratio above which two fields of the same type, for the same recipient,
 * are treated as the same field rather than two deliberately placed ones.
 *
 * Set high so that fields a sender has intentionally placed close together are not
 * mistaken for duplicates.
 */
export const FIELD_DUPLICATE_THRESHOLD = 0.9;

/**
 * A field being compared for duplication. Deliberately does not require an `id`:
 * a field being placed in the editor has no database id yet.
 */
type DuplicateFieldInput = FieldGeometry & {
  recipientId: number;
  type: string;
};

/**
 * Finds an existing field that a candidate would effectively duplicate.
 *
 * Only fields of the same type, for the same recipient, on the same page of the same
 * envelope item are considered, and only when they cover each other almost entirely.
 * Such a pair is indistinguishable to a signer: only the field on top can be clicked,
 * so the one underneath can never be filled in and the envelope can never complete.
 *
 * @param fields The existing fields. Positional values must be percentages (0-100).
 * @param candidate The field about to be created.
 * @param threshold The minimum overlap ratio (0-1). Defaults to {@link FIELD_DUPLICATE_THRESHOLD}.
 */
export const findDuplicateField = <T extends DuplicateFieldInput>(
  fields: T[],
  candidate: DuplicateFieldInput,
  threshold: number = FIELD_DUPLICATE_THRESHOLD,
): T | undefined => {
  const candidateArea = candidate.width * candidate.height;

  if (candidateArea <= 0) {
    return undefined;
  }

  return fields.find((field) => {
    if (
      field.recipientId !== candidate.recipientId ||
      field.type !== candidate.type ||
      field.envelopeItemId !== candidate.envelopeItemId ||
      field.page !== candidate.page
    ) {
      return false;
    }

    const fieldArea = field.width * field.height;

    if (fieldArea <= 0) {
      return false;
    }

    return getIntersectionArea(field, candidate) / Math.min(fieldArea, candidateArea) >= threshold;
  });
};
