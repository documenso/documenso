import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';

import type { TAcroformInventory, TPageInfo, TRectDocumenso, TRectPdf } from './schemas.ts';
import { EXTRACTOR_VERSION } from './schemas.ts';

type TObjectRecord = {
  objectNumber: number;
  generationNumber: number;
  ref: string;
  rawBody: string;
  decodedStream: Buffer | null;
};

type TLowLevelFieldContext = {
  nameParts: string[];
  rawType: string | null;
  rawTooltip: string | null;
  pageRef: string | null;
};

type TLowLevelWidget = {
  ref: string;
  sourceKey: string;
  rawName: string | null;
  rawType: string | null;
  rawTooltip: string | null;
  page: number;
  rectPdf: TRectPdf;
  rectDocumenso: TRectDocumenso;
};

type TPdfJsField = {
  sourceKey: string;
  rawName: string | null;
  rawType: string | null;
  rawTooltip: string | null;
  page: number;
  rectPdf: TRectPdf;
  rectDocumenso: TRectDocumenso;
};

type TPdfJsInventoryResult = {
  pages: TPageInfo[];
  fields: TPdfJsField[];
} | null;

type TPageTreeNode = {
  ref: string;
  mediaBox: number[];
  annots: string[];
};

const INDIRECT_OBJECT_REGEX = /(\d+)\s+(\d+)\s+obj\b([\s\S]*?)endobj/g;

const round = (value: number) => Math.round(value * 10000) / 10000;

const normalizeRect = (rawRect: number[]) => {
  const [left, bottom, right, top] = rawRect;

  return {
    x1: Math.min(left, right),
    y1: Math.min(bottom, top),
    x2: Math.max(left, right),
    y2: Math.max(bottom, top),
  };
};

const toDocumensoRect = (rect: TRectPdf, pageWidth: number, pageHeight: number): TRectDocumenso => ({
  positionX: round((rect.x1 / pageWidth) * 100),
  positionY: round(((pageHeight - rect.y2) / pageHeight) * 100),
  width: round(((rect.x2 - rect.x1) / pageWidth) * 100),
  height: round(((rect.y2 - rect.y1) / pageHeight) * 100),
});

const bufferFromLatin1 = (value: string) => Buffer.from(value, 'latin1');

const decodePdfStringBytes = (bytes: Buffer) => {
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return bytes.subarray(2).swap16().toString('utf16le');
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString('utf16le');
  }

  return bytes.toString('latin1');
};

const decodeLiteralString = (raw: string) => {
  const bytes: number[] = [];

  for (let index = 0; index < raw.length; index += 1) {
    const current = raw[index];

    if (current !== '\\') {
      bytes.push(current.charCodeAt(0));
      continue;
    }

    const next = raw[index + 1];

    if (!next) {
      break;
    }

    if (next >= '0' && next <= '7') {
      let octal = next;
      let octalIndex = index + 2;

      while (octal.length < 3 && octalIndex < raw.length) {
        const octalChar = raw[octalIndex];

        if (octalChar < '0' || octalChar > '7') {
          break;
        }

        octal += octalChar;
        octalIndex += 1;
      }

      bytes.push(parseInt(octal, 8));
      index += octal.length;
      continue;
    }

    if (next === '\r') {
      if (raw[index + 2] === '\n') {
        index += 2;
      } else {
        index += 1;
      }

      continue;
    }

    if (next === '\n') {
      index += 1;
      continue;
    }

    const mapped =
      next === 'n'
        ? '\n'
        : next === 'r'
          ? '\r'
          : next === 't'
            ? '\t'
            : next === 'b'
              ? '\b'
              : next === 'f'
                ? '\f'
                : next;

    bytes.push(mapped.charCodeAt(0));
    index += 1;
  }

  return decodePdfStringBytes(Buffer.from(bytes));
};

