---
title: CSC QES V1 — Remaining Items
date: 2026-05-27
---

## Pre-merge cleanup

- [ ] Remove `TEMP_BYPASS_LICENSE_ASSERTION` bypass: `assert-licensed-for.ts` early return + `process-env.d.ts` declaration

## V1 scope still outstanding

- [ ] Completion artifacts at download: `?version=bundle` returns ZIP of signed PDFs + CoC + audit log

## V2 scope (explicit deferrals)

- [ ] CSC §11.10 TSA wrapping: finalize throws `NOT_SETUP` for `source: 'tsp'`; operators must set env var
- [ ] Multi-URL TSA fallback: `buildLibpdfTsa` uses `urls[0]` only
- [ ] Multi-credential selection UI: V1 picks `credentialIDs[0]`
- [ ] Per-org CSC provider configuration: `cscQesSigning` per-org flag defined but unused
- [ ] `CscSession` sweeper job for abandoned OAuth flows
- [ ] `DocumentData` orphan-row cleanup: ~`3 + 2*recipients` orphans per item at completion
- [ ] Custom `RevocationProvider` hook for deployments that can't reach default OCSP/CRL endpoints

## Doc drift

- [ ] Verify `csc-qes.mdx` error-code table matches `AppErrorCode` enum after any rename
- [ ] Update `compliance/signature-levels.mdx` AES/QES status once V1 ships (currently both "Planned")
