/**
 * Verification Portal — All 5 Result States
 *
 * WHERE THIS FILE GOES IN YOUR REPO:
 *   apps/remix/app/components/verify/verify-result-states.tsx
 *
 * Exports: VerifiedState, TrustedState, UnknownState, InvalidState, RevokedState
 *
 * Paula: the three DISCLAIMER_ constants are verbatim from PRD Section 5.
 *        Do not paraphrase or abbreviate them. Gary injects, Paula verifies.
 *
 * Gamaliel: PII display is initials-only (J.G.) per revised PRD.
 *           No surname fragment. Emails masked (j.g*****@example.com).
 */
import { AlertTriangle } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

import { type CheckItem, VerifyResultShell } from './verify-result-shell';

// ── Verbatim legal disclaimers — PRD Section 5 — Paula owns ──────────────────

const DISCLAIMER_GENERAL =
  "This verification confirms the document's cryptographic integrity only. It does not constitute legal advice or confirm the enforceability of any agreement.";

const DISCLAIMER_UNKNOWN =
  'This document contains a cryptographically intact signature, but the issuing authority is not recognized by Documenso. This result does not confirm the identity of the signer. Treat with caution.';

const DISCLAIMER_REVOCATION_FAILURE =
  "Revocation status could not be confirmed. The cryptographic signature structure is intact, but the certificate's current validity could not be verified. Do not rely solely on this result for legal decisions.";

// ── Shared sub-components ─────────────────────────────────────────────────────

function Card({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-3 overflow-hidden rounded-xl border border-border bg-background"
      aria-labelledby={id}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3
          id={id}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {title}
        </h3>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function AlertBanner({
  variant,
  children,
}: {
  variant: 'warning' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <div
      role="note"
      className={cn(
        'mb-3 flex gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed',
        variant === 'warning' &&
          'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
        variant === 'danger' && 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
      )}
    >
      <AlertTriangle
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          variant === 'warning' && 'text-yellow-500',
          variant === 'danger' && 'text-red-500',
        )}
        aria-hidden="true"
      />
      <div>{children}</div>
    </div>
  );
}

// ── Types from Joel's tRPC response ──────────────────────────────────────────

export type VerifySigner = {
  /** Initials only — e.g. "J.G." — Gamaliel masks per revised PRD */
  initials: string;
  /** Masked email — e.g. "j.g*****@example.com" */
  maskedEmail: string;
  /** ISO timestamp */
  signedAt: string;
};

export type VerifyResultData = {
  fileName: string;
  documentHash: string;
  signingPlatform: string;
  signatureStandard: string;
  signers: VerifySigner[];
  tsaTimestamp?: string;
  certIssuer?: string;
  certExpiry?: string;
  certSerial?: string;
  revokedAt?: string;
  revocationSource?: 'ocsp' | 'crl' | 'both_failed';
};

// ═════════════════════════════════════════════════════════════════════════════
// STATE 1 — VERIFIED
// ═════════════════════════════════════════════════════════════════════════════

const VERIFIED_CHECKS: CheckItem[] = [
  { label: 'Document integrity', note: 'No modifications detected', status: 'pass' },
  { label: 'Certificate chain', note: 'Valid · Documenso CA', status: 'pass' },
  { label: 'Timestamp authority', note: 'Trusted TSA', status: 'pass' },
  { label: 'Signing certificate', note: 'Valid at time of signing', status: 'pass' },
  { label: 'Revocation status (OCSP)', note: 'Not revoked', status: 'pass' },
];

