/**
 * Resolve the attachment filename for a sealed PDF attached to a "Signing
 * Complete!" email.
 *
 * Version 1 envelopes store the document name on `envelope.title`, while
 * version 2 envelopes store it per-item on `envelopeItem.title`. The web editor
 * keeps the uploaded file name (including a trailing `.pdf`) as the item title,
 * so blindly appending `.pdf` produced doubled extensions such as
 * `contract.pdf.pdf`. Append the extension only when it is missing.
 */
export const getCompletedDocumentAttachmentFilename = ({
  internalVersion,
  envelopeTitle,
  envelopeItemTitle,
}: {
  internalVersion: number;
  envelopeTitle: string;
  envelopeItemTitle: string;
}): string => {
  const fileNameToUse = internalVersion === 1 ? envelopeTitle : envelopeItemTitle;

  return fileNameToUse.toLowerCase().endsWith('.pdf') ? fileNameToUse : `${fileNameToUse}.pdf`;
};