import {
  PDFArray,
  PDFDict,
  PDFDocument,
  type PDFFont,
  PDFHexString,
  PDFName,
  PDFNumber,
  type PDFRef,
  PDFString,
  StandardFonts,
} from '@cantoo/pdf-lib';

/**
 * Bake appearance streams onto annotations that carry text but have no
 * appearance, so the seal pipeline's `flattenAll()` preserves their content
 * instead of deleting it.
 *
 * Why this is needed
 * ------------------
 * The seal path (`decorateAndSignPdf`) calls `pdfDoc.flattenAll()` from
 * `@libpdf/core` before signing. Its annotation flattener does, per page:
 *
 * ```
 * let appearance = annotation.getNormalAppearance();
 * if (!appearance) appearance = this.generateAppearance(annotation);
 * if (!appearance) { refsToRemove.add(...); continue; } // <-- annotation deleted
 * ```
 *
 * and `generateAppearance()` only synthesises appearances for Highlight /
 * Underline / StrikeOut / Squiggly. A `/FreeText` annotation with no `/AP`
 * therefore falls through to the delete branch: its text never reaches the page
 * content stream and the signed PDF comes back blank where the user typed.
 *
 * This is tool-dependent, which is why the symptom looks inconsistent:
 *   - Acrobat form-fills produce AcroForm `/Widget` annots  -> already flattened.
 *   - Acrobat's Typewriter writes `/FreeText` *with* an `/AP` -> already baked.
 *   - pypdf / Stirling PDF / most scripted annotators write `/FreeText` with NO
 *     `/AP` (viewers render from `/DA` + `/Contents`)         -> DROPPED.
 *
 * The fix
 * -------
 * Before `flattenAll()` runs, synthesise a standards-compliant Form XObject
 * appearance (`/AP /N`) for every annotation that carries renderable content but
 * has no appearance. `flattenAll()` then takes its normal "bake the appearance
 * into page content" path and the text survives. We deliberately do not
 * reimplement flattening — we only fill the gap that makes it give up.
 *
 * Safety: this never throws and never returns invalid bytes. On any failure the
 * original buffer is returned unchanged, so a malformed PDF degrades to the
 * prior behaviour rather than breaking sealing.
 */

const LOG = '[pdf/bake-annotation-appearances]';

// Subtypes `flattenAll()` never flattens (it leaves them in place), so we must
// not touch them either.
const SKIP_SUBTYPES = new Set(['Widget', 'Link', 'Popup']);

// Subtypes the flattener can already synthesise an appearance for.
const ALREADY_HANDLED = new Set(['Highlight', 'Underline', 'StrikeOut', 'Squiggly']);

// Annotation flag bits (PDF 32000-1 12.5.3): 1 = Invisible, 2 = Hidden,
// 6 = NoView. Anything carrying these is meant to be unrendered; the flattener
// drops it and so should we.
const isHiddenFlags = (flags: number): boolean =>
  Boolean(flags & 0b1) || Boolean(flags & 0b10) || Boolean(flags & 0b100000);

/** Map text into the Latin-1 range WinAnsiEncoding can actually represent. */
const sanitiseForWinAnsi = (text: string): string =>
  text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[\t\v\f]/g, ' ')
    // anything still outside Latin-1 (or a control char) becomes '?'
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

type ParsedDefaultAppearance = {
  size: number | null;
  color: [number, number, number];
};

/**
 * Pull font size + fill colour out of an annotation's `/DA` default-appearance
 * string, e.g. `"0 0 0 rg /Helv 12 Tf"` or `"/Helv 0 Tf 0.2 g"`. A size of 0
 * means "auto-fit" per the spec; it is resolved later.
 */
const parseDefaultAppearance = (da: string | null): ParsedDefaultAppearance => {
  const out: ParsedDefaultAppearance = { size: null, color: [0, 0, 0] };
  if (!da) return out;

  const tf = da.match(/\/([^\s/]+)\s+([\d.]+)\s+Tf/);
  if (tf) out.size = Number.parseFloat(tf[2]);

  const rg = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg/);
  if (rg) {
    out.color = [Number.parseFloat(rg[1]), Number.parseFloat(rg[2]), Number.parseFloat(rg[3])];
    return out;
  }

  const g = da.match(/(?:^|\s)([\d.]+)\s+g(?:\s|$)/);
  if (g) {
    const v = Number.parseFloat(g[1]);
    out.color = [v, v, v];
    return out;
  }

  const k = da.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+k/);
  if (k) {
    const [c, m, y, kk] = k.slice(1, 5).map((n) => Number.parseFloat(n));
    out.color = [(1 - c) * (1 - kk), (1 - m) * (1 - kk), (1 - y) * (1 - kk)];
  }

  return out;
};

/** Greedy word-wrap to a pixel width, honouring explicit newlines. */
const wrapLines = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const paragraphs = text.split(/\r\n|\r|\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current === '' ? word : `${current} ${word}`;
      let width = 0;
      try {
        width = font.widthOfTextAtSize(candidate, size);
      } catch {
        width = candidate.length * size * 0.5;
      }

      if (width <= maxWidth || current === '') {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }

  return lines;
};

const readText = (value: unknown): string | null => {
  if (value instanceof PDFHexString || value instanceof PDFString) {
    try {
      return value.decodeText();
    } catch {
      return null;
    }
  }
  return null;
};

