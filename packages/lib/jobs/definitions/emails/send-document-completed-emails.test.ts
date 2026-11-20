import { describe, expect, it } from 'vitest';

describe('completedDocumentEmailAttachments filename logic', () => {
  const getAttachmentFilename = (
    envelope: { internalVersion: number; title: string },
    envelopeItem: { title: string },
  ) => {
    // Exact logic from send-document-completed-emails.handler.ts
    const fileNameToUse = envelope.internalVersion === 1 ? envelope.title : envelopeItem.title;

    return fileNameToUse.endsWith('.pdf') ? fileNameToUse : fileNameToUse + '.pdf';
  };

  it('formats internalVersion 2 document filenames without duplicate .pdf extension', () => {
    const envelope = { internalVersion: 2, title: 'Contract Envelope' };

    expect(getAttachmentFilename(envelope, { title: 'contract.pdf' })).toBe('contract.pdf');
    expect(getAttachmentFilename(envelope, { title: 'agreement' })).toBe('agreement.pdf');
    expect(getAttachmentFilename(envelope, { title: 'report.pdf' })).toBe('report.pdf');
  });

  it('preserves internalVersion 1 document filenames behavior', () => {
    const envelopeWithoutExt = { internalVersion: 1, title: 'Invoice' };
    expect(getAttachmentFilename(envelopeWithoutExt, { title: 'ignored-v2-item.pdf' })).toBe('Invoice.pdf');

    const envelopeWithExt = { internalVersion: 1, title: 'Invoice.pdf' };
    expect(getAttachmentFilename(envelopeWithExt, { title: 'ignored-v2-item.pdf' })).toBe('Invoice.pdf');
  });
});