const extractBalancedSection = (value: string, startIndex: number, open: string, close: string) => {
  let depth = 1;
  let escaped = false;

  for (let index = startIndex + 1; index < value.length; index += 1) {
    const current = value[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (current === '\\') {
      escaped = true;
      continue;
    }

    if (current === open) {
      depth += 1;
      continue;
    }

    if (current === close) {
      depth -= 1;

      if (depth === 0) {
        return {
          body: value.slice(startIndex + 1, index),
          endIndex: index,
        };
      }
    }
  }

  return null;
};

const extractPdfStringForKey = (body: string, key: string) => {
  const keyRegex = new RegExp(`/${key}(?![A-Za-z0-9])`, 'g');
  const keyMatch = keyRegex.exec(body);

  if (!keyMatch) {
    return null;
  }

  let cursor = keyMatch.index + keyMatch[0].length;

  while (cursor < body.length && /\s/.test(body[cursor])) {
    cursor += 1;
  }

  if (body[cursor] === '(') {
    const literal = extractBalancedSection(body, cursor, '(', ')');

    return literal ? decodeLiteralString(literal.body) : null;
  }

  if (body[cursor] === '<' && body[cursor + 1] !== '<') {
    const endIndex = body.indexOf('>', cursor + 1);

    if (endIndex === -1) {
      return null;
    }

    const hex = body.slice(cursor + 1, endIndex).replace(/\s+/g, '');

    return decodePdfStringBytes(Buffer.from(hex, 'hex'));
  }

  return null;
};

const extractNameForKey = (body: string, key: string) => {
  const nameRegex = new RegExp(`/${key}(?![A-Za-z0-9])\\s*/([A-Za-z0-9_.-]+)`);
  const match = body.match(nameRegex);

  return match?.[1] ?? null;
};

const extractRefForKey = (body: string, key: string) => {
  const refRegex = new RegExp(`/${key}(?![A-Za-z0-9])\\s+(\\d+)\\s+(\\d+)\\s+R`);
  const match = body.match(refRegex);

  return match ? `${match[1]} ${match[2]} R` : null;
};

const extractRefsFromArrayForKey = (body: string, key: string) => {
  const arrayRegex = new RegExp(`/${key}(?![A-Za-z0-9])\\s*\\[([^\\]]*)\\]`, 's');
  const arrayMatch = body.match(arrayRegex);

  if (!arrayMatch) {
    return [];
  }

  return Array.from(arrayMatch[1].matchAll(/(\d+)\s+(\d+)\s+R/g)).map(
    (match) => `${match[1]} ${match[2]} R`,
  );
};

const extractNumberArrayForKey = (body: string, key: string) => {
  const arrayRegex = new RegExp(`/${key}(?![A-Za-z0-9])\\s*\\[([^\\]]*)\\]`, 's');
  const match = body.match(arrayRegex);

  if (!match) {
    return [];
  }

  return match[1]
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
};

const extractDecodedStream = (body: string) => {
  const streamStart = body.search(/stream\r?\n/);

  if (streamStart === -1) {
    return null;
  }

  const headerLength = body.slice(streamStart).startsWith('stream\r\n') ? 8 : 7;
  const streamDataStart = streamStart + headerLength;
  const streamEnd = body.indexOf('endstream', streamDataStart);

  if (streamEnd === -1) {
    return null;
  }

  const rawStream = bufferFromLatin1(body.slice(streamDataStart, streamEnd));
  const hasFlateFilter =
    /\/Filter\s*\/FlateDecode/.test(body) ||
    /\/Filter\s*\[\s*\/FlateDecode/.test(body) ||
    /\/Filter\s*<</.test(body);

  if (!hasFlateFilter) {
    return rawStream;
  }

  return zlib.inflateSync(rawStream);
};

const decodeObjectStreamEntries = (decodedStream: Buffer, first: number, count: number) => {
  const extractedObjects: TObjectRecord[] = [];
  const header = decodedStream.subarray(0, first).toString('latin1').trim();
  const body = decodedStream.subarray(first);
  const headerNumbers = header
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  for (let index = 0; index < count; index += 1) {
    const objectNumber = headerNumbers[index * 2];
    const offset = headerNumbers[index * 2 + 1];
    const nextOffset =
      index === count - 1 ? body.length : headerNumbers[index * 2 + 3] ?? body.length;

    if (!Number.isFinite(objectNumber) || !Number.isFinite(offset)) {
      continue;
    }

    const rawBody = body.subarray(offset, nextOffset).toString('latin1').trim();

    extractedObjects.push({
      objectNumber,
      generationNumber: 0,
      ref: `${objectNumber} 0 R`,
      rawBody,
      decodedStream: extractDecodedStream(rawBody),
    });
  }

  return extractedObjects;
};

const parseIndirectObjects = (pdfBytes: Buffer) => {
  const pdfText = pdfBytes.toString('latin1');
  const objects = new Map<string, TObjectRecord>();

  for (const match of pdfText.matchAll(INDIRECT_OBJECT_REGEX)) {
    const objectNumber = Number(match[1]);
    const generationNumber = Number(match[2]);
    const ref = `${objectNumber} ${generationNumber} R`;
    const rawBody = match[3];

    objects.set(ref, {
      objectNumber,
      generationNumber,
      ref,
      rawBody,
      decodedStream: extractDecodedStream(rawBody),
    });
  }

  const objectStreams = [...objects.values()].filter((object) =>
    /\/Type\s*\/ObjStm/.test(object.rawBody),
  );

  for (const objectStream of objectStreams) {
    if (!objectStream.decodedStream) {
      continue;
    }

    const firstMatch = objectStream.rawBody.match(/\/First\s+(\d+)/);
    const countMatch = objectStream.rawBody.match(/\/N\s+(\d+)/);
    const first = Number(firstMatch?.[1] ?? '');
    const count = Number(countMatch?.[1] ?? '');

    if (!Number.isFinite(first) || !Number.isFinite(count)) {
      continue;
    }

    const extracted = decodeObjectStreamEntries(objectStream.decodedStream, first, count);

    for (const entry of extracted) {
      objects.set(entry.ref, entry);
    }
  }

  return objects;
};

const buildPageList = (objects: Map<string, TObjectRecord>) => {
  const catalog = [...objects.values()].find((object) => /\/Type\s*\/Catalog/.test(object.rawBody));

  if (!catalog) {
    throw new Error('Could not locate PDF catalog');
  }

  const rootPagesRef = extractRefForKey(catalog.rawBody, 'Pages');

  if (!rootPagesRef) {
    throw new Error('Could not locate page tree root');
  }

  const orderedPages: TPageTreeNode[] = [];

  const walkPageTree = (ref: string, inheritedMediaBox: number[] | null) => {
    const object = objects.get(ref);

    if (!object) {
      throw new Error(`Missing page tree object: ${ref}`);
    }

    const localMediaBox = extractNumberArrayForKey(object.rawBody, 'MediaBox');
    const resolvedMediaBox = localMediaBox.length === 4 ? localMediaBox : inheritedMediaBox;

    if (/\/Type\s*\/Page\b/.test(object.rawBody)) {
      if (!resolvedMediaBox || resolvedMediaBox.length !== 4) {
        throw new Error(`Page ${ref} is missing a valid MediaBox`);
      }

      orderedPages.push({
        ref,
        mediaBox: resolvedMediaBox,
        annots: extractRefsFromArrayForKey(object.rawBody, 'Annots'),
      });

      return;
    }

    const children = extractRefsFromArrayForKey(object.rawBody, 'Kids');

    for (const child of children) {
      walkPageTree(child, resolvedMediaBox);
    }
  };

  walkPageTree(rootPagesRef, null);

  const pages = orderedPages.map((page, pageIndex) => {
    const ref = page.ref;
    const pageObject = objects.get(ref);

    if (!pageObject) {
      throw new Error(`Missing page object: ${ref}`);
    }

    const width = round(Math.abs(page.mediaBox[2] - page.mediaBox[0]));
    const height = round(Math.abs(page.mediaBox[3] - page.mediaBox[1]));

    return {
      ref,
      info: {
        pageNumber: pageIndex + 1,
        width,
        height,
      },
    };
  });

  const widgetPageRefByWidgetRef = new Map<string, string>();

  for (const page of orderedPages) {
    for (const annotRef of page.annots) {
      if (!widgetPageRefByWidgetRef.has(annotRef)) {
        widgetPageRefByWidgetRef.set(annotRef, page.ref);
      }
    }
  }

  return {
    pages,
    pageNumberByRef: new Map(pages.map((page) => [page.ref, page.info.pageNumber])),
    pageInfoByRef: new Map(pages.map((page) => [page.ref, page.info])),
    widgetPageRefByWidgetRef,
  };
};

const extractAcroformFields = (
  objects: Map<string, TObjectRecord>,
  pageNumberByRef: Map<string, number>,
  pageInfoByRef: Map<string, TPageInfo>,
  widgetPageRefByWidgetRef: Map<string, string>,
) => {
  const catalog = [...objects.values()].find((object) => /\/Type\s*\/Catalog/.test(object.rawBody));

  if (!catalog) {
    throw new Error('Could not locate PDF catalog for AcroForm extraction');
  }

  const acroFormRef = extractRefForKey(catalog.rawBody, 'AcroForm');

  if (!acroFormRef) {
    throw new Error('Could not locate AcroForm object');
  }

  const acroFormObject = objects.get(acroFormRef);

  if (!acroFormObject) {
    throw new Error('Could not load AcroForm object');
  }

  const rootFieldRefs = extractRefsFromArrayForKey(acroFormObject.rawBody, 'Fields');
  const widgets: TLowLevelWidget[] = [];

  const walkFieldTree = (ref: string, context: TLowLevelFieldContext) => {
    const object = objects.get(ref);

    if (!object) {
      throw new Error(`Missing field object: ${ref}`);
    }

    const localName = extractPdfStringForKey(object.rawBody, 'T');
    const localTooltip = extractPdfStringForKey(object.rawBody, 'TU');
    const fieldType = extractNameForKey(object.rawBody, 'FT') ?? context.rawType;
    const explicitPageRef = extractRefForKey(object.rawBody, 'P');
    const inheritedPageRef = explicitPageRef ?? context.pageRef;
    const rectNumbers = extractNumberArrayForKey(object.rawBody, 'Rect');
    const kids = extractRefsFromArrayForKey(object.rawBody, 'Kids');
    const hasWidgetRect = rectNumbers.length === 4;
    const isWidget = hasWidgetRect || /\/Subtype\s*\/Widget/.test(object.rawBody);
    const nextContext: TLowLevelFieldContext = {
      nameParts: localName ? [...context.nameParts, localName] : context.nameParts,
      rawType: fieldType,
      rawTooltip: localTooltip ?? context.rawTooltip,
      pageRef: inheritedPageRef,
    };

    if (isWidget && rectNumbers.length === 4) {
      const pageRef = explicitPageRef ?? context.pageRef ?? widgetPageRefByWidgetRef.get(ref) ?? null;

      if (!pageRef) {
        throw new Error(`Widget ${ref} is missing a page reference`);
      }

      const pageNumber = pageNumberByRef.get(pageRef);
      const pageInfo = pageInfoByRef.get(pageRef);

      if (!pageNumber || !pageInfo) {
        throw new Error(`Widget ${ref} references an unknown page: ${pageRef}`);
      }

      const rectPdf = normalizeRect(rectNumbers);
      const rawName = nextContext.nameParts.length > 0 ? nextContext.nameParts.join('.') : null;

      widgets.push({
        ref,
        sourceKey: rawName ?? ref.replaceAll(' ', '_'),
        rawName,
        rawType: fieldType,
        rawTooltip: localTooltip ?? context.rawTooltip,
        page: pageNumber,
        rectPdf,
        rectDocumenso: toDocumensoRect(rectPdf, pageInfo.width, pageInfo.height),
      });
    }

    for (const kid of kids) {
      walkFieldTree(kid, nextContext);
    }
  };

  for (const fieldRef of rootFieldRefs) {
    walkFieldTree(fieldRef, {
      nameParts: [],
      rawType: null,
      rawTooltip: null,
      pageRef: null,
    });
  }

  return widgets.sort((left, right) => {
    if (left.page !== right.page) {
      return left.page - right.page;
    }

    if (left.rectPdf.y2 !== right.rectPdf.y2) {
      return right.rectPdf.y2 - left.rectPdf.y2;
    }

    return left.rectPdf.x1 - right.rectPdf.x1;
  });
};

const normalizePdfJsFieldType = (value: string) => {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'text') {
    return 'Tx';
  }

  if (normalized === 'button' || normalized === 'checkbox' || normalized === 'radiobutton') {
    return 'Btn';
  }

  if (normalized === 'signature') {
    return 'Sig';
  }

  return value;
};

const tryExtractWithPdfJs = async (pdfBytes: Buffer): Promise<TPdfJsInventoryResult> => {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(pdfBytes) });
    const document = await task.promise;
    const pages: TPageInfo[] = [];
    const fields: TPdfJsField[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });

      pages.push({
        pageNumber,
        width: round(viewport.width),
        height: round(viewport.height),
      });

      const annotations = await page.getAnnotations();

      for (const annotation of annotations as Array<Record<string, unknown>>) {
        const isWidget = annotation.subtype === 'Widget' || annotation.annotationType === 20;
        const rect = Array.isArray(annotation.rect)
          ? annotation.rect.map((value) => Number(value)).filter((value) => Number.isFinite(value))
          : [];

        if (!isWidget || rect.length !== 4) {
          continue;
        }

        const fieldName =
          typeof annotation.fieldName === 'string'
            ? annotation.fieldName
            : typeof annotation.fullName === 'string'
              ? annotation.fullName
              : null;
        const rawType =
          typeof annotation.fieldType === 'string'
            ? normalizePdfJsFieldType(annotation.fieldType)
            : typeof annotation.buttonValue === 'string'
              ? 'Btn'
              : null;
        const rawTooltip =
          typeof annotation.alternativeText === 'string'
            ? annotation.alternativeText
            : typeof annotation.title === 'string'
              ? annotation.title
              : null;
        const rectPdf = normalizeRect(rect);

        fields.push({
          sourceKey: fieldName ?? `page${pageNumber}-widget-${fields.length + 1}`,
          rawName: fieldName,
          rawType,
          rawTooltip,
          page: pageNumber,
          rectPdf,
          rectDocumenso: toDocumensoRect(rectPdf, viewport.width, viewport.height),
        });
      }
    }

    await document.destroy();
    await task.destroy();

    return {
      pages,
      fields,
    };
  } catch {
    return null;
  }
};

