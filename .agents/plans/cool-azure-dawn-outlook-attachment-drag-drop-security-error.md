---
date: 2026-11-21
title: Fix Outlook Attachment Drag-and-Drop SecurityError (Issue #3586)
---

## Overview

Fix silent upload failure when dragging attachments from classic Outlook on Windows into Documenso dropzones on Chromium 157+ (Chrome/Edge).

## Problem & Root Cause

1. In Chromium 157+, dragging an attachment from classic Outlook creates temporary files under restricted directories (e.g., `%LOCALAPPDATA%`).
2. `react-dropzone` (14.3.8) depends on `file-selector` (2.1.2).
3. In `file-selector` 2.1.2, `fromDataTransferItem()` calls `item.getAsFileSystemHandle()` and then awaits `handle.getFile()`.
4. Chromium 157 throws a `SecurityError` when `handle.getFile()` is called on items from restricted system directories.
5. In `file-selector` 2.1.2, this rejection causes the entire promise to reject, silently discarding the drop event.
6. In Firefox and older Chromium, `getAsFile()` is used or allowed without `SecurityError`.

## Strategy

1. **Option A (Recommended & Minimal Risk)**:
   Add a `patch-package` patch for `file-selector` 2.1.2:
   - When processing a `DataTransferItem`, first read `item.getAsFile()`.
   - If `item.getAsFile()` returns a `File`, use it directly.
   - If not, fall back to `handle.getFile()`, wrapping in a `try...catch` so `SecurityError` or permission errors fall back to `item.getAsFile()`.
   This is identical to the upstream fix in `file-selector` >= 4.1.0 without forcing a breaking upgrade of `react-dropzone` (which jumps to v19/v20 and requires substantial peer dependency / React changes).
2. **Custom fallback / helper**:
   Alternatively or additionally, ensure any dropzone error is properly caught and handled.

## Verification

1. Verify `patch-package` applies cleanly to `file-selector`.
2. Run `npm run lint` and `npm run format`.
3. Run `npm run typecheck -w @documenso/remix`.
4. Test drop handling.
