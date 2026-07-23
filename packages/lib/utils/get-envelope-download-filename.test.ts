import { describe, expect, it } from 'vitest';

import { getEnvelopeDownloadFileName } from './get-envelope-download-filename';

describe('getEnvelopeDownloadFileName', () => {
  // Regression guard for #3096: a renamed single-item document must download
  // using the (current) envelope title, not the stale envelope item title.
  it('uses the envelope title for single-item envelopes', () => {
    expect(
      getEnvelopeDownloadFileName({
        itemCount: 1,
        itemTitle: 'original-upload-name',
        envelopeTitle: 'Renamed Document',
      }),
    ).toBe('Renamed Document');
  });

  it('uses the item title for multi-item envelopes', () => {
    expect(
      getEnvelopeDownloadFileName({
        itemCount: 3,
        itemTitle: 'Appendix A',
        envelopeTitle: 'Renamed Document',
      }),
    ).toBe('Appendix A');
  });

  it('falls back to the item title when the envelope title is empty', () => {
    expect(
      getEnvelopeDownloadFileName({
        itemCount: 1,
        itemTitle: 'fallback-name',
        envelopeTitle: '   ',
      }),
    ).toBe('fallback-name');
  });
});
