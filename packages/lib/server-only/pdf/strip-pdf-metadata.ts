import { PDFDocument, PDFName } from '@cantoo/pdf-lib';

/**
 * Strips information that could leak original document content from a
 * (presumed already-flattened) PDF byte stream:
 *
 * - Info dictionary: Title, Author, Subject, Keywords, Creator, Producer.
 * - Catalog `Names` entry (embedded file attachments and named destinations).
 * - Catalog `AcroForm` entry (any remaining form data, including field values
 *   that may still reference pre-redaction text).
 * - Catalog `OpenAction` and `AA` entries (JavaScript / automatic actions).
 *
 * We save with `useObjectStreams: false` to avoid leaking data via object
 * stream compression side channels.
 */
export const stripPdfMetadata = async (pdfBytes: Uint8Array): Promise<Uint8Array> => {
  // `updateMetadata: false` prevents pdf-lib from automatically resetting
  // Producer / ModDate on load, so our cleared values actually survive.
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');

  const { catalog } = doc;
  catalog.delete(PDFName.of('Names'));
  catalog.delete(PDFName.of('AcroForm'));
  catalog.delete(PDFName.of('OpenAction'));
  catalog.delete(PDFName.of('AA'));

  return new Uint8Array(await doc.save({ useObjectStreams: false }));
};
