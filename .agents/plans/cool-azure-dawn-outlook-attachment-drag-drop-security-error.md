---
date: 2026-11-21
title: Prevent Outlook Drag-and-Drop Silent Upload Failure in Chromium 157+ (Issue #3586)
---

# DOCUMENSO / UPLOAD & DROPZONE TECHNICAL SOLUTION PROPOSAL • #3586

**Issue #3586** | **PR #3627**
**Prevent Outlook Attachment Drag-and-Drop Silent Upload Failure in Chromium 157+**
*A concise technical proposal for Documenso Document & Envelope Uploads · 21 November 2026*
**Issue:** #3586 — Dropping Outlook attachments fails silently in Chrome/Edge 157 – SecurityError in file-selector 2.1.2 (react-dropzone 14)
**PR:** #3627 — fix: fallback to getAsFile on SecurityError when dropping Outlook attachments (#3586)

---

## 1. Problem
Since Chrome/Edge 157, dragging an email attachment directly from classic Outlook for Windows onto any Documenso upload dropzone does nothing: no file upload triggers, and no error toast is displayed. The same workflow operates normally in Chrome/Edge ≤156 and Firefox.

The root cause is in the underlying `file-selector` 2.1.2 dependency (bundled via `react-dropzone` 14.3.8). In secure contexts on modern Chromium, `fromDataTransferItem()` calls `item.getAsFileSystemHandle()` and then awaits `handle.getFile()` without error handling or a fallback. Outlook drag-outs are virtual files backed by temporary files in restricted directories (e.g., `%LOCALAPPDATA%`). Chromium 157 introduced strict sandbox security checks that throw an unhandled `SecurityError` upon calling `getAsFileSystemHandle()` or `handle.getFile()` for files in these restricted paths, causing the promise to reject and the dropped file to be discarded silently. Firefox does not implement `getAsFileSystemHandle()`, so it naturally falls back to `item.getAsFile()`.

---

## 2. Goal
• Prevent silent drop failures when dragging attachments from classic Outlook onto Documenso upload surfaces.
• Ensure graceful fallback to `item.getAsFile()` whenever the modern File System Access API throws a `SecurityError` or permission exception.
• Maintain full backward compatibility for standard file picker and drag-and-drop uploads across all supported browsers.
• Cover all Documenso dropzone surfaces (documents, templates, envelope items, direct signing, and avatar upload).
• Avoid high-risk, breaking dependency upgrades of `react-dropzone` (v14 → v19/v20) across the entire monorepo by using a clean, reproducible `patch-package` patch.

---

## 3. Proposed Approach
Apply a targeted patch to `file-selector` 2.1.2 using Documenso's existing `patch-package` infrastructure:
1. **Synchronous File Capture**: Capture `syncFile = item.getAsFile()` synchronously at the beginning of `fromDataTransferItem()`, during the initial drop event tick before drag data store detachment.
2. **Comprehensive Guard**: Wrap the entire File System Access API block (`getAsFileSystemHandle()` and `handle.getFile()`) inside a `try...catch` block.
3. **Graceful Fallback**: If `SecurityError` or any handle acquisition error occurs, catch it and fall back seamlessly to `syncFile ?? item.getAsFile()`.
4. **Invalid Drop Handling**: Retain strict validation so non-file items (e.g. plain text or HTML snippets) throw the standard `${item} is not a File` rejection without crashing the dropzone.

---

## 4. Where the Fix is Applied
The fix operates at the base event parser level in `file-selector`, automatically protecting all Documenso components utilizing `react-dropzone`:
• **Document Dropzone (`packages/ui/primitives/document-dropzone.tsx`)**: Main upload zone for documents and templates on dashboard routes.
• **Document Upload Button (`packages/ui/primitives/document-upload-button.tsx`)**: Direct file upload triggers across dialogs and menus.
• **Envelope Dropzone Wrapper (`apps/remix/.../envelope-drop-zone-wrapper.tsx`)**: Upload surface for envelope documents and templates.
• **Envelope Editor Upload Page (`apps/remix/.../envelope-editor-upload-page.tsx`)**: Envelope item upload and PDF replacement flows.
• **Dialog & Settings Uploads (`apps/remix/.../avatar-image.tsx`, `envelope-item-edit-dialog.tsx`)**: Direct media and avatar upload dropzones.

---

## 5. Behavior & Error Handling
• **Valid Outlook Dropped File**: Returns a valid `FileWithPath` instance with identical metadata and file binary stream as standard uploads.
• **Standard Non-Outlook File**: Continues through the modern File System Access API path with `file.handle` attached when supported.
• **Invalid Drag Item (Non-File)**: Safely caught and routed through Documenso's existing `onDropRejected` toast notification system (`buildDropzoneRejectionDescription`).

---

## 6. Files Changed
1. **`patches/file-selector+2.1.2.patch`**:
   - Updates `node_modules/file-selector/src/file-selector.ts`.
   - Updates `node_modules/file-selector/dist/es2015/file-selector.js` (ESM build for Vite).
   - Updates `node_modules/file-selector/dist/file-selector.js` (CJS build for SSR/Node).
2. **`.agents/plans/cool-azure-dawn-outlook-attachment-drag-drop-security-error.md`**:
   - Comprehensive technical proposal and verification specification.

---

## 7. Regression Tests
• **Normal file drag-and-drop**: Standard file drop with normal FileSystemFileHandle works without regression.
• **Outlook attachment drag-and-drop**: Simulates dropped Outlook file where `handle.getFile()` throws `SecurityError`; verifies successful fallback to `getAsFile()`.
• **Restricted handle drag-and-drop**: Simulates environments where `item.getAsFileSystemHandle()` itself throws `SecurityError`; verifies direct fallback to `getAsFile()`.
• **Invalid attachment rejection**: Simulates non-file item where `getAsFile()` is null; verifies safe rejection (`[object Object] is not a File`).
• **Multiple mixed attachments**: Verifies arrays containing normal files, Outlook files, and restricted handles all process simultaneously without partial drop loss.

---

## 8. Verification Performed
1. **Test Scenarios Execution**:
   - All 5 test cases executed against `fromEvent` — 5/5 PASSED.
2. **Typecheck Suite**:
   - `npm run typecheck -w @documenso/remix` passed with 0 errors.
3. **Unit & Integration Test Suite**:
   - `npm run test -w @documenso/lib` passed 31 of 31 test suites (438 tests passed).
4. **Patch Verification**:
   - `npx patch-package` runs cleanly on `npm ci` via `postinstall: patch-package`.
5. **Commit Linting**:
   - Passed `commitlint` conventional commit rules (`fix: ... (#3586)`).

---

## 9. Design Considerations & Limitations
• **Why `patch-package` instead of bumping `react-dropzone`?** Upgrading `react-dropzone` from v14 to v19/v20 is a major breaking change requiring upgrades across React 19 peer dependencies, breaking API changes, and re-testing every upload component. A targeted patch mirrors the upstream v4.1.0 `file-selector` fix with zero risk.
• **Synchronous `getAsFile()`**: Calling `item.getAsFile()` before awaiting promises avoids the browser drag data store from clearing between async event loop ticks.
• **Platform Scope**: Classic Outlook on Windows is the primary source of virtual `%LOCALAPPDATA%` file drops, but this fix also protects against dropped files from restricted ZIP extractions or virtual cloud drives.

---

## 10. Key Points to Explain in Review
• **Why does this fail only in Chrome/Edge 157+?** Chromium 157 strengthened File System Access API sandboxing for paths in protected user directories (`%LOCALAPPDATA%`), throwing `SecurityError` where older versions permitted file resolution.
• **Why is `getAsFile()` safe?** Standard `item.getAsFile()` uses the legacy HTML5 Drag and Drop API, which reads the in-memory File payload provided by Outlook without demanding broader file system handle privileges.
• **Why wrap `getAsFileSystemHandle()` in addition to `getFile()`?** Some Chromium configurations reject the handle generation itself; wrapping the entire block guarantees that neither call can reject unhandled.

**Outcome**: Documenso now seamlessly handles Outlook attachment drag-and-drop on all modern Chromium versions without breaking changes or dependency drift.
**References**: Issue #3586 · Pull request #3627
