# Contents

## Description

Lets the author of a V2 envelope place static elements on the document itself, which are baked into the PDF when it is sent.

A content is one of text, a line, a shape, a highlight or an image, placed on a page.

An example of a content would be:

"A company logo in the top right corner of every page, or a highlight drawn over a paragraph of the uploaded PDF"

## Decisions

- Not available on V1 envelopes.
- No public API support for initial implementation
- Not editable once the envelope has been sent. Contents are frozen on leaving DRAFT, since the PDF will have had the contents inserted
- Not fully serialising content writes against a concurrent send. The status is rechecked inside the write transaction, at least the guarantee the field and recipient routes have, and the remaining window is accepted.
- Not giving content images an owner. `DataContent` is an ownerless blob store like `DocumentData`, so duplicating an envelope or using a template shares the image rather than copying it, and access is enforced through the content rows which reference it.
- Not cleaning up a content's image when it is replaced, removed or deleted, or when a later step fails after the upload. `DataContent` rows are shared by templates and the documents made from them, and orphaned storage is accepted for now.
- Not storing geometry at more than five decimal places. The editor rounds everything it saves and the API rejects anything finer, so float noise never reaches the database.
- Not rounding field geometry. Only contents are rounded; fields are stored as the editor produces them.
- Not allowing a zero width or height box. The API rejects them, and the canvas enforces a minimum size.
- Not keeping a rotated box's footprint on the page server side. Only the pivot is bounded by the API, since the footprint depends on the page's aspect ratio; the editor keeps it on the page when saving, and API callers are expected to compensate.
- Not storing colours or text verbatim. Colours are normalised to lowercase `#rrggbb`, and control characters, bidi overrides and lone surrogates are stripped from text so the same content always has one stored form.
- Not keeping contents on pages which no longer exist after a PDF is replaced. They are deleted without a warning, unlike fields, which the replace dialog counts beforehand.
- Not checking a content's page against the PDF when it is saved. No page count is stored and loading the PDF on every autosave is currently not viable, so an out of range page from a hand-crafted request is only caught when the document is sent or sealed.
- Not limiting content or image counts by default. The limits are organisation claims which default to unlimited.
- Not capping the request body size or the length of the contents and images arrays in a save.
- Not emitting a `DOCUMENT_SENT` webhook or audit log when a document with nobody left to act (all CC, or already signed) is sent. It still moves to PENDING so the baked PDF is never baked again, but the events match the pre-contents behaviour.
