/**
 * Verification Portal — Main Route
 *
 * WHERE THIS FILE GOES IN YOUR REPO:
 *   apps/remix/app/routes/_public.verify.tsx
 *
 * This is the top-level Remix route for /verify.
 * It manages the page state machine and routes to the correct
 * result component based on Joel's tRPC response.
 *
 * Joel  : replace simulateVerify() with the real tRPC mutation.
 *         Look for the comment "REPLACE WITH REAL tRPC CALL" below.
 * Gary  : owns all imported visual components.
 * Pape  : skip-to-content link and <main> landmark live here.
 */
import { useState } from 'react';

import { cn } from '@documenso/ui/lib/utils';

import {
  InvalidState,
  RevokedState,
  TrustedState,
  UnknownState,
  VerifiedState,
  type VerifyResultData,
} from '~/components/verify/verify-result-states';
import { VerifyUploadPage } from '~/components/verify/verify-upload';

// ── Types ─────────────────────────────────────────────────────────────────────

type VerifyStatus = 'verified' | 'trusted' | 'unknown' | 'invalid' | 'revoked';

type PageState =
  | { status: 'idle' }
  | { status: 'verifying' }
  | { status: 'done'; result: { verifyStatus: VerifyStatus; data: VerifyResultData } }
  | { status: 'error'; message: string };

// ── Component ─────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const [pageState, setPageState] = useState<PageState>({ status: 'idle' });

  const handleFileAccepted = async (_file: File) => {
    setPageState({ status: 'verifying' });

    try {
      // ─────────────────────────────────────────────────────────────────
      // REPLACE WITH REAL tRPC CALL — Joel's task
      // ─────────────────────────────────────────────────────────────────
      // const formData = new FormData();
      // formData.append('file', file);
      // const result = await trpc.document.verify.mutate({ file });
      // setPageState({ status: 'done', result });
      // ─────────────────────────────────────────────────────────────────

      // Mock — remove when Joel wires up the real call
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1500);
      });
      const mockResult = getMockResult();
      setPageState({ status: 'done', result: mockResult });
    } catch (err) {
      setPageState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Verification failed. Please try again.',
      });
    }
  };

  const handleReset = () => setPageState({ status: 'idle' });

  return (
    <>
      {/* Pape: skip-to-content — WCAG 2.4.1 Bypass Blocks */}
      <a
        href="#main-content"
        className={cn(
          'absolute left-0 top-[-40px] z-50 rounded-br-lg bg-documenso px-4 py-2',
          'text-sm font-semibold text-white transition-[top] focus:top-0',
        )}
      >
        Skip to main content
      </a>

      {/* Pape: aria-live announces state transitions to screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {pageState.status === 'verifying' && 'Verifying document, please wait.'}
        {pageState.status === 'done' &&
          `Verification complete. Result: ${pageState.result.verifyStatus}.`}
        {pageState.status === 'error' && `Verification failed. ${pageState.message}`}
      </div>

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* Idle or verifying → upload page */}
        {(pageState.status === 'idle' || pageState.status === 'verifying') && (
          <VerifyUploadPage
            onFileAccepted={handleFileAccepted}
            isVerifying={pageState.status === 'verifying'}
          />
        )}

        {/* Error state */}
        {pageState.status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p role="alert" className="text-sm text-destructive">
              {pageState.message}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2',
                'text-sm font-medium transition-colors hover:bg-muted',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-documenso focus-visible:ring-offset-2',
              )}
            >
              Try again
            </button>
          </div>
        )}

        {/* Result states */}
        {pageState.status === 'done' &&
          (() => {
            const { verifyStatus, data } = pageState.result;
            switch (verifyStatus) {
              case 'verified':
                return <VerifiedState data={data} onReset={handleReset} />;
              case 'trusted':
                return <TrustedState data={data} onReset={handleReset} />;
              case 'unknown':
                return <UnknownState onReset={handleReset} />;
              case 'invalid':
                return <InvalidState onReset={handleReset} />;
              case 'revoked':
                return <RevokedState data={data} onReset={handleReset} />;
            }
          })()}
      </main>
    </>
  );
}

// ── Mock helper — Joel replaces with real tRPC call ───────────────────────────

function getMockResult(): { verifyStatus: VerifyStatus; data: VerifyResultData } {
  return {
    verifyStatus: 'verified',
    data: {
      fileName: 'Signed_Agreement.pdf',
      documentHash: 'a3f9b2c1e4d87f…',
      signingPlatform: 'Documenso',
      signatureStandard: 'PAdES B-B',
      tsaTimestamp: new Date().toISOString(),
      certIssuer: 'Documenso CA',
      certExpiry: '2027-12-31',
      certSerial: 'AB:CD:EF:01:23:45',
      signers: [
        {
          initials: 'J.G.',
          maskedEmail: 'j.g*****@example.com',
          signedAt: new Date(Date.now() - 3_600_000).toISOString(),
        },
        {
          initials: 'P.R.',
          maskedEmail: 'p.r*****@example.com',
          signedAt: new Date(Date.now() - 1_800_000).toISOString(),
        },
      ],
    },
  };
}
