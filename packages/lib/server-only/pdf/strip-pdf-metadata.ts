import { type PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib';

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

  // `getInfoDict` is `private` in the pdf-lib types but is the only way to
  // actually remove Info-dict keys (as opposed to clearing them to empty
  // strings, which leaves the keys present). No public alternative exists.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoDict = (doc as any).getInfoDict() as PDFDict;
  for (const key of ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer']) {
    infoDict.delete(PDFName.of(key));
  }

  const { catalog } = doc;
  catalog.delete(PDFName.of('Names'));
  catalog.delete(PDFName.of('AcroForm'));
  catalog.delete(PDFName.of('OpenAction'));
  catalog.delete(PDFName.of('AA'));

  return new Uint8Array(await doc.save({ useObjectStreams: false }));
};
