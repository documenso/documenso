# Simplify External 2FA Branch Code

## TL;DR

> **Quick Summary**: Simplify and refine the External 2FA feature code on the current branch, applying project coding standards, reducing redundancy, and improving clarity — without changing any behavior.
>
> **Deliverables**:
>
> - Cleaner server-side logic with reduced duplication in `verify-signing-two-factor-token.ts` and `issue-signing-two-factor-token.ts`
> - Simplified UI component `document-signing-auth-external-2fa.tsx`
> - Consistent patterns across TRPC routes
> - All existing E2E tests continue to pass
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 (server) → Task 5 (verify tests)

---

## Context

### Original Request

Simplify/refine code on the current branch (External 2FA feature) following the code-simplifier skill methodology.

### Analysis Findings

After reviewing ~2000 lines of diff across 25+ files, the code is generally well-written. The following concrete simplification opportunities were identified:

**1. `verify-signing-two-factor-token.ts` — Repetitive audit-log-then-throw pattern**
Lines 72-157 repeat the exact same pattern 4 times: check condition → create audit log → throw error. The `createVerifyFailedAuditLog` helper already exists but could be combined with throw in a single helper to eliminate boilerplate.

**2. `issue-signing-two-factor-token.ts` — Duplicate audit-log-then-throw for denial**
Two blocks (lines ~46-63 and ~65-82 in diff) repeat the same audit-log + throw pattern for `TWO_FA_NOT_REQUIRED` and `TWO_FA_RECIPIENT_INELIGIBLE`. Can be extracted into a helper.

**3. `document-signing-auth-external-2fa.tsx` — Error handling uses if/else chain on string messages**
Lines 62-75 use an if/else chain comparing `error.message` against string constants. This should use `match()` (ts-pattern) for consistency with the rest of the codebase, or at minimum a switch statement per AGENTS.md guidelines ("Avoid nested ternary operators - prefer switch statements or if/else chains"). The if/else is acceptable but the string comparison against reason codes is fragile.

**4. `document-signing-auth-external-2fa.tsx` — Manual attempts decrement**
Lines 72-74: `if (attemptsRemaining !== null && attemptsRemaining > 0) { setAttemptsRemaining(attemptsRemaining - 1); }` — this manually decrements a client-side counter instead of re-fetching from the status query. After a failed verify, `statusQuery.refetch()` would be more reliable (single source of truth).

**5. `document-signing-auth-external-2fa.tsx` — Two separate useEffects for related concerns**
The first useEffect resets form state on open/close. The second syncs `attemptsRemaining` from `statusQuery.data`. The second effect is unnecessary if we just read `statusQuery.data?.attemptsRemaining` directly in the render instead of duplicating it in state.

**6. `get-signing-two-factor-status.ts` — `NOT_REQUIRED_STATUS` constant could be inlined or typed more tightly**
Minor: the constant is fine but the function returns early in 2 places with it. Acceptable as-is.

**7. TRPC routes (`get-signing-two-factor-status.ts`, `verify-signing-two-factor-token.ts`) — Duplicate recipient lookup**
Both routes look up a recipient by token with the same query shape. This is a minor duplication but extracting it would add indirection for little gain in 2 files. Skip.

**8. `document-signing-auth-external-2fa.tsx` — `hasActiveToken` and `hasValidProof` derived from nullable**
`const hasActiveToken = statusQuery.data?.hasActiveToken ?? false` — this is fine but could use the `!statusQuery.isLoading` guard more cleanly.

---

## Work Objectives

### Core Objective

Reduce redundancy and improve clarity in the External 2FA implementation without changing behavior.

### Concrete Deliverables

- Simplified `verify-signing-two-factor-token.ts` with combined throw-with-audit helper
- Simplified `issue-signing-two-factor-token.ts` with extracted denial helper
- Cleaner `document-signing-auth-external-2fa.tsx` with derived state instead of duplicated state
- All E2E tests pass unchanged

### Definition of Done

- [ ] `npm run lint` passes
- [ ] E2E tests in `external-2fa-auth.spec.ts` pass
- [ ] No behavioral changes — same error codes, same HTTP statuses, same UI behavior

### Must Have

- Zero behavioral changes
- All existing tests pass
- Follow project coding standards (AGENTS.md)

