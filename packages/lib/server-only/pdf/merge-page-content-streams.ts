import { type PDF, PdfStream } from '@libpdf/core';

/**
 * Concatenate each page's content-stream array into a single content stream.
 *
 * A page's content may legally be split across an array of streams
 * (`/Contents [ 10 0 R 11 0 R ... ]`). Acrobat-generated forms - including the
 * government forms this targets - do this routinely. `@libpdf/core`'s flatten
 * routines (`form.flatten()` and `flattenAll()`) only rewrite the *first* entry
 * of such an array and drop the rest, which erases all of the page's
 * text/graphics and leaves a blank page behind the form-field outlines (#28).
 *
 * Merging the array into a single stream before flattening sidesteps the bug:
 * flatten then operates on one content stream it can rewrite without losing
 * content. Per the PDF spec the streams are concatenated with whitespace
 * between them, exactly as a conforming reader would interpret the array.
 *
 * Best-effort by design: pages with a single content stream are left untouched,
 * and any page that cannot be safely merged (unreadable stream, decode failure)
 * is skipped rather than risk making it worse. Never throws.
 */
export const mergePageContentStreams = (pdfDoc: PDF): void => {
  const resolve = pdfDoc.context.resolve.bind(pdfDoc.context);

  for (const page of pdfDoc.getPages()) {
    try {
      let contents = page.dict.get('Contents');

      if (contents?.type === 'ref') {
        contents = resolve(contents) ?? undefined;
      }

      // Only an array of two or more streams can trigger the flatten bug.
      if (contents?.type !== 'array' || contents.length < 2) {
        continue;
      }

      const chunks: Uint8Array[] = [];
      let canMerge = true;

      for (let i = 0; i < contents.length; i++) {
        const stream = contents.at(i, resolve);

        if (!(stream instanceof PdfStream)) {
          canMerge = false;
          break;
        }

        chunks.push(stream.getDecodedData());
      }

      if (!canMerge) {
        continue;
      }

      // Newline-separate the streams so tokens spanning a stream boundary stay
      // distinct (mirrors how a reader concatenates a /Contents array).
      const separator = new Uint8Array([0x0a]);
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length + separator.length, 0);
      const data = new Uint8Array(totalLength);

      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
        data.set(separator, offset);
        offset += separator.length;
      }

      const ref = pdfDoc.createStream({}, data);

      page.dict.set('Contents', ref);
      page.dict.dirty = true;
    } catch {
      // Best-effort: a page we cannot merge is left exactly as it was.
    }
  }
};
