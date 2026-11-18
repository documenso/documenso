/**
 * Note: This is purely presentational. Interactivity (event handlers, editability)
 * remains owned by the individual page renderers.
 */
export type EnvelopePageItemsVisibility = 'visible' | 'muted' | 'hidden';

const VISIBILITY_SEVERITY: Record<EnvelopePageItemsVisibility, number> = {
  visible: 0,
  muted: 1,
  hidden: 2,
};

export const resolvePageItemsVisibility = (
  ...visibilities: EnvelopePageItemsVisibility[]
): EnvelopePageItemsVisibility => {
  let resolved: EnvelopePageItemsVisibility = 'visible';

  for (const visibility of visibilities) {
    if (VISIBILITY_SEVERITY[visibility] > VISIBILITY_SEVERITY[resolved]) {
      resolved = visibility;
    }
  }

  return resolved;
};
