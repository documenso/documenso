/**
 * The visibility treatment applied to a class of items (fields or contents)
 * rendered on top of a PDF page.
 *
 * - `visible`: Rendered normally.
 * - `muted`: Rendered dimmed and inert.
 * - `hidden`: Not rendered at all.
 *
 * Note: This is purely presentational. Interactivity (event handlers, editability)
 * remains owned by the individual page renderers.
 */
export type EnvelopePageItemsVisibility = 'visible' | 'muted' | 'hidden';

const VISIBILITY_SEVERITY: Record<EnvelopePageItemsVisibility, number> = {
  visible: 0,
  muted: 1,
  hidden: 2,
};

/**
 * Resolve multiple visibility inputs into a single value, where the most
 * restrictive input wins (hidden > muted > visible).
 *
 * Used to combine independent visibility sources, e.g. the viewer toolbar
 * user preference and the editor tab context, without either overwriting
 * the other.
 */
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