const readName = (value: unknown): string | null => {
  if (value instanceof PDFName) return value.asString().replace(/^\//, '');
  return null;
};

type NormalisedRect = { x1: number; y1: number; x2: number; y2: number };

const normaliseRect = (rectArray: unknown): NormalisedRect | null => {
  if (!(rectArray instanceof PDFArray) || rectArray.size() < 4) return null;
  const nums: number[] = [];
  for (let i = 0; i < 4; i++) {
    const n = rectArray.lookup(i);
    if (!(n instanceof PDFNumber)) return null;
    nums.push(n.asNumber());
  }
  const [a, b, c, d] = nums;
  return { x1: Math.min(a, c), y1: Math.min(b, d), x2: Math.max(a, c), y2: Math.max(b, d) };
};

/**
 * Build the Form XObject appearance stream for one FreeText annotation and
 * attach it as `/AP /N`. Returns true if an appearance was written.
 */
const bakeFreeText = (doc: PDFDocument, annot: PDFDict, font: PDFFont, fontRef: PDFRef): boolean => {
  const rect = normaliseRect(annot.lookup(PDFName.of('Rect')));
  if (!rect) return false;

  const width = rect.x2 - rect.x1;
  const height = rect.y2 - rect.y1;
  // Zero-area boxes are rejected by the flattener and by viewers.
  if (!(width > 0) || !(height > 0)) return false;

  const raw = readText(annot.lookup(PDFName.of('Contents')));
  if (raw === null || raw.trim() === '') return false;

  const text = sanitiseForWinAnsi(raw);
  const da = readText(annot.lookup(PDFName.of('DA')));
  const { size: daSize, color } = parseDefaultAppearance(da);

  // FreeText boxes are drawn with a small inset; 2pt matches Acrobat.
  const pad = 2;
  const innerWidth = Math.max(width - pad * 2, 1);

  // A `/DA` size of 0 means auto-size. Shrink until the wrapped text fits.
  let size = daSize && daSize > 0 ? daSize : 11;
  let lines = wrapLines(text, font, size, innerWidth);
  if (!daSize || daSize <= 0) {
    while (size > 4 && lines.length * size * 1.16 > height - pad * 2) {
      size -= 0.5;
      lines = wrapLines(text, font, size, innerWidth);
    }
  }

  const leading = size * 1.16;
  const ascent = size * 0.85;

  const ops = [
    '/Tx BMC',
    'q',
    'BT',
    `${color.map((c) => Number(c.toFixed(4))).join(' ')} rg`,
    `/BakedFont ${Number(size.toFixed(2))} Tf`,
    `${Number(leading.toFixed(2))} TL`,
    // Origin is the BBox's bottom-left; start one ascent below the top edge.
    `${pad} ${Number((height - pad - ascent).toFixed(2))} Td`,
  ];

  lines.forEach((line, index) => {
    if (index > 0) ops.push('T*');
    if (line === '') return;
    let encoded: string;
    try {
      encoded = font.encodeText(line).toString();
    } catch {
      return;
    }
    ops.push(`${encoded} Tj`);
  });

  ops.push('ET', 'Q', 'EMC');

  const stream = doc.context.stream(ops.join('\n'), {
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: [0, 0, width, height],
    Resources: { Font: { BakedFont: fontRef } },
  });

  const apDict = PDFDict.withContext(doc.context);
  apDict.set(PDFName.of('N'), doc.context.register(stream));
  annot.set(PDFName.of('AP'), apDict);

  return true;
};

export const bakeAnnotationAppearances = async (pdfData: Uint8Array): Promise<Uint8Array> => {
  try {
    const doc = await PDFDocument.load(pdfData, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    // First pass: is there anything worth doing? Avoid embedding a font (and
    // re-serialising the file) for the overwhelmingly common no-annotations case.
    const candidates: PDFDict[] = [];
    const unhandled = new Map<string, number>();

    for (const page of doc.getPages()) {
      const annots = page.node.lookup(PDFName.of('Annots'), PDFArray);
      if (!annots) continue;

      for (let i = 0; i < annots.size(); i++) {
        let annot: PDFDict | undefined;
        try {
          annot = annots.lookup(i, PDFDict);
        } catch {
          continue;
        }
        if (!annot) continue;

        const subtype = readName(annot.lookup(PDFName.of('Subtype')));
        if (!subtype || SKIP_SUBTYPES.has(subtype) || ALREADY_HANDLED.has(subtype)) continue;

        const flags = annot.lookup(PDFName.of('F'));
        if (flags instanceof PDFNumber && isHiddenFlags(flags.asNumber())) continue;

        // Already has an appearance -> the flattener will bake it; leave it be.
        const ap = annot.lookup(PDFName.of('AP'));
        if (ap instanceof PDFDict && ap.lookup(PDFName.of('N'))) continue;

        if (subtype === 'FreeText') {
          candidates.push(annot);
        } else {
          unhandled.set(subtype, (unhandled.get(subtype) ?? 0) + 1);
        }
      }
    }

    // Safety net: an annotation carrying content we still cannot render is about
    // to be silently deleted by flattenAll(). Say so, loudly.
    if (unhandled.size > 0) {
      const summary = [...unhandled.entries()].map(([k, v]) => `${k}x${v}`).join(', ');
      console.warn(
        `${LOG} ${summary} annotation(s) have no appearance stream and no generator — ` +
          `the seal flatten will drop them and their content will be absent from the ` +
          `signed PDF.`,
      );
    }

    if (candidates.length === 0) {
      return pdfData;
    }

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontRef = font.ref;

    let baked = 0;
    for (const annot of candidates) {
      try {
        if (bakeFreeText(doc, annot, font, fontRef)) baked++;
      } catch (err) {
        console.warn(
          `${LOG} failed to bake one FreeText annotation:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (baked === 0) {
      return pdfData;
    }

    return await doc.save({ useObjectStreams: false });
  } catch (err) {
    // Never let this break sealing — worst case we are back to prior behaviour.
    console.error(
      `${LOG} pre-flatten pass failed, continuing unmodified:`,
      err instanceof Error ? err.message : err,
    );
    return pdfData;
  }
};
