---
date: 2026-02-11
title: Cert Page Width Mismatch
---

## Problem

Certificate and audit log pages are generated with hardcoded A4 dimensions (`PDF_SIZE_A4_72PPI`: 595×842) regardless of the actual document page sizes. When the source document uses a different page size (e.g., Letter, Legal, or custom dimensions), the certificate/audit log pages end up with a different width than the document pages. This causes problems with courts that expect uniform page dimensions throughout a PDF.

**Both width and height must match** the last page of the document so the entire PDF prints uniformly.

**Root cause**: In `seal-document.handler.ts` (lines 186-187), the certificate payload always uses:

```ts
pageWidth: PDF_SIZE_A4_72PPI.width,  // 595
pageHeight: PDF_SIZE_A4_72PPI.height, // 842
```

These hardcoded values flow into `generateCertificatePdf`, `generateAuditLogPdf`, `renderCertificate`, and `renderAuditLogs` — all of which use `pageWidth`/`pageHeight` to set Konva stage dimensions and layout content.

## Key Files

| File                                                                    | Role                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/lib/jobs/definitions/internal/seal-document.handler.ts`       | Orchestrates sealing; passes page dimensions to cert/audit generators                 |
| `packages/lib/constants/pdf.ts`                                         | Defines `PDF_SIZE_A4_72PPI` (595×842)                                                 |
| `packages/lib/server-only/pdf/generate-certificate-pdf.ts`              | Generates certificate PDF; accepts `pageWidth`/`pageHeight`                           |
| `packages/lib/server-only/pdf/generate-audit-log-pdf.ts`                | Generates audit log PDF; accepts `pageWidth`/`pageHeight`                             |
| `packages/lib/server-only/pdf/render-certificate.ts`                    | Renders certificate pages via Konva; uses `pageWidth`/`pageHeight` for stage + layout |
| `packages/lib/server-only/pdf/render-audit-logs.ts`                     | Renders audit log pages via Konva; uses `pageWidth`/`pageHeight` for stage + layout   |
| `packages/lib/server-only/pdf/get-page-size.ts`                         | Existing utility — extend with `@libpdf/core` version                                 |
| `packages/trpc/server/document-router/download-document-certificate.ts` | Standalone certificate download (also hardcodes A4)                                   |
| `packages/trpc/server/document-router/download-document-audit-logs.ts`  | Standalone audit log download (also hardcodes A4)                                     |

## Architecture

### Current Flow

1. **One cert PDF + one audit log PDF** generated per envelope with hardcoded A4 dims
2. Both appended to **every** envelope item (document) via `decorateAndSignPdf` → `pdfDoc.copyPagesFrom()`
3. The audit log is envelope-level (all recipients, all events across all docs) — one per envelope, not per document

### Multi-Document Envelopes

- V1 envelopes: single document only
- V2 envelopes: support multiple documents (envelope items)
- Each envelope item gets both cert + audit log pages appended to it
- If documents have different page sizes → need size-matched cert/audit for each

### Reading Page Dimensions (`@libpdf/core` only)

Use `@libpdf/core`'s `PDF` class — NOT `@cantoo/pdf-lib`:

```ts
const pdfDoc = await PDF.load(pdfData);
const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
const { width, height } = lastPage; // e.g. 612, 792 for Letter
```

Already used this way in `seal-document.handler.ts` lines 403-410 for V2 field insertion.
"Last page" = last page of the original document, before cert/audit pages are appended.

### Content Layout Adaptation

Both renderers already handle variable dimensions gracefully:

- **Width**: `render-certificate.ts:713` / `render-audit-logs.ts:588` — `Math.min(pageWidth - minimumMargin * 2, contentMaxWidth)` with `contentMaxWidth = 768`. Wider pages get more margin, narrower pages tighter margins.
- **Height**: Both renderers paginate content into pages using `groupRowsIntoPages()` which respects `pageHeight` via `maxTableHeight = pageHeight - pageTopMargin - pageBottomMargin`. Shorter pages just mean more pages; taller pages fit more rows per page.

### Playwright PDF Path — Out of Scope

The `NEXT_PRIVATE_USE_PLAYWRIGHT_PDF` toggle enables a deprecated Playwright-based PDF generation path (`get-certificate-pdf.ts`, `get-audit-logs-pdf.ts`) that also hardcodes `format: 'A4'` in `page.pdf()`. This path is **not being updated** as part of this fix:

- Both files are marked `@deprecated`
- The Konva-based path is the default and recommended path
- The Playwright path is behind a feature flag and will be removed

No changes needed. Add a code comment noting the A4 limitation if the Playwright path is ever re-enabled.

## Plan

### 1. Extend `get-page-size.ts` with `@libpdf/core` utility

Add a `getLastPageDimensions` function to the existing `packages/lib/server-only/pdf/get-page-size.ts` file. This consolidates page-size logic in one place (the file already has the legacy `@cantoo/pdf-lib` version).

```ts
export const getLastPageDimensions = (pdfDoc: PDF): { width: number; height: number } => {
  const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
  const width = Math.round(lastPage.width);
  const height = Math.round(lastPage.height);

  if (width < MIN_CERT_PAGE_WIDTH || height < MIN_CERT_PAGE_HEIGHT) {
    return { width: PDF_SIZE_A4_72PPI.width, height: PDF_SIZE_A4_72PPI.height };
  }

  return { width, height };
};
```

**Dimension rounding**: `Math.round()` both width and height. PDF points at 72ppi are typically whole numbers; rounding avoids spurious float-precision mismatches (e.g., 612.0 vs 612.00001) that would cause unnecessary duplicate cert/audit PDF generation.

**Minimum page dimensions**: Enforce a minimum threshold (e.g., 300pt for both width and height). If either dimension falls below the minimum, fall back to A4 (595×842). The certificate and audit log renderers have headers, table rows, margins, and QR codes that require a minimum viable area.

### 2. Read last page dimensions from each envelope item's PDF

In `seal-document.handler.ts`, before generating cert/audit PDFs:

- For each `envelopeItem`, load the PDF and read the **last page's width and height** using `getLastPageDimensions`
- Use `PDF.load()` then pass the loaded doc to the utility

**Resealing consideration**: When `isResealing` is true, envelope items are remapped to use `initialData` (lines 152-158) before this point. Page-size extraction must operate on the same data source that `decorateAndSignPdf` will use. Since the `envelopeItems` array is already remapped by the time we read dimensions, reading from `envelopeItem.documentData` will naturally give the correct (initial) data. No special handling needed beyond ensuring the dimension read happens **after** the resealing remap.

### 3. Generate cert/audit PDFs per unique page size

Current flow generates one cert + one audit log doc per envelope. Change to:

1. Collect `{ width, height }` of the last page for each envelope item
2. Deduplicate by `"${width}x${height}"` key (using the already-rounded integers)
3. For each unique size, generate cert PDF and audit log PDF with those dimensions
4. Store in a `Map<string, { certificateDoc, auditLogDoc }>` keyed by `"${width}x${height}"`

For the common single-document case, this is one generation — same perf as today.

### 4. Thread the correct docs into `decorateAndSignPdf`

In the envelope item loop, look up the item's last-page dimensions in the map and pass the matching cert/audit docs. Signature of `decorateAndSignPdf` doesn't change — it still receives a single `certificateDoc` and `auditLogDoc`, just the right ones per item.

### 5. Update standalone download routes

`download-document-certificate.ts` and `download-document-audit-logs.ts` also hardcode A4:

- Both routes have `documentId` which maps to a specific envelope item
- Fetch **that specific document's** PDF data, load it, read last page width + height via `getLastPageDimensions`
- Pass `{ pageWidth, pageHeight }` to the generator
- This ensures the standalone download matches the dimensions the user would see in the sealed PDF for that document

### 6. Edge cases

| Scenario                                | Behavior                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Mixed page sizes within one PDF         | Use last page's dimensions (per spec)                                                       |
| Page dimensions below minimum threshold | Fall back to A4 (595×842)                                                                   |
| Landscape pages                         | width/height just swap roles; renderers adapt via `Math.min()` capping. No special handling |
| Fallback if page dims unreadable        | Default to A4 (595×842)                                                                     |
| Resealing                               | Dimensions read after `initialData` remap — correct source automatically                    |
| Playwright PDF path enabled             | Remains A4 — out of scope, deprecated                                                       |
| Single-doc envelope (most common)       | One generation, same perf as today                                                          |
| Multi-doc envelope, same page sizes     | Dedup key matches → one generation                                                          |
| Multi-doc envelope, different sizes     | One generation per unique size                                                              |

### 7. Tests

- Add assertion-based E2E test (no visual regression / reference images needed)
- Seal a Letter-size (612×792) PDF through the full flow
- Load the sealed output and assert all pages (document + cert + audit) have matching width/height
- Can be added to `envelope-alignment.spec.ts` or as a new focused test

## Implementation Steps

1. **Extend `get-page-size.ts`** — add `getLastPageDimensions(pdfDoc: PDF): { width: number; height: number }` using `@libpdf/core`, with `Math.round()` and minimum dimension enforcement
2. **In `seal-document.handler.ts`**:
   a. After the resealing remap (line ~159), load each envelope item's PDF via `PDF.load()` and collect last page `{ width, height }` using `getLastPageDimensions`
   b. Deduplicate by `"${width}x${height}"` key
   c. Generate cert/audit PDFs per unique size (parallel via `Promise.all`)
   d. In envelope item loop, look up matching cert/audit doc by size key
3. **Fix `download-document-certificate.ts`** — load the specific document's PDF, read last page dims via `getLastPageDimensions`, pass to generator
4. **Fix `download-document-audit-logs.ts`** — same as above, using the specific `documentId`'s PDF
5. **Add E2E test** — assertion-based test with a Letter-size document verifying all page dimensions match after sealing
