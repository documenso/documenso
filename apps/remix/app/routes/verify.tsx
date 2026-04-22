/**
 * verify.tsx
 * Documenso — Verification Portal (#1764)
 * Owner: Joel (route architecture, middleware wiring, upload handler)
 * Roadmap ref: D3 Joel — "/verify Remix route (no auth middleware)"
 *              D5 Joel + Gary — "Connect UI to live tRPC route"
 *              D7 Joel — "Security hardening: magic bytes, buf.fill(0), IP hashing, rate limit"
 *
 * This is the public /verify route.
 * No authentication middleware. Intentionally guest-accessible.
 * Gary and Pape own the UI component tree below the action boundary.
 *
 * Architecture note: File upload processing is handled entirely in the
 * Remix action by calling server-only utility functions directly.
 * This avoids the complexity of wiring multipart uploads through tRPC,
 * while still using the tRPC procedure for type safety in components.
 */

import { useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { UploadCloudIcon } from 'lucide-react';
import { Form, data, useActionData, useNavigation } from 'react-router';

import {
  assertFileSize,
  assertIsPDF,
  checkRateLimit,
  getHashedIP,
  zeroBuf,
} from '@documenso/lib/server-only/verify/verify-utils';
import { extractSignature } from '@documenso/lib/server-only/verify/extract-signature';
import { AppError } from '@documenso/lib/errors/app-error';
import { Button } from '@documenso/ui/primitives/button';

import { VerifyResultCard } from '~/components/general/verify/verify-result-card';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/verify';
import type { TVerifyResult } from '@documenso/trpc/server/document-router/verify-document.types';

export function meta() {
  return appMetaTags(msg`Verify Document`);
}

// ─────────────────────────────────────────────────────────────
// LOADER
// No data to load — page is always the same until a file is uploaded.
// Rate limit applies to GET as well to prevent enumeration.
// ─────────────────────────────────────────────────────────────

export const loader = async ({ request }: Route.LoaderArgs) => {
  const hashedIP = getHashedIP(request);
  const { allowed, resetAt } = checkRateLimit(hashedIP);

  if (!allowed) {
    const retryAfter = String(Math.ceil((resetAt - Date.now()) / 1000));

    throw new Response(JSON.stringify({ error: 'RATE_LIMITED' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter,
      },
    });
  }

  return { ok: true };
};

// ─────────────────────────────────────────────────────────────
// ACTION
// Handles the multipart form submission.
// Joel owns everything in this function.
// ─────────────────────────────────────────────────────────────

export type ActionData =
  | { status: 'success'; result: TVerifyResult }
  | { status: 'error'; code: string; userMessage: string }
  | { status: 'rate_limited'; retryAfterSeconds: number };

export const action = async ({ request }: Route.ActionArgs) => {
  // ── Rate limit check ──────────────────────────────────────
  // Hash the IP FIRST — never store or log the raw IP.
  const hashedIP = getHashedIP(request);
  const { allowed, remaining, resetAt } = checkRateLimit(hashedIP);

  if (!allowed) {
    console.info('[verify] Rate limit exceeded', { hashedIP, resetAt });

    return data(
      {
        status: 'rate_limited',
        retryAfterSeconds: Math.ceil((resetAt - Date.now()) / 1000),
      } as ActionData,
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
      },
    );
  }

  // ── Parse multipart form data ────────────────────────────
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return data(
      {
        status: 'error',
        code: 'PARSE_FAILED',
        userMessage: 'Could not read the uploaded file.',
      } as ActionData,
      { status: 400 },
    );
  }

  const uploadedFile = formData.get('file');

  if (!(uploadedFile instanceof File)) {
    return data(
      {
        status: 'error',
        code: 'INVALID_FILE_TYPE',
        userMessage: 'Please upload a PDF file.',
      } as ActionData,
      { status: 400 },
    );
  }

  // ── Process the file ─────────────────────────────────────
  const buf = Buffer.from(await uploadedFile.arrayBuffer());

  try {
    // Step 1: Magic bytes — MUST be before any parsing library
    assertIsPDF(buf);

    // Step 2: File size — reuses MAX_FILE_SIZE env variable
    assertFileSize(buf);

    // Step 3: Signature extraction (Gamaliel's function, stubbed until D4)
    const result = await extractSignature(buf);

    // Log verification event — hashed IP only, no file content
    console.info('[verify] Verification complete', {
      hashedIP,
      state: result.state,
      remaining,
    });

    return { status: 'success', result } as ActionData;
  } catch (err) {
    if (err instanceof AppError) {
      return data(
        {
          status: 'error',
          code: err.code,
          userMessage: err.userMessage ?? 'Verification failed. Please try again.',
        } as ActionData,
        { status: err.statusCode ?? 400 },
      );
    }

    // Unexpected error — log with hashed IP, no details exposed to client
    console.error('[verify] Unexpected action error', { hashedIP });

    return data(
      {
        status: 'error',
        code: 'UNKNOWN_ERROR',
        userMessage: 'Verification failed. Please try again.',
      } as ActionData,
      { status: 500 },
    );
  } finally {
    // Step 4: Memory zeroing — MUST stay in finally (fires on success + error)
    zeroBuf(buf);
  }
};

// ─────────────────────────────────────────────────────────────
// ROUTE COMPONENT
// Joel owns the Form wiring and action data handling.
// Gary + Pape own VerifyResultCard and all UI copy below this line.
// ─────────────────────────────────────────────────────────────