const mergePdfJsWithFallback = (
  pdfJsInventory: TPdfJsInventoryResult,
  fallbackPages: TPageInfo[],
  fallbackFields: TLowLevelWidget[],
) => {
  if (!pdfJsInventory) {
    return {
      pages: fallbackPages,
      fields: fallbackFields,
      extractionMethod: 'fallback-structure',
    };
  }

  const completePdfJs =
    pdfJsInventory.fields.length === fallbackFields.length &&
    pdfJsInventory.fields.every(
      (field) => field.rawName && field.rawType && Number.isInteger(field.page) && field.rectDocumenso.width > 0,
    );

  if (completePdfJs) {
    return {
      pages: pdfJsInventory.pages,
      fields: pdfJsInventory.fields,
      extractionMethod: 'pdfjs-dist',
    };
  }

  const mergedFields = fallbackFields.map((fallbackField, index) => {
    const pdfJsField = pdfJsInventory.fields[index];

    if (!pdfJsField) {
      return fallbackField;
    }

    return {
      ...fallbackField,
      rawTooltip: pdfJsField.rawTooltip ?? fallbackField.rawTooltip,
    };
  });

  return {
    pages: fallbackPages,
    fields: mergedFields,
    extractionMethod: 'pdfjs-dist+fallback-structure',
  };
};

export const extractAcroformInventory = async (pdfPath: string): Promise<TAcroformInventory> => {
  const pdfBytes = await fs.readFile(pdfPath);
  const sha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex');
  const pdfJsInventory = await tryExtractWithPdfJs(pdfBytes);
  const objects = parseIndirectObjects(pdfBytes);
  const { pages, pageNumberByRef, pageInfoByRef, widgetPageRefByWidgetRef } = buildPageList(objects);
  const fallbackFields = extractAcroformFields(
    objects,
    pageNumberByRef,
    pageInfoByRef,
    widgetPageRefByWidgetRef,
  );
  const merged = mergePdfJsWithFallback(
    pdfJsInventory,
    pages.map((page) => page.info),
    fallbackFields,
  );

  return {
    source: {
      pdfPath,
      sha256,
      extractorVersion: EXTRACTOR_VERSION,
      extractionMethod: merged.extractionMethod,
    },
    pages: merged.pages,
    fields: merged.fields.map((field) => ({
      sourceKey: field.sourceKey,
      rawName: field.rawName,
      rawType: field.rawType,
      rawTooltip: field.rawTooltip,
      page: field.page,
      rectPdf: field.rectPdf,
      rectDocumenso: field.rectDocumenso,
    })),
  };
};
