/**
 * verify.route.tsx
 * Documenso — Verification Portal (#1764)
 * Owner: Joel (route architecture, middleware wiring, upload handler)
 * Roadmap ref: D3 Joel — "/verify Remix route (no auth middleware)"
 *              D5 Joel + Gary — "Connect UI to live tRPC route"
 *              D7 Joel — "Security hardening: magic bytes, buf.fill(0), IP hashing, rate limit"
 *
 * This is the public /verify route.
 * No authentication middleware. Intentionally guest-accessible.
 * Gary and Pape own the UI component tree below the action boundary.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json }          from "@remix-run/node";
import { useActionData, useNavigation, Form } from "@remix-run/react";
import {
  getHashedIP,
  checkRateLimit,
  VerifyInputError,
} from "../utils/verify-utils";
import { verifyDocumentProcedure, mapErrorToUserMessage } from "../server/verify.procedure";
import type { VerifyResult } from "../server/verify.procedure";
import { VerifyResultCard } from "../components/VerifyResultCard"; // Gary + Pape own this component

// ─────────────────────────────────────────────────────────────
// LOADER
// No data to load — page is always the same until a file is uploaded.
// Loader runs on every GET. Kept minimal intentionally.
// ─────────────────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  // Rate limit applies to GET as well to prevent enumeration
  const hashedIP = getHashedIP(request);
  const { allowed, resetAt } = checkRateLimit(hashedIP);

  if (!allowed) {
    throw json({ error: "RATE_LIMITED" }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) }
    });
  }

  return json({ ok: true });
}

// ─────────────────────────────────────────────────────────────
// ACTION
// Handles the multipart form submission.
// Joel owns everything in this function.
// ─────────────────────────────────────────────────────────────

export type ActionData =
  | { status: "success"; result: VerifyResult }
  | { status: "error";   code: string; message: string }
  | { status: "rate_limited"; retryAfterSeconds: number };

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  // ── Rate limit check ──────────────────────────────────────
  // Hash the IP FIRST — never store or log the raw IP.
  const hashedIP = getHashedIP(request);
  const { allowed, remaining, resetAt } = checkRateLimit(hashedIP);

  if (!allowed) {
    // Log the rate limit event with the hashed IP — never raw
    console.info("[verify] Rate limit exceeded", { hashedIP, resetAt });

    return json<ActionData>(
      {
        status: "rate_limited",
        retryAfterSeconds: Math.ceil((resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // ── Parse multipart form data ────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json<ActionData>(
      { status: "error", code: "PARSE_FAILED", message: "Could not read the uploaded file." },
      { status: 400 }
    );
  }

  const uploadedFile = formData.get("file");

  if (!(uploadedFile instanceof File)) {
    return json<ActionData>(
      { status: "error", code: "INVALID_FILE_TYPE", message: "Please upload a PDF file." },
      { status: 400 }
    );
  }

  // ── Convert File to Uint8Array for the tRPC procedure ────
  const fileBytes = new Uint8Array(await uploadedFile.arrayBuffer());

  // ── Invoke tRPC procedure ────────────────────────────────
  // The procedure handles: magic bytes, file size, buf.fill(0),
  // signature extraction, and result state determination.
  try {
    const result = await verifyDocumentProcedure({
      input: {
        fileBytes,
        fileName: uploadedFile.name,
      },
    });

    // Log verification event — hashed IP only, no file content
    console.info("[verify] Verification complete", {
      hashedIP,
      state: result.state,
      remaining,
    });

    return json<ActionData>({ status: "success", result });

  } catch (err) {
    if (err instanceof VerifyInputError) {
      return json<ActionData>(
        {
          status: "error",
          code: err.code,
          message: mapErrorToUserMessage(err.code),
        },
        { status: 400 }
      );
    }

    // Unexpected error — log with hashed IP, no details exposed to client
    console.error("[verify] Unexpected action error", { hashedIP });

    return json<ActionData>(
      { status: "error", code: "PARSE_FAILED", message: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// ROUTE COMPONENT
// Joel owns the Form wiring and action data handling.
// Gary + Pape own VerifyResultCard and all UI copy below this line.
// ─────────────────────────────────────────────────────────────

export default function VerifyRoute() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isVerifying = navigation.state === "submitting";

  return (
    <main className="min-h-screen bg-white">
      {/* ── Page header ──────────────────────────────────── */}
      {/* Gary owns all copy in this section */}
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {/* Documenso D/ logo — Gary confirms design system match */}
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#267B45]">
            <span className="text-xs font-bold text-white">D/</span>
          </div>
          <span className="font-semibold text-gray-900">Documenso</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* ── Upload zone ──────────────────────────────── */}
        {/* Pape owns all aria-* attributes and keyboard nav on this form */}
        <Form
          method="post"
          encType="multipart/form-data"
          aria-label="Document verification form"
        >
          {/* Joel wires the form action. Gary + Pape own visual design. */}
          <UploadZone isVerifying={isVerifying} />
        </Form>

        {/* ── Privacy notice ───────────────────────────── */}
        {/* Paula-approved copy — do not paraphrase */}
        <p className="mt-4 text-center text-xs text-gray-400">
          No document content is stored or retained. Processing occurs entirely in memory.
        </p>

        {/* ── Result display ───────────────────────────── */}
        {/* Gary + Pape own VerifyResultCard entirely */}
        {actionData?.status === "success" && (
          <VerifyResultCard result={actionData.result} />
        )}

        {actionData?.status === "error" && (
          <ErrorBanner message={actionData.message} />
        )}

        {actionData?.status === "rate_limited" && (
          <ErrorBanner
            message={`Too many requests. Please wait ${actionData.retryAfterSeconds} seconds before trying again.`}
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

interface UploadZoneProps {
  isVerifying: boolean;
}

/**
 * Upload zone component.
 * Joel: wires the `name="file"` input and submit button.
 * Pape: owns drag-and-drop, keyboard-accessible fallback file picker,
 *       all aria-* attributes, and ADA/WCAG 2.1 AA compliance.
 * Gary: owns all visible copy (heading, sub-text, button labels).
 */
function UploadZone({ isVerifying }: UploadZoneProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
      {/* Pape: add drag-and-drop handlers and aria-dropzone here */}
      <input
        type="file"
        name="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        id="verify-file-input"
        // Pape: confirm this input is keyboard-accessible without mouse
        aria-label="Select a PDF file to verify"
      />
      {/* Gary: owns all copy below */}
      <label
        htmlFor="verify-file-input"
        className="cursor-pointer text-sm font-medium text-[#267B45] underline"
      >
        Choose a PDF to verify
      </label>
      <p className="mt-1 text-xs text-gray-400">or drag and drop — up to 10MB</p>

      <button
        type="submit"
        disabled={isVerifying}
        className="mt-6 rounded-lg bg-[#267B45] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        aria-label={isVerifying ? "Verifying document, please wait" : "Verify document"}
      >
        {isVerifying ? "Verifying…" : "Verify document"}
      </button>
    </div>
  );
}

interface ErrorBannerProps {
  message: string;
}

function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

/**
 * Conversion strip shown below every result.
 * Gary owns the copy: "Signed with Documenso — send your own documents free →"
 * Must be non-intrusive. Never obscures the result or disclaimer copy.
 */
function ConversionStrip() {
  return (
    <div className="mt-10 border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
      {/* Gary: confirm final copy */}
      Signed with Documenso —{" "}
      <a href="https://documenso.com" className="font-medium text-[#267B45] underline">
        the open-source DocuSign alternative. Send your own documents free →
      </a>
    </div>
  );
}