export default function VerifyRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isVerifying = navigation.state === 'submitting';

  const { _ } = useLingui();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-background">
      {/* ── Page header ──────────────────────────────────── */}
      {/* Gary owns all copy in this section */}
      <div className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {/* Documenso D/ logo — Gary confirms design system match */}
          <div className="bg-documenso flex h-8 w-8 items-center justify-center rounded">
            <span className="text-xs font-bold text-white">D/</span>
          </div>
          <span className="font-semibold">Documenso</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* ── Page title ────────────────────────────────── */}
        <h1 className="text-2xl font-semibold">
          <Trans>Verify a document</Trans>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          <Trans>Upload a signed PDF to verify its digital signature.</Trans>
        </p>

        {/* ── Upload zone ──────────────────────────────── */}
        {/* Pape owns all aria-* attributes and keyboard nav on this form */}
        <Form
          method="post"
          encType="multipart/form-data"
          aria-label={_(msg`Document verification form`)}
          className="mt-8"
        >
          <UploadZone
            isVerifying={isVerifying}
            selectedFileName={selectedFileName}
            onFileChange={setSelectedFileName}
            fileInputRef={fileInputRef}
          />

          {/* ── Privacy notice ───────────────────────────── */}
          {/* Paula-approved copy — do not paraphrase */}
          <p className="text-muted-foreground mt-4 text-center text-xs">
            <Trans>
              No document content is stored or retained. Processing occurs entirely in memory.
            </Trans>
          </p>
        </Form>

        {/* ── Result display ───────────────────────────── */}
        {/* Gary + Pape own VerifyResultCard entirely */}
        {actionData?.status === 'success' && <VerifyResultCard result={actionData.result} />}

        {actionData?.status === 'error' && (
          <ErrorBanner message={actionData.userMessage} />
        )}

        {actionData?.status === 'rate_limited' && (
          <ErrorBanner
            message={_(
              msg`Too many requests. Please wait ${actionData.retryAfterSeconds} seconds before trying again.`,
            )}
          />
        )}

        {/* ── Conversion strip ──────────────────────────── */}
        {/* Gary owns this copy per roadmap Section 4 */}
        <ConversionStrip />
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// These are shells — Gary and Pape own the implementation.
// Joel defines the props interface so the connection is clear.
// ─────────────────────────────────────────────────────────────

type UploadZoneProps = {
  isVerifying: boolean;
  selectedFileName: string | null;
  onFileChange: (name: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

/**
 * Upload zone component.
 * Joel: wires the `name="file"` input, submit button, and file state.
 * Pape: owns drag-and-drop, keyboard-accessible fallback file picker,
 *       all aria-* attributes, and ADA/WCAG 2.1 AA compliance.
 * Gary: owns all visible copy (heading, sub-text, button labels).
 */
const UploadZone = ({ isVerifying, selectedFileName, onFileChange, fileInputRef }: UploadZoneProps) => {
  const { _ } = useLingui();

  return (
    <div
      className="rounded-xl border-2 border-dashed border-border p-10 text-center"
      // Pape: add drag-and-drop handlers and aria-dropzone here
    >
      {/* Hidden file input — accessible via label click or keyboard */}
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        id="verify-file-input"
        aria-label={_(msg`Select a PDF file to verify`)}
        onChange={(e) => {
          const file = e.target.files?.[0];
          onFileChange(file?.name ?? null);
        }}
      />

      {/* Upload icon */}
      <div className="flex justify-center">
        <UploadCloudIcon className="text-muted-foreground/40 h-12 w-12" aria-hidden="true" />
      </div>

      {/* Gary: owns all copy below */}
      <label
        htmlFor="verify-file-input"
        className="text-documenso mt-4 block cursor-pointer text-sm font-medium underline"
      >
        {selectedFileName ? (
          <Trans>Change file</Trans>
        ) : (
          <Trans>Choose a PDF to verify</Trans>
        )}
      </label>

      {selectedFileName ? (
        <p className="text-muted-foreground mt-1 text-xs">{selectedFileName}</p>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">
          <Trans>or drag and drop — up to 10MB</Trans>
        </p>
      )}

      <Button
        type="submit"
        disabled={isVerifying || !selectedFileName}
        className="mt-6"
        aria-label={isVerifying ? _(msg`Verifying document, please wait`) : _(msg`Verify document`)}
      >
        {isVerifying ? <Trans>Verifying…</Trans> : <Trans>Verify document</Trans>}
      </Button>
    </div>
  );
};

type ErrorBannerProps = {
  message: string;
};

const ErrorBanner = ({ message }: ErrorBannerProps) => {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
};

/**
 * Conversion strip shown below every result.
 * Gary owns the copy: "Signed with Documenso — send your own documents free →"
 * Must be non-intrusive. Never obscures the result or disclaimer copy.
 */
const ConversionStrip = () => {
  return (
    <div className="border-border text-muted-foreground mt-10 border-t pt-6 text-center text-xs">
      {/* Gary: confirm final copy */}
      <Trans>
        Signed with Documenso —{' '}
        <a
          href="https://documenso.com"
          className="text-documenso font-medium underline"
          target="_blank"
          rel="noreferrer"
        >
          the open-source DocuSign alternative. Send your own documents free →
        </a>
      </Trans>
    </div>
  );
};
