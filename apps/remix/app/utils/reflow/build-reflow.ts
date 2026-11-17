/**
 * Rebuilds a PDF's text as paragraphs that wrap to the screen, with the signer's fields placed where they sit
 * in the text, for the easy-read signing view on phones. The PDF stays the document that is signed and sealed.
 *
 * Pure (no pdf.js): the caller passes each page's text items and the fields, in PDF points with the origin at
 * the top left of the page.
 */

export type ReflowTextItem = {
  str: string;
  /** Left edge of the text. */
  x: number;
  /** Baseline, from the top of the page. */
  baseline: number;
  width: number;
  /** Font size. */
  size: number;
  /** Font name, e.g. "AAAAAA+Arial-BoldMT" (bold and italic are read from it). */
  font: string;
};

export type ReflowPage = {
  pageNumber: number;
  width: number;
  height: number;
  items: ReflowTextItem[];
};

export type ReflowFieldBox = {
  id: number;
  page: number;
  /** Top left corner, width and height. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ReflowRun =
  | { kind: 'text'; text: string; bold: boolean; italic: boolean }
  | { kind: 'field'; fieldId: number };

export type ReflowBlock = {
  page: number;
  runs: ReflowRun[];
  /** Font size relative to the document's body text (1 = body). */
  scale: number;
  align: 'left' | 'center';
  indent: boolean;
};

type Token =
  | { kind: 'text'; item: ReflowTextItem; bold: boolean; italic: boolean }
  | { kind: 'field'; x: number; fieldId: number };

type Line = {
  page: number;
  baseline: number;
  size: number;
  left: number;
  right: number;
  tokens: Token[];
  /** A line made only of a field that sits on no line of text. */
  fieldOnly: boolean;
};

