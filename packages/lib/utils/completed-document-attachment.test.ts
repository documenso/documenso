import { describe, expect, it } from 'vitest';

import { getCompletedDocumentAttachmentFilename } from './completed-document-attachment';

describe('getCompletedDocumentAttachmentFilename', () => {
  it('does not double the .pdf extension for version 2 items whose title already ends in .pdf', () => {
    // Regression: the web editor keeps the uploaded file name (e.g. `contract.pdf`)
    // as the envelope item title, which previously produced `contract.pdf.pdf`.
    expect(
      getCompletedDocumentAttachmentFilename({
        internalVersion: 2,
        envelopeTitle: 'Contract',
        envelopeItemTitle: 'contract.pdf',
      }),
    ).toBe('contract.pdf');
  });

  it('appends .pdf when a version 2 item title has no extension', () => {
    expect(
      getCompletedDocumentAttachmentFilename({
        internalVersion: 2,
        envelopeTitle: 'Contract',
        envelopeItemTitle: 'contract',
      }),
    ).toBe('contract.pdf');
  });

  it('is case-insensitive when detecting an existing .pdf extension', () => {
    expect(
      getCompletedDocumentAttachmentFilename({
        internalVersion: 2,
        envelopeTitle: 'Contract',
        envelopeItemTitle: 'Contract.PDF',
      }),
    ).toBe('Contract.PDF');
  });

  it('uses the envelope title for version 1 envelopes', () => {
    expect(
      getCompletedDocumentAttachmentFilename({
        internalVersion: 1,
        envelopeTitle: 'Agreement',
        envelopeItemTitle: 'ignored.pdf',
      }),
    ).toBe('Agreement.pdf');
  });

  it('does not double the extension for version 1 titles that already end in .pdf', () => {
    expect(
      getCompletedDocumentAttachmentFilename({
        internalVersion: 1,
        envelopeTitle: 'Agreement.pdf',
        envelopeItemTitle: 'ignored',
      }),
    ).toBe('Agreement.pdf');
  });
});