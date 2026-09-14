# Notes

Known issues to address at a later date.

## Sealing: libpdf drops inherited page attributes when flattening the page tree

`PDF.copyPagesFrom` (used to append the certificate and audit log pages during
sealing) calls `PDFPageTree.flattenIfNeeded`, which rewrites the page tree to a
single level by re-parenting every page directly to the root `/Pages` node.

It does this **without** copying inheritable attributes (`MediaBox`, `CropBox`,
`Rotate`, `Resources`) down onto the pages first. The PDF spec allows these to
be defined on any node in the `/Pages` tree and inherited by descendants.

Impact: a PDF which defines e.g. `MediaBox` or `Rotate` on an intermediate
`/Pages` node (rather than the root or the page itself) loses those attributes
when sealed with the certificate or audit log enabled. Viewers then fall back to
their defaults, so the sealed page renders as US Letter and/or unrotated.

Attributes defined on the root `/Pages` node survive, since pages are
re-parented to the root.

Suggested fix: before any page tree mutation, materialize the inherited
attributes onto each page dictionary (walk `/Parent` for each key, as
`getInheritedPageAttribute` in `packages/lib/server-only/pdf/insert-page-overlay.ts`
does). A reproduction test would load a PDF with an intermediate `/Pages` node
carrying the `MediaBox`, seal it with the certificate enabled, and assert the
page size is preserved.

References:

- `node_modules/@libpdf/core/dist/index.mjs` — `PDFPageTree.flattenIfNeeded`
- `packages/lib/jobs/definitions/internal/seal-document.handler.ts` — `copyPagesFrom`

## CSC/TSP overlay uses the user space origin and libpdf's raw page size

`packages/ee/server-only/signing/csc/render-overlay.ts` renders a recipient's
fields into a `/Stamp` annotation appearance sized `[0 0 page.width page.height]`
and painted at the user space origin.

Two issues, both shared with the SES sealing path before it was fixed in
`packages/lib/server-only/pdf/insert-page-overlay.ts`:

1. The frame is the user space origin rather than the page's visible box
   (`CropBox` intersected with `MediaBox`), which is the frame pdf.js uses on
   the client. Pages with a `CropBox` or a non zero `MediaBox` origin have their
   fields offset by the box origin.
2. `page.width` / `page.height` in libpdf return the box's far corner
   coordinates (`x2` / `y2`), not its extents, and do not resolve attributes
   inherited from the `/Pages` tree. Cropped, offset or inherited pages get
   the wrong size, and therefore the wrong scale.

This was deliberately left untouched since the TSP path is sensitive to
incremental updates and `/ByteRange` validity, and the stamp `/Rect` is
materialized elsewhere with the same assumptions.

Suggested fix: apply `getPageVisibleBox` / `getPageDisplaySize` from
`insert-page-overlay.ts` to both the stamp `/Rect` materialization and the
appearance stream `/BBox`, so the appearance is positioned within the visible
box. Verify with the same pdf.js rasterization approach used in
`insert-page-overlay.test.ts`.

References:

- `packages/ee/server-only/signing/csc/render-overlay.ts`
- Wherever `materializeTspAnchorsForEnvelope` sets the stamp `/Rect`
