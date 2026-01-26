---
date: 2026-01-26
title: Validate Signer Fields On Distribute
---

## Summary

Validate that signers have at least one signature field before allowing document/envelope distribution via API, matching the existing UI behavior.

## Background

The API originally allowed distributing documents/envelopes without validating that signers had signature fields assigned. This was intentional - we thought API users might have specific flows where this flexibility was needed.

However, after running it this way for a while, we've observed that more often than not, API users inadvertently send documents without fields assigned. This causes confusion for their recipients (who receive a document with nothing to sign) and breaks their own systems expecting a completed signing flow.

## Problem

The API allowed distributing documents/envelopes even when signers had no signature fields assigned. This was inconsistent with the UI which validates this condition before allowing distribution.

## Solution

### 1. Create centralized validation helper

**File**: `packages/lib/utils/recipients.ts`

- Added `RECIPIENT_ROLES_THAT_REQUIRE_FIELDS` constant (currently only `SIGNER`)
- Added `getRecipientsWithMissingFields()` function that returns recipients missing required fields
- Uses existing `isSignatureFieldType` guard from `packages/prisma/guards/is-signature-field.ts`

### 2. Add server-side validation

**File**: `packages/lib/server-only/document/send-document.ts`

- Added validation check that throws `AppError` with `INVALID_REQUEST` code when signers are missing signature fields
- This blocks both v1 and v2 API distribution endpoints since they both use `sendDocument()`

### 3. Fix v1 API error handling

**File**: `packages/api/v1/implementation.ts`

- Changed `sendDocument` endpoint to use `AppError.toRestAPIError(err)` instead of always returning 500
- Now returns 400 for validation errors

### 4. Update UI to use shared helper

**Files**:

- `apps/remix/app/components/dialogs/envelope-distribute-dialog.tsx`
- `packages/ui/primitives/document-flow/add-fields.tsx`

### 5. Consolidate `hasSignatureField` checks

Updated to use `isSignatureFieldType` guard (checks both `SIGNATURE` and `FREE_SIGNATURE`):

- `apps/remix/app/components/general/document-signing/document-signing-form.tsx`
- `apps/remix/app/components/general/envelope-signing/envelope-signer-form.tsx`
- `apps/remix/app/components/embed/multisign/multi-sign-document-signing-view.tsx`
- `apps/remix/app/components/embed/embed-direct-template-client-page.tsx`
- `apps/remix/app/components/embed/embed-document-signing-page-v1.tsx`

### 6. Add E2E tests

**Files**:

- `packages/app-tests/e2e/api/v1/document-sending.spec.ts` - 5 new tests
- `packages/app-tests/e2e/api/v2/distribute-validation.spec.ts` - 8 new tests

## Test Coverage

- Distribution fails when signer has no fields
- Distribution fails when signer has only non-signature fields
- Distribution succeeds with SIGNATURE field
- Distribution succeeds with FREE_SIGNATURE field (v1 only via Prisma)
- Distribution succeeds when VIEWER/CC/APPROVER have no fields
- Distribution fails when one of multiple signers is missing signature field
- Distribution succeeds when all signers have signature fields
