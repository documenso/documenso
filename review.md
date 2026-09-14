# Review: `feat/add-content-fields` (vs `779de01fe`, includes working tree)

138 files, ~14k lines. Five domain reviews (fields editor, contents editor, client rendering/signing, server sealing, persistence/API), then one independent read-only verification per issue (none refuted, several narrowed). Severity is mine after verification. Line numbers refer to the files as they are on disk now.

## A. Field regressions

None outstanding.

## B. Bugs (new feature)

### B1. One failed image request bricks the whole signing session, and storage errors are reported as 404 so the client never retries — Medium
(a) `envelope-signer-page-renderer.tsx:111-115` and `envelope-generic-page-renderer.tsx:66-70` call `setRenderError(true)`; `renderError` is provider-wide, never reset (no `setRenderError(false)` exists), and `envelope-pdf-viewer.tsx:46-65` replaces the entire viewer with an alert across all pages and items. `hasFailedImage` is per page but images load eagerly per item, so the alert fires once the failed page is within the virtualiser's overscan. (b) `get-data-content-image.ts:141-152` maps any `getFileServerSide` failure (S3 5xx/throttle/timeout) to 404; `load-content-image.ts:113-119` only retries ≥500/`TypeError`. (c) `fetch` (`load-content-image.ts`) has no timeout, so a stalled request leaves the page on its loader indefinitely.

Replicate: send a document with an image content → open `/sign/:token` → DevTools: block `*/dataContent/*/image` → reload: "Configuration Error" alert replaces the viewer. Variant: stall the request instead → the page sits on its loader indefinitely.

Consequence: signer blocked until a reload with healthy storage; transient storage errors become terminal. Fail-closed is intentional per code comments, but there is no recovery, and transient errors are misclassified.

### B2. TSP (AES/QES) signers see contents twice while the document is pending — Medium for CSC deployments
Introduced by the fix for the earlier "CSC envelopes never get contents imprinted" issue. TSP envelopes imprint their contents at send time (`materialize-anchors.ts`, called from `send-document.ts:280`), but the client only stops drawing contents once the envelope is sealed: `envelope-signer-page-renderer.tsx:546` and `envelope-generic-page-renderer.tsx:42` gate on `isEnvelopeSealed`, which is `COMPLETED | REJECTED` (`envelope.ts:247-249`), as does the image loading gate (`envelope-render-provider.tsx:327`). So for the whole of `PENDING` the contents are both in the PDF bytes and drawn on top of them.

Replicate: CSC instance → V2 document (resolves AES) with a highlight or any content at partial opacity → send → open `/sign/:token`: the content is drawn twice, appearing darker than authored. Opaque contents hide the effect.

Consequence: every TSP signing session misrepresents the document. The gate needs to be "sealed, or TSP and past DRAFT" rather than just sealed.

### B3. TSP envelopes where no recipient has to act never get their contents imprinted — Medium for CSC deployments
`send-document.ts:236-255` returns early when every recipient is CC or already SIGNED, triggering the seal job directly. That return sits before the materialise call at `:280`, which is the only place TSP envelopes imprint contents, and the seal job itself early-returns for TSP. So this envelope shape still reaches completion with its contents missing.

Replicate: CSC instance → V2 document (resolves AES) with a content and only CC recipients → send → the completed PDF has no content.

Consequence: the same "signer saw X, signed Y" gap the imprint was added to close, for a narrower set of envelopes.

## C. Notes (not counted as bugs)

- If a content image could not be loaded at seal time the job would throw and the document would be stuck, with no way to edit contents once out of DRAFT. Not reachable: nothing in the product deletes stored files (`deleteFile` has no callers), `createImageDataContent` only creates the row after a successful upload, uploads are re-encoded by sharp, and a deleted `DataContent` row degrades to no image via `onDelete: SetNull`. Losing stored objects externally would take the PDFs themselves with it.

- Rotated contents may extend slightly past the page edge: the transformer does not clamp rotated boxes, and the write-back clamps each value independently. Accepted — the editor and the sealed PDF crop identically, so what is authored is what is produced.

- The editor draws contents over the already-imprinted PDF for sealed documents (`/edit` is reachable by URL for COMPLETED/REJECTED and shows the sealed `current` PDF, while `use-envelope-canvas-contents-layer.ts` renders `localContents` unconditionally; preview and signing views correctly skip). Accepted — the editor is not interactive for a sealed envelope and nobody is expected to be on that screen.

- Selecting a content persists a new `zIndex` and triggers a save on every click; there is no send-to-back. By design, but it means "click a rectangle to recolour it" can permanently hide the text above it.
- `DataContent` rows and stored objects are never deleted (envelope deletion, orphans) — previously accepted as matching `DocumentData`.
- `notes.md` hazards: the libpdf inherited-attribute issue and the CSC overlay frame are pre-existing; this branch improves the common case for fields (root-level inherited boxes now resolved).
- Action-bar buttons bind both `onClick` and `onTouchEnd` (double-fire on touch); carried over from the old fields code.

## D. Checked and found intact

- Field rendering, recipient colours, drag/resize write-back, transformer config (no leak of content config; page clamp is a tightening), click/shift/marquee selection, action bar actions, overlap warning, auto-select on create, autosave payloads: same as base.
- Envelopes with no contents: zero new network requests, same readiness gate, identical field rendering in editor, signing and viewer; contents always `listening(false)` and beneath fields.
- Sealed field geometry for standard pages is bit-identical to base; rotated/offset boxes covered by pdf.js rasterisation tests; overlay stays vector and is drawn before signing.
- Every producer of `ZEnvelopeSchema`/`ZEditorEnvelopeSchema`/`ZEnvelopeForSigningResponse` includes `contents`; tRPC/serving routes enforce envelope ownership and token scoping; `dataContentId` cross-envelope links are rejected; clones always get their own `DataContent` row.
- `putPdfFile`, `ColorPicker` consumers, embedded editor (`contents: []`, tab hidden) unaffected. `tsc` clean for lib/remix/trpc; lib unit tests pass.