### Must NOT Have (Guardrails)

- No new files
- No changes to schema.prisma, migration, or types files
- No changes to E2E test files
- No renaming of exported functions or types (public API stability)
- No "clever" abstractions that reduce readability
- Do not change any string literals used as error/reason codes

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (verify existing tests still pass)
- **Framework**: Playwright E2E

### Agent-Executed QA Scenarios (MANDATORY)

```
Scenario: All E2E tests still pass after simplification
  Tool: Bash
  Preconditions: Dev dependencies installed, database running
  Steps:
    1. Run: npx tsc --noEmit -p packages/lib/tsconfig.json
    2. Assert: Exit code 0 (no type errors in lib)
    3. Run: npm run lint
    4. Assert: Exit code 0
  Expected Result: Type checking and linting pass
  Evidence: Terminal output captured

Scenario: Verify unchanged behavior via E2E
  Tool: Bash
  Preconditions: Dev server and database running
  Steps:
    1. Run: npm run test:dev -w @documenso/app-tests -- --grep "EXTERNAL_2FA"
    2. Assert: All 6 test cases pass
  Expected Result: 6/6 tests pass
  Evidence: Test output captured
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Simplify server-side verify token logic
├── Task 2: Simplify server-side issue token logic
└── Task 3: Simplify External 2FA UI component

Wave 2 (After Wave 1):
└── Task 4: Lint fix pass

Wave 3 (After Wave 2):
└── Task 5: Type check + lint verification
```

---

## TODOs

- [x] 1. Simplify `verify-signing-two-factor-token.ts` — combine audit-log + throw

  **What to do**:
  - Create a `throwVerificationError` helper that combines `createVerifyFailedAuditLog` + `throw new AppError(...)` in one call
  - Replace the 4 repetitive blocks (not-issued, expired, attempt-limit, invalid) with calls to this helper
  - The helper should accept: `{ envelopeId, recipient, tokenId, reasonCode, attemptsUsed, attemptLimit, errorCode, statusCode }`
  - For the expired case, keep the status update to `EXPIRED` before calling the helper
  - For the attempt-limit case, keep the status update to `REVOKED` before calling the helper
  - For the invalid case, keep the attempt increment before calling the helper
  - The point is to eliminate the repeated `await createVerifyFailedAuditLog(...);\n throw new AppError(...)` pattern

  **Must NOT do**:
  - Change any reason code strings
  - Change any HTTP status codes
  - Change the order of operations (status update must happen before audit log)
  - Change the transaction logic for the success path

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `packages/lib/server-only/signing-2fa/verify-signing-two-factor-token.ts` — full file, focus on the 4 error blocks between lines 71-157 and the existing `createVerifyFailedAuditLog` helper at the bottom
  - `packages/lib/errors/app-error.ts` — AppError and AppErrorCode usage pattern

  **Acceptance Criteria**:
  - [ ] 4 audit-log + throw blocks reduced to single-line helper calls
  - [ ] `createVerifyFailedAuditLog` helper is either replaced or combined with throw logic
  - [ ] No change to any reason code string or HTTP status code
  - [ ] File compiles without errors: `npx tsc --noEmit`

  **Commit**: YES (groups with 2, 3)
  - Message: `refactor(signing-2fa): simplify server-side 2FA token logic`
  - Files: `packages/lib/server-only/signing-2fa/verify-signing-two-factor-token.ts`

---

- [x] 2. Simplify `issue-signing-two-factor-token.ts` — extract denial helper

  **What to do**:
  - Extract a `throwIssuanceDenied` helper for the repeated audit-log + throw pattern used for `TWO_FA_NOT_REQUIRED` and `TWO_FA_RECIPIENT_INELIGIBLE`
  - Helper signature: `{ envelopeId, recipient, reasonCode }` → creates audit log + throws AppError
  - Replace both blocks (~20 lines each) with one-line calls

  **Must NOT do**:
  - Change any reason code strings
  - Change any HTTP status codes
  - Alter the transaction logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `packages/lib/server-only/signing-2fa/issue-signing-two-factor-token.ts` — the two denial blocks after `requiresExternal2FA` check and `signingStatus === 'SIGNED'` check

  **Acceptance Criteria**:
  - [ ] Two denial blocks reduced to single-line helper calls
  - [ ] No change to any reason code or status code
  - [ ] File compiles: `npx tsc --noEmit`

  **Commit**: YES (groups with 1, 3)
  - Message: `refactor(signing-2fa): simplify server-side 2FA token logic`
  - Files: `packages/lib/server-only/signing-2fa/issue-signing-two-factor-token.ts`