export function VerifiedState({ data, onReset }: { data: VerifyResultData; onReset: () => void }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <VerifyResultShell
      variant="verified"
      badgeLabel="Verified"
      title="Signature is valid and unmodified"
      subtitle="This document was signed using Documenso. The signature is cryptographically intact and the document has not been changed since it was signed."
      checks={VERIFIED_CHECKS}
      disclaimer={DISCLAIMER_GENERAL}
      onReset={onReset}
    >
      {/* Signers */}
      <Card
        id="signers-heading"
        title="Signers"
        subtitle={`${data.signers.length} of ${data.signers.length} signed`}
      >
        <ul className="-my-1 divide-y divide-border">
          {data.signers.map((s, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              {/* Gamaliel: initials only — no surname fragment */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-muted-foreground">
                {s.initials}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{s.initials}</p>
                <p className="text-xs text-muted-foreground">{s.maskedEmail}</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">{fmt(s.signedAt)} UTC</p>
            </li>
          ))}
        </ul>
      </Card>

      {/* Document details */}
      <Card id="doc-details-heading" title="Document details">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              File name
            </dt>
            <dd className="text-sm">{data.fileName}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Signing platform
            </dt>
            <dd className="text-sm font-medium text-documenso">{data.signingPlatform}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Document hash (SHA-256)
            </dt>
            <dd className="break-all font-mono text-xs text-muted-foreground">
              {data.documentHash}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Signature standard
            </dt>
            <dd className="text-sm">{data.signatureStandard}</dd>
          </div>
          {data.tsaTimestamp && (
            <div className="col-span-2">
              <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                TSA timestamp
              </dt>
              <dd className="text-sm">{fmt(data.tsaTimestamp)} UTC</dd>
            </div>
          )}
        </dl>
      </Card>
    </VerifyResultShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 2 — TRUSTED (valid external CA, not Documenso)
// ═════════════════════════════════════════════════════════════════════════════

const TRUSTED_CHECKS: CheckItem[] = [
  { label: 'Document integrity', note: 'No modifications detected', status: 'pass' },
  { label: 'Certificate chain', note: 'Valid · External CA', status: 'pass' },
  { label: 'Revocation status', note: 'Not revoked', status: 'pass' },
  { label: 'Documenso audit trail', note: 'Not available — signed externally', status: 'warn' },
];

export function TrustedState({ data, onReset }: { data: VerifyResultData; onReset: () => void }) {
  return (
    <VerifyResultShell
      variant="trusted"
      badgeLabel="Trusted"
      title="Valid signature from a trusted authority"
      subtitle="The signature is cryptographically valid and issued by a recognized Certificate Authority — but was not signed using Documenso. The document has not been modified since signing."
      checks={TRUSTED_CHECKS}
      disclaimer={DISCLAIMER_GENERAL}
      onReset={onReset}
    >
      <AlertBanner variant="warning">
        <strong>Signed outside Documenso.</strong> The signature is valid, but this document was not
        processed by Documenso's signing infrastructure. We cannot verify the audit trail or signing
        workflow.
      </AlertBanner>

      <Card id="cert-authority-heading" title="Certificate authority">
        <ul className="space-y-3">
          {[
            {
              dot: 'CA',
              label: data.certIssuer ?? 'Certificate Authority',
              detail: `Root CA · Expires ${data.certExpiry ?? '—'}`,
              root: true,
            },
            {
              dot: 'SI',
              label: 'Signer certificate',
              detail: `Serial: ${data.certSerial ?? '—'} · Valid at time of signing`,
              root: false,
            },
          ].map(({ dot, label, detail, root }) => (
            <li key={dot} className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold',
                  root
                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
                    : 'border-border bg-muted text-muted-foreground',
                )}
              >
                {dot}
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="font-mono text-xs text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </VerifyResultShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 3 — UNKNOWN (signature found, chain incomplete or CA unrecognized)
// ═════════════════════════════════════════════════════════════════════════════

const UNKNOWN_CHECKS: CheckItem[] = [
  { label: 'Signature data found', note: 'Valid signature structure', status: 'pass' },
  { label: 'Certificate chain', note: 'Incomplete · Root CA unrecognized', status: 'fail' },
  { label: 'Revocation check', note: 'Could not be performed', status: 'warn' },
  { label: 'Documenso origin', note: 'Not confirmed', status: 'warn' },
];

export function UnknownState({ onReset }: { onReset: () => void }) {
  return (
    <VerifyResultShell
      variant="unknown"
      badgeLabel="Unknown"
      title="Signature origin could not be determined"
      subtitle="This PDF contains a signature, but we were unable to fully verify it. The certificate chain is incomplete or the issuing authority is unrecognized."
      checks={UNKNOWN_CHECKS}
      disclaimer={DISCLAIMER_UNKNOWN}
      onReset={onReset}
    >
      <AlertBanner variant="warning">
        <strong>Partial verification only.</strong> We found a digital signature but couldn't
        complete the full chain. The signing tool may have used a self-signed or private CA
        certificate we cannot independently validate.
      </AlertBanner>
    </VerifyResultShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 4 — INVALID (hash mismatch — document modified after signing)
// ═════════════════════════════════════════════════════════════════════════════

const INVALID_CHECKS: CheckItem[] = [
  { label: 'Document integrity', note: 'Hash mismatch — document modified', status: 'fail' },
  { label: 'Certificate chain', note: 'Valid structure found', status: 'pass' },
  { label: 'Signature validity', note: 'Cryptographic check failed', status: 'fail' },
  { label: 'Revocation status', note: 'Not checked — integrity failed first', status: 'warn' },
];

export function InvalidState({ onReset }: { onReset: () => void }) {
  return (
    <VerifyResultShell
      variant="invalid"
      badgeLabel="Invalid"
      title="Signature verification failed"
      subtitle="This document's signature is cryptographically invalid. The document may have been modified after signing, or the signature data is corrupted."
      checks={INVALID_CHECKS}
      disclaimer={DISCLAIMER_GENERAL}
      onReset={onReset}
    >
      <AlertBanner variant="danger">
        <strong>Document integrity check failed.</strong> The cryptographic hash does not match the
        hash recorded at signing time. The file was altered after it was signed.
      </AlertBanner>

      <Card id="causes-heading" title="What could cause this?">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            'The file was edited after signing — even a single changed character or re-save invalidates the signature.',
            'The file was corrupted during transmission. Try obtaining the original signed file directly from the sender.',
            'The document was printed and re-scanned — scanning destroys the embedded digital signature.',
          ].map((cause, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 shrink-0 text-muted-foreground/40">·</span>
              {cause}
            </li>
          ))}
        </ul>
      </Card>
    </VerifyResultShell>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STATE 5 — REVOKED (certificate revoked via OCSP or CRL)
// ═════════════════════════════════════════════════════════════════════════════

const REVOKED_CHECKS: CheckItem[] = [
  { label: 'Document integrity', note: 'No modifications detected', status: 'pass' },
  { label: 'Signature structure', note: 'Valid PKCS7 format', status: 'pass' },
  { label: 'Revocation status (OCSP)', note: 'Revoked — see timeline below', status: 'fail' },
  { label: 'Trust status', note: 'Cannot be independently confirmed', status: 'warn' },
];

export function RevokedState({
  data,
  onReset,
}: {
  data: Pick<VerifyResultData, 'signers' | 'revokedAt' | 'revocationSource'>;
  onReset: () => void;
}) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const revokedAt = data.revokedAt ? new Date(data.revokedAt) : null;
  const signedAt = data.signers[0]?.signedAt ? new Date(data.signers[0].signedAt) : null;
  const verifiedAt = new Date();

  // Paula: show DISCLAIMER_REVOCATION_FAILURE when OCSP + CRL both failed
  const disclaimer =
    data.revocationSource === 'both_failed' ? DISCLAIMER_REVOCATION_FAILURE : DISCLAIMER_GENERAL;

  return (
    <VerifyResultShell
      variant="revoked"
      badgeLabel="Revoked"
      title="Signing certificate has been revoked"
      subtitle="The document's structure is intact, but the certificate used to sign it was revoked. This signature should not be considered trustworthy."
      checks={REVOKED_CHECKS}
      disclaimer={disclaimer}
      onReset={onReset}
    >
      <AlertBanner variant="danger">
        <strong>
          Certificate revoked{revokedAt ? ` on ${fmt(revokedAt.toISOString())} UTC.` : '.'}
        </strong>{' '}
        The signing certificate was revoked. Independent verification is no longer possible.
      </AlertBanner>

      <Card id="timeline-heading" title="Certificate revocation timeline">
        <ol className="relative ml-3 space-y-4 border-l border-border pl-5">
          {[
            signedAt
              ? { time: signedAt.toISOString(), label: 'Document signed', danger: false as const }
              : null,
            revokedAt
              ? {
                  time: revokedAt.toISOString(),
                  label: 'Certificate revoked by issuing CA',
                  danger: true as const,
                }
              : null,
            {
              time: verifiedAt.toISOString(),
              label: 'This verification performed',
              danger: false as const,
            },
          ]
            .filter(
              (item): item is { time: string; label: string; danger: boolean } =>
                item !== null && typeof item === 'object',
            )
            .map((item, i) => (
              <li key={i} className="relative">
                <span
                  className={cn(
                    'absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full border',
                    item.danger ? 'border-red-400 bg-red-500' : 'border-border bg-muted',
                  )}
                />
                <p className="font-mono text-xs text-muted-foreground">{fmt(item.time)} UTC</p>
                <p className={cn('text-sm font-medium', item.danger && 'text-red-500')}>
                  {item.label}
                </p>
              </li>
            ))}
        </ol>
      </Card>
    </VerifyResultShell>
  );
}
