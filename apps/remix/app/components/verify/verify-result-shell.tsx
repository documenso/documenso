/**
 * Verification Portal — Shared Result Shell
 *
 * WHERE THIS FILE GOES IN YOUR REPO:
 *   apps/remix/app/components/verify/verify-result-shell.tsx
 *
 * All 5 result states (Verified, Trusted, Unknown, Invalid, Revoked)
 * are composed using this shell. Each state passes its own variant,
 * icon, badge label, title, subtitle, checks, children, and disclaimer.
 *
 * Gary  : owns layout, copy slots, and visual system
 * Pape  : role="status" + aria-live so screen readers announce the result
 * Paula : disclaimer text injected verbatim — never paraphrase
 */
import { type ReactNode } from 'react';

import { AlertCircle, CheckCircle, MinusCircle, RotateCcw, Share2, XCircle } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResultVariant = 'verified' | 'trusted' | 'unknown' | 'invalid' | 'revoked';

export type CheckItem = {
  label: string;
  note: string;
  status: 'pass' | 'fail' | 'warn';
};

export type VerifyResultShellProps = {
  variant: ResultVariant;
  badgeLabel: string;
  title: string;
  subtitle: string;
  checks: CheckItem[];
  /** Paula's verbatim legal disclaimer — do not edit */
  disclaimer: string;
  /** State-specific cards rendered below the checks */
  children?: ReactNode;
  onReset: () => void;
};

// ── Variant config ────────────────────────────────────────────────────────────

const VARIANT: Record<
  ResultVariant,
  {
    iconBg: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    icon: ReactNode;
  }
> = {
  verified: {
    iconBg:
      'bg-green-50  dark:bg-green-950  border-green-200 dark:border-green-800  text-green-600 dark:text-green-400',
    badgeBg: 'bg-green-50  dark:bg-green-950',
    badgeText: 'text-green-700 dark:text-green-400',
    badgeBorder: 'border-green-200 dark:border-green-800',
    icon: <CheckCircle className="h-6 w-6" strokeWidth={2} aria-hidden="true" />,
  },
  trusted: {
    iconBg:
      'bg-green-50  dark:bg-green-950  border-green-200 dark:border-green-800  text-green-600 dark:text-green-400',
    badgeBg: 'bg-green-50  dark:bg-green-950',
    badgeText: 'text-green-700 dark:text-green-400',
    badgeBorder: 'border-green-200 dark:border-green-800',
    icon: <CheckCircle className="h-6 w-6" strokeWidth={2} aria-hidden="true" />,
  },
  unknown: {
    iconBg:
      'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400',
    badgeBg: 'bg-yellow-50 dark:bg-yellow-950',
    badgeText: 'text-yellow-700 dark:text-yellow-400',
    badgeBorder: 'border-yellow-200 dark:border-yellow-800',
    icon: <AlertCircle className="h-6 w-6" strokeWidth={2} aria-hidden="true" />,
  },
  invalid: {
    iconBg:
      'bg-red-50    dark:bg-red-950    border-red-200   dark:border-red-800    text-red-600   dark:text-red-400',
    badgeBg: 'bg-red-50    dark:bg-red-950',
    badgeText: 'text-red-700   dark:text-red-400',
    badgeBorder: 'border-red-200 dark:border-red-800',
    icon: <XCircle className="h-6 w-6" strokeWidth={2} aria-hidden="true" />,
  },
  revoked: {
    iconBg:
      'bg-red-50    dark:bg-red-950    border-red-200   dark:border-red-800    text-red-600   dark:text-red-400',
    badgeBg: 'bg-red-50    dark:bg-red-950',
    badgeText: 'text-red-700   dark:text-red-400',
    badgeBorder: 'border-red-200 dark:border-red-800',
    icon: <MinusCircle className="h-6 w-6" strokeWidth={2} aria-hidden="true" />,
  },
};

// ── Check icon ────────────────────────────────────────────────────────────────
// Pape: three distinct shapes — pass / fail / warn never differ by color alone

function CheckIcon({ status }: { status: CheckItem['status'] }) {
  if (status === 'pass')
    return <CheckCircle className="h-4.5 w-4.5 shrink-0 text-green-500" aria-label="Passed" />;
  if (status === 'fail')
    return <XCircle className="h-4.5 w-4.5 shrink-0 text-red-500" aria-label="Failed" />;
  return <AlertCircle className="h-4.5 w-4.5 shrink-0 text-yellow-500" aria-label="Warning" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VerifyResultShell({
  variant,
  badgeLabel,
  title,
  subtitle,
  checks,
  disclaimer,
  children,
  onReset,
}: VerifyResultShellProps) {
  const v = VARIANT[variant];

  return (
    <div className="mx-auto max-w-3xl px-6 pb-20 pt-10">
      {/* Result header */}
      {/*
        Pape: role="status" + aria-live="polite" — when this component mounts
        after upload, screen readers announce the verification verdict
        without the user needing to navigate to it.
      */}
      <div
        className="mb-8 flex items-start gap-5 border-b border-border pb-8"
        role="status"
        aria-live="polite"
      >
        {/* Status icon */}
        <div
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border',
            v.iconBg,
          )}
        >
          {v.icon}
        </div>

        <div className="flex-1">
          {/* Badge */}
          <span
            className={cn(
              'mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
              'text-xs font-semibold uppercase tracking-wide',
              v.badgeBg,
              v.badgeText,
              v.badgeBorder,
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full', v.badgeText, 'bg-current')}
              aria-hidden="true"
            />
            {badgeLabel}
          </span>

          <h2 className="mb-1.5 text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onReset}
              aria-label="Go back and verify a different document"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3.5 py-2',
                'text-sm font-medium transition-colors hover:bg-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-documenso focus-visible:ring-offset-2',
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Verify another
            </button>
            {(variant === 'verified' || variant === 'trusted') && (
              <button
                type="button"
                aria-label="Share this verification result"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3.5 py-2',
                  'text-sm font-medium transition-colors hover:bg-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-documenso focus-visible:ring-offset-2',
                )}
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                Share result
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Verification checks card */}
      <section
        className="mb-3 overflow-hidden rounded-xl border border-border bg-background"
        aria-labelledby="checks-heading"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3
            id="checks-heading"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Verification checks
          </h3>
        </div>
        <ul className="divide-y divide-border px-5">
          {checks.map((check, i) => (
            <li key={i} className="flex items-center gap-3 py-3 text-sm">
              <CheckIcon status={check.status} />
              <span className="flex-1 text-foreground">{check.label}</span>
              <span
                className={cn(
                  'text-xs',
                  check.status === 'pass' && 'text-muted-foreground',
                  check.status === 'fail' && 'text-red-500',
                  check.status === 'warn' && 'text-yellow-500',
                )}
              >
                {check.note}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* State-specific cards */}
      {children}

      {/* Legal disclaimer — Paula: verbatim text from PRD Section 5 */}
      <aside
        className="mt-6 rounded-lg border border-border bg-muted/30 px-4 py-3"
        aria-label="Legal disclaimer"
      >
        <p className="text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>
      </aside>
    </div>
  );
}

export default VerifyResultShell;
