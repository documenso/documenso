/**
 * verify-result-card.tsx
 * Documenso — Verification Portal (#1764)
 * Owner: Gary (UI + copy) + Pape (accessibility)
 * Roadmap ref: D5 Joel + Gary — "Connect UI to live tRPC route"
 *              D6 Pape — "WCAG 2.1 AA + ADA audit on Gary's result pages"
 *
 * This is a STUB. Gary replaces the body with the full design.
 * Joel owns the prop interface (TVerifyResult) — Gary must not change
 * the type shape without consulting Joel.
 *
 * Gary's components receive: state, signers[], timestamp, cert, requiredDisclaimers[]
 * Gary renders requiredDisclaimers as verbatim text from roadmap Section 5.
 * Pape adds all aria-*, role, and keyboard nav on D3.
 */

import { Trans } from '@lingui/react/macro';
import {
  CheckCircleIcon,
  HelpCircleIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from 'lucide-react';

import type { TVerifyResult, TVerifyResultState } from '@documenso/trpc/server/document-router/verify-document.types';

// ─────────────────────────────────────────────────────────────
// STATE CONFIG
// Maps each VerifyResultState to display properties.
// Gary owns the copy; this table wires colour + icon + label.
// Non-color indicators are used alongside colour (PRD requirement).
// ─────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<
  TVerifyResultState,
  { icon: React.ElementType; colorClass: string; label: string }
> = {
  VERIFIED: {
    icon: ShieldCheckIcon,
    colorClass: 'text-green-600 border-green-200 bg-green-50',
    label: 'Verified',
  },
  TRUSTED: {
    icon: CheckCircleIcon,
    colorClass: 'text-amber-600 border-amber-200 bg-amber-50',
    label: 'Trusted',
  },
  UNKNOWN: {
    icon: HelpCircleIcon,
    colorClass: 'text-amber-600 border-amber-200 bg-amber-50',
    label: 'Unknown Issuer',
  },
  INVALID: {
    icon: XCircleIcon,
    colorClass: 'text-red-600 border-red-200 bg-red-50',
    label: 'Invalid',
  },
  REVOKED: {
    icon: ShieldAlertIcon,
    colorClass: 'text-red-600 border-red-200 bg-red-50',
    label: 'Revoked',
  },
};

type VerifyResultCardProps = {
  result: TVerifyResult;
};

/**
 * VerifyResultCard — stub implementation.
 * TODO (D5): Gary replaces this with the full polished design.
 * Pape ensures aria-live='assertive' on result announcement
 * and non-color result indicators per WCAG 2.1 AA.
 */
export const VerifyResultCard = ({ result }: VerifyResultCardProps) => {
  const config = STATE_CONFIG[result.state];
  const Icon = config.icon;

  return (
    <div
      role="region"
      aria-label="Verification result"
      aria-live="assertive"
      className={`mt-6 rounded-xl border p-6 ${config.colorClass}`}
    >
      {/* State header — Gary owns final copy */}
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 shrink-0" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{config.label}</h2>
      </div>

      {/* Signers — initials + masked email only (PRD PII requirement) */}
      {result.signers.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            <Trans>Signers</Trans>
          </p>
          <ul className="mt-1 space-y-1" aria-label="Signer list">
            {result.signers.map((signer, i) => (
              <li key={i} className="text-sm">
                {signer.initials} — {signer.maskedEmail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamp */}
      {result.timestamp.signingDate && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            <Trans>Signed</Trans>
          </p>
          <p className="mt-1 text-sm">
            {new Date(result.timestamp.signingDate).toLocaleString()}
            {result.timestamp.tsaValidated && (
              <span className="ml-2 text-xs opacity-70">
                (<Trans>TSA validated</Trans>)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Certificate summary */}
      {result.cert && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            <Trans>Certificate</Trans>
          </p>
          <p className="mt-1 text-sm">{result.cert.issuer}</p>
        </div>
      )}

      {/* Required disclaimers — verbatim text from roadmap Section 5 */}
      {/* Paula verifies these on D8 — do not paraphrase */}
      {result.requiredDisclaimers.length > 0 && (
        <div className="mt-4 border-t border-current/20 pt-4">
          {result.requiredDisclaimers.includes('GENERAL') && (
            <p className="text-xs opacity-80">
              {/* TODO (D8): Paula provides final verbatim disclaimer text */}
              <Trans>
                This verification confirms the cryptographic integrity of the digital signature.
                It does not constitute legal advice.
              </Trans>
            </p>
          )}
          {result.requiredDisclaimers.includes('UNKNOWN_ISSUER') && (
            <p className="mt-2 text-xs opacity-80">
              <Trans>
                The certificate issuer could not be verified against a trusted bundle.
                Treat this signature with caution.
              </Trans>
            </p>
          )}
          {result.requiredDisclaimers.includes('REVOCATION_FAILURE') && (
            <p className="mt-2 text-xs opacity-80">
              <Trans>
                Revocation status could not be confirmed via OCSP or CRL.
                The certificate may have been revoked.
              </Trans>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
