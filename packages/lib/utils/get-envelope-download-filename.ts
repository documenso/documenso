type GetEnvelopeDownloadFileNameOptions = {
  itemCount: number;
  itemTitle: string;
  envelopeTitle: string;
};

/**
 * Resolve the base filename used when downloading an envelope item.
 *
 * For single-item envelopes the item is effectively the document, so the
 * envelope (document) title is used. Renaming a document only updates the
 * envelope title, not the item title, so relying on the item title left
 * downloads with a stale name (see #3096).
 *
 * Multi-item envelopes keep the per-item title so the downloaded files stay
 * distinguishable from one another.
 *
 * The caller is responsible for appending any version suffix / extension.
 */
export const getEnvelopeDownloadFileName = ({
  itemCount,
  itemTitle,
  envelopeTitle,
}: GetEnvelopeDownloadFileNameOptions): string => {
  if (itemCount === 1 && envelopeTitle.trim() !== '') {
    return envelopeTitle;
  }

  return itemTitle;
};
