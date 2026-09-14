import type { EnvelopeContent, Field } from '@prisma/client';

export type PageOverlay<TField extends Pick<Field, 'page'>> = {
  fields: TField[];
  contents: EnvelopeContent[];
};

/**
 * Group fields and contents by the page they render on, so each page with any
 * overlay item is rendered exactly once.
 *
 * Contents without a page default to the first page.
 */
export const groupPageOverlays = <TField extends Pick<Field, 'page'>>(
  fields: TField[],
  contents: EnvelopeContent[],
): Map<number, PageOverlay<TField>> => {
  const overlays = new Map<number, PageOverlay<TField>>();

  const getOverlay = (pageNumber: number) => {
    let overlay = overlays.get(pageNumber);

    if (!overlay) {
      overlay = { fields: [], contents: [] };
      overlays.set(pageNumber, overlay);
    }

    return overlay;
  };

  for (const field of fields) {
    getOverlay(field.page).fields.push(field);
  }

  for (const content of contents) {
    getOverlay(content.metadata.page ?? 1).contents.push(content);
  }

  return overlays;
};