/** Text hidden in the PDF (e.g. 2 pt field placeholders) is not part of what the signer reads. */
const MIN_VISIBLE_SIZE = 3;
const PLACEHOLDER = /\{\{[^}]*\}\}/g;
const BLANK_LINE = /^_{3,}$/;
const SENTENCE_END = /[.:;!?]["'”’)]*$/;

const isBold = (font: string) => /bold|black|heavy|semibold|demi/i.test(font);
const isItalic = (font: string) => /italic|oblique/i.test(font);

const mostCommon = (values: number[]) => {
  const counts = new Map<number, number>();
  let best = values[0] ?? 0;

  for (const v of values) {
    const key = Math.round(v * 2) / 2;
    const count = (counts.get(key) ?? 0) + 1;

    counts.set(key, count);

    if (count > (counts.get(best) ?? 0)) {
      best = key;
    }
  }

  return best;
};

const linesOfPage = (page: ReflowPage, fields: ReflowFieldBox[]): Line[] => {
  const items = page.items
    .map((item) => ({ ...item, str: item.str.replace(PLACEHOLDER, '') }))
    .filter((item) => item.size >= MIN_VISIBLE_SIZE && item.str.length > 0)
    .sort((a, b) => a.baseline - b.baseline || a.x - b.x);

  const lines: Line[] = [];

  for (const item of items) {
    const line = lines.find((l) => Math.abs(l.baseline - item.baseline) <= Math.max(2, item.size * 0.3));
    const token: Token = { kind: 'text', item, bold: isBold(item.font), italic: isItalic(item.font) };

    if (line) {
      line.tokens.push(token);
      line.left = Math.min(line.left, item.x);
      line.right = Math.max(line.right, item.x + item.width);
    } else {
      lines.push({
        page: page.pageNumber,
        baseline: item.baseline,
        size: item.size,
        left: item.x,
        right: item.x + item.width,
        tokens: [token],
        fieldOnly: false,
      });
    }
  }

  // Lines of whitespace only (e.g. table padding) carry nothing to read.
  const textLines = lines.filter((l) => l.tokens.some((t) => t.kind === 'text' && t.item.str.trim()));

  for (const line of textLines) {
    const sizes = line.tokens.flatMap((t) => (t.kind === 'text' && t.item.str.trim() ? [t.item.size] : []));
    line.size = mostCommon(sizes);
  }

  for (const field of fields.filter((f) => f.page === page.pageNumber)) {
    const center = field.y + field.height / 2;

    let best: Line | null = null;
    let bestDistance = Infinity;

    for (const line of textLines) {
      const top = line.baseline - line.size * 0.95 - 4;
      const bottom = line.baseline + line.size * 0.3 + 4;

      if (center < top || center > bottom) {
        continue;
      }

      const distance = Math.abs(center - (line.baseline - line.size * 0.35));

      if (distance < bestDistance) {
        best = line;
        bestDistance = distance;
      }
    }

    if (best) {
      best.tokens.push({ kind: 'field', x: field.x, fieldId: field.id });
      best.left = Math.min(best.left, field.x);
      best.right = Math.max(best.right, field.x + field.width);
    } else {
      textLines.push({
        page: page.pageNumber,
        baseline: field.y + field.height,
        size: 0,
        left: field.x,
        right: field.x + field.width,
        tokens: [{ kind: 'field', x: field.x, fieldId: field.id }],
        fieldOnly: true,
      });
    }
  }

  for (const line of textLines) {
    line.tokens.sort((a, b) => (a.kind === 'text' ? a.item.x : a.x) - (b.kind === 'text' ? b.item.x : b.x));

    // A drawn blank ("______") under or beside a field is replaced by the field.
    if (line.tokens.some((t) => t.kind === 'field')) {
      line.tokens = line.tokens.filter((t) => t.kind === 'field' || !BLANK_LINE.test(t.item.str.trim()));
    }
  }

  return textLines.sort((a, b) => a.baseline - b.baseline || a.left - b.left);
};

/** Text of a line as runs: words joined with single spaces, a run per style, fields in place. */
const runsOfLine = (line: Line): ReflowRun[] => {
  const runs: ReflowRun[] = [];
  let previous: Token | null = null;

  for (const token of line.tokens) {
    if (token.kind === 'field') {
      runs.push({ kind: 'field', fieldId: token.fieldId });
      previous = token;
      continue;
    }

    let text = token.item.str.replace(/\s+/g, ' ');

    if (previous?.kind === 'text') {
      const gap = token.item.x - (previous.item.x + previous.item.width);
      const joined = /\s$/.test(previous.item.str) || /^\s/.test(text);

      if (!joined && gap > token.item.size * 0.15) {
        text = ` ${text}`;
      }
    }

    const last = runs[runs.length - 1];

    if (last?.kind === 'text' && last.bold === token.bold && last.italic === token.italic) {
      last.text = (last.text + text).replace(/ {2,}/g, ' ');
    } else {
      runs.push({ kind: 'text', text, bold: token.bold, italic: token.italic });
    }

    previous = token;
  }

  return runs;
};

const firstText = (line: Line) => {
  const first = line.tokens[0];

  return first?.kind === 'text' ? first.item.str.trim() : '';
};

const lastText = (line: Line) => {
  const last = line.tokens[line.tokens.length - 1];

  return last?.kind === 'text' ? last.item.str.trim() : '';
};

/**
 * Rebuild the document as blocks of text. Lines are joined into one paragraph when the first one was wrapped
 * (it reaches the right edge) or the sentence plainly carries on (no full stop, the next line starts in lower
 * case or with a field); headings, list items and "Label: [field]" rows stay on their own.
 */
export const buildReflowBlocks = (pages: ReflowPage[], fields: ReflowFieldBox[]): ReflowBlock[] => {
  const lines = pages.flatMap((page) => linesOfPage(page, fields));

  const textLines = lines.filter((l) => !l.fieldOnly);
  const bodySize = mostCommon(textLines.map((l) => l.size)) || 10;

  // The text column, per page.
  const columns = new Map<number, { left: number; right: number }>();

  for (const page of pages) {
    const pageLines = textLines.filter((l) => l.page === page.pageNumber);

    if (pageLines.length === 0) {
      continue;
    }

    columns.set(page.pageNumber, {
      left: Math.min(...pageLines.map((l) => l.left)),
      right: Math.max(...pageLines.map((l) => l.right)),
    });
  }

  const blocks: (ReflowBlock & { left: number; size: number })[] = [];
  let previous: Line | null = null;
  let block: (ReflowBlock & { left: number; size: number }) | null = null;

  for (const line of lines) {
    const column = columns.get(line.page) ?? { left: line.left, right: line.right };
    const width = Math.max(1, column.right - column.left);

    const samePage = !!previous && line.page === previous.page;
    const gap = previous ? line.baseline - previous.baseline : Infinity;

    // A wrapped line (it reached the right edge) carries on at the usual line spacing; a sentence that
    // plainly carries on may sit a little lower (a line holding a field is taller).
    const hasField = (l: Line) => l.tokens.some((t) => t.kind === 'field');
    const lineSpacing = previous && (hasField(previous) || hasField(line)) ? 2.3 : 1.75;
    // Wrapped means words reached the edge: a "Label: [field]" row whose field reaches it is not wrapped.
    const wrapped =
      !!previous &&
      previous.tokens[previous.tokens.length - 1]?.kind === 'text' &&
      previous.right >= column.right - width * 0.12 &&
      (!samePage || gap <= previous.size * lineSpacing);
    const sentenceCarriesOn =
      !!previous &&
      !SENTENCE_END.test(lastText(previous)) &&
      (line.tokens[0]?.kind === 'field' || /^[a-z(“"]/.test(firstText(line))) &&
      (!samePage || gap <= previous.size * 2.3);

    // A title set on two centred lines.
    const centred = (l: Line) => {
      const leftGap = l.left - column.left;

      return leftGap > 20 && Math.abs(leftGap - (column.right - l.right)) < 14;
    };
    const titleCarriesOn = !!previous && samePage && centred(previous) && centred(line) && gap <= previous.size * 1.6;

    const continues =
      !!previous &&
      !!block &&
      !line.fieldOnly &&
      !previous.fieldOnly &&
      Math.abs(line.size - previous.size) < 0.6 &&
      (titleCarriesOn || (Math.abs(line.left - block.left) <= 6 && (wrapped || sentenceCarriesOn)));

    const runs = runsOfLine(line);

    if (continues && block) {
      const last = block.runs[block.runs.length - 1];
      const first = runs[0];

      if (last?.kind === 'text' && first?.kind === 'text' && !/\s$/.test(last.text) && !/^\s/.test(first.text)) {
        first.text = ` ${first.text}`;
      }

      block.runs.push(...runs);
    } else {
      const size = line.fieldOnly ? bodySize : line.size;
      const leftGap = line.left - column.left;
      const rightGap = column.right - line.right;

      block = {
        page: line.page,
        runs,
        scale: Math.min(1.5, Math.max(0.8, size / bodySize)),
        align: !line.fieldOnly && leftGap > 20 && Math.abs(leftGap - rightGap) < 14 ? 'center' : 'left',
        indent: !line.fieldOnly && leftGap > 6 && Math.abs(leftGap - rightGap) >= 14,
        left: line.left,
        size,
      };

      blocks.push(block);
    }

    previous = line;
  }

  // Merge runs of the same style that the line joins split, and trim the ends.
  return blocks.map(({ left: _left, size: _size, ...rest }) => {
    const runs: ReflowRun[] = [];

    for (const run of rest.runs) {
      const last = runs[runs.length - 1];

      if (run.kind === 'text' && last?.kind === 'text' && last.bold === run.bold && last.italic === run.italic) {
        last.text = (last.text + run.text).replace(/ {2,}/g, ' ');
      } else {
        runs.push(run.kind === 'text' ? { ...run } : run);
      }
    }

    const first = runs[0];
    const last = runs[runs.length - 1];

    if (first?.kind === 'text') {
      first.text = first.text.trimStart();
    }
    if (last?.kind === 'text') {
      last.text = last.text.trimEnd();
    }

    return { ...rest, runs: runs.filter((r) => r.kind === 'field' || r.text.length > 0) };
  });
};