---

- [x] 3. Simplify `document-signing-auth-external-2fa.tsx` — eliminate duplicated state

  **What to do**:
  - **Remove `attemptsRemaining` state entirely**. Instead, derive it directly from `statusQuery.data?.attemptsRemaining ?? null` in the render. This eliminates:
    - The `useState` for `attemptsRemaining`
    - The second `useEffect` that syncs `statusQuery.data?.attemptsRemaining` into state
    - The manual client-side decrement in the error handler
  - **After a failed verify mutation**, call `statusQuery.refetch()` so the server is the single source of truth for attempts remaining
  - **Remove the first `useEffect`'s `setAttemptsRemaining(null)` call** since there's no state to reset
  - **Keep `formError` state** — it's legitimately local UI state
  - **In the error handler if/else chain**: This is acceptable per AGENTS.md guidelines. Leave it as-is — it's readable and clear. But do change the fragile `error.message` comparisons to use the imported `SIGNING_2FA_VERIFY_REASON_CODES` constants from `verify-signing-two-factor-token.ts` for type safety.

  **Must NOT do**:
  - Change any user-visible strings
  - Change the PIN input component or form structure
  - Add any new dependencies/imports beyond the reason code constants
  - Remove the `formError` state (it's needed for showing errors)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `apps/remix/app/components/general/document-signing/document-signing-auth-external-2fa.tsx` — full new file, focus on useState/useEffect/error-handler
  - `packages/lib/server-only/signing-2fa/verify-signing-two-factor-token.ts:SIGNING_2FA_VERIFY_REASON_CODES` — the constants to import for type-safe error matching
  - `apps/remix/app/components/general/document-signing/document-signing-auth-2fa.tsx` — existing sibling component for pattern reference

  **Acceptance Criteria**:
  - [ ] `attemptsRemaining` state removed; derived from `statusQuery.data` directly
  - [ ] Second `useEffect` (syncing attemptsRemaining) removed
  - [ ] `statusQuery.refetch()` called after failed verify
  - [ ] Error handler uses imported constants instead of string literals
  - [ ] File compiles: `npx tsc --noEmit`

  **Commit**: YES (groups with 1, 2)
  - Message: `refactor(signing-2fa): simplify server-side 2FA token logic`
  - Files: `apps/remix/app/components/general/document-signing/document-signing-auth-external-2fa.tsx`

---

- [ ] 4. Lint fix pass

  **What to do**:
  - Run `npm run lint:fix` to auto-fix any formatting issues introduced by the refactors
  - Run `npm run format` for Prettier

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2, 3

  **Acceptance Criteria**:
  - [ ] `npm run lint` exits 0
  - [ ] `npm run format` exits 0

  **Commit**: YES
  - Message: `chore: lint fix`
  - Files: any auto-fixed files

---

- [ ] 5. Type check + final verification

  **What to do**:
  - Run `npx tsc --noEmit` from root to verify no type errors
  - Run `npm run lint` to confirm clean

  **Must NOT do**:
  - Run full build (too slow per AGENTS.md)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 4

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` exits 0
  - [ ] `npm run lint` exits 0

  **Commit**: NO

---

## Commit Strategy

| After Task(s) | Message                                                                    | Files                                                                                                         |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1, 2, 3       | `refactor(signing-2fa): simplify server-side and UI code for external 2FA` | verify-signing-two-factor-token.ts, issue-signing-two-factor-token.ts, document-signing-auth-external-2fa.tsx |
| 4             | `chore: lint fix` (only if needed)                                         | any auto-fixed                                                                                                |

---

## Success Criteria

### Verification Commands

```bash
npx tsc --noEmit              # Expected: clean exit
npm run lint                   # Expected: clean exit
```

### Final Checklist

- [ ] All simplifications preserve exact behavior
- [ ] No new files created
- [ ] No changes to types, schema, migration, or test files
- [ ] Reduced total line count in modified files
- [ ] Error codes and HTTP statuses unchanged
