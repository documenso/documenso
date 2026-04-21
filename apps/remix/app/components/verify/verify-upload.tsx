/**
 * Verification Portal — Upload Page
 *
 * WHERE THIS FILE GOES IN YOUR REPO:
 *   apps/remix/app/components/verify/verify-upload.tsx
 *
 * Documenso toolbox only — no new dependencies:
 *   - Tailwind utility classes (cn() from ~/lib/utils)
 *   - lucide-react icons (already installed)
 *   - text-documenso Tailwind token = #7AC455 brand green
 *
 * Gary  : owns layout, copy, and visual structure
 * Pape  : ARIA labels, keyboard nav, focus rings, WCAG AA
 * Joel  : wire onFileAccepted → tRPC document.verify
 */
import { useRef, useState } from 'react';

import { FileText, Upload } from 'lucide-react';

import { cn } from '@documenso/ui/lib/utils';

export type VerifyUploadProps = {
  onFileAccepted: (file: File) => void;
  isVerifying?: boolean;
};

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export function VerifyUploadPage({ onFileAccepted, isVerifying = false }: VerifyUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File exceeds the ${MAX_MB} MB limit. Please use a smaller file.`);
      return;
    }
    onFileAccepted(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    validate(e.dataTransfer.files[0]);
  };

  // Pape: Enter / Space opens picker so keyboard-only users can operate the zone
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 pb-20 pt-12">
      {/* Hero */}
      <header className="mb-10 text-center" aria-labelledby="verify-heading">
        <h1
          id="verify-heading"
          className="mb-3 text-4xl font-semibold leading-tight tracking-tight"
        >
          Verify any signed <span className="text-documenso">document instantly</span>
        </h1>
        <p className="mx-auto max-w-md text-base leading-relaxed text-muted-foreground">
          Upload a PDF and we'll check whether its digital signatures are cryptographically valid —
          no account required.
        </p>
      </header>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload PDF for verification. Press Enter or Space to open file picker."
        aria-busy={isVerifying}
        aria-describedby={error ? 'upload-error' : 'upload-hint'}
        className={cn(
          'rounded-2xl border-2 border-dashed px-8 py-16 text-center',
          'cursor-pointer bg-muted/30 transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-documenso focus-visible:ring-offset-2',
          dragOver
            ? 'border-documenso bg-documenso/5'
            : 'border-border hover:border-documenso hover:bg-documenso/5',
          isVerifying && 'cursor-wait',
        )}
        onClick={() => !isVerifying && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          aria-hidden="true"
          tabIndex={-1}
          className="hidden"
          onChange={(e) => validate(e.target.files?.[0])}
        />

        <div
          className={cn(
            'mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl',
            'border border-border bg-background text-muted-foreground transition-colors duration-200',
            dragOver && 'border-documenso text-documenso',
          )}
          aria-hidden="true"
        >
          {isVerifying ? (
            <div
              className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-documenso"
              role="status"
              aria-label="Verifying document…"
            />
          ) : (
            <Upload className="h-6 w-6" strokeWidth={1.5} />
          )}
        </div>

        {isVerifying ? (
          <>
            <p className="mb-1 text-lg font-medium">Checking signature…</p>
            <p className="text-sm text-muted-foreground">This usually takes under 5 seconds.</p>
          </>
        ) : (
          <>
            <p className="mb-1.5 text-lg font-medium">Drop your PDF here</p>
            <p className="mb-6 text-sm text-muted-foreground">or click to browse your files</p>
            <button
              type="button"
              aria-label="Choose PDF file from device"
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-documenso px-5 py-2.5',
                'text-sm font-medium text-white transition-opacity hover:opacity-90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-documenso focus-visible:ring-offset-2',
              )}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Choose file
            </button>
          </>
        )}

        <p id="upload-hint" className="mt-4 text-xs text-muted-foreground/60">
          PDF files only · Maximum {MAX_MB} MB · Your file is never stored
        </p>
      </div>

      {/* Error — Pape: role="alert" announces to screen readers */}
      {error && (
        <p
          id="upload-error"
          role="alert"
          aria-live="polite"
          className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* How it works */}
      <section aria-label="How verification works" className="mt-12 grid grid-cols-3 gap-4">
        {[
          {
            step: '01 — Upload',
            title: 'Drop your signed PDF',
            body: 'Processed in memory and never saved to our servers.',
          },
          {
            step: '02 — Verify',
            title: 'Cryptographic check',
            body: 'We inspect the signature, certificate chain, and trusted timestamp.',
          },
          {
            step: '03 — Result',
            title: 'Instant verdict',
            body: 'Verified, Trusted, Unknown, Invalid, or Revoked — with the evidence.',
          },
        ].map(({ step, title, body }) => (
          <div key={step} className="rounded-xl border border-border bg-background p-5">
            <p className="mb-2.5 font-mono text-xs font-medium uppercase tracking-widest text-documenso">
              {step}
            </p>
            <h3 className="mb-1.5 text-sm font-medium">{title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      {/* Privacy notice — Paula: required per ROPA + GDPR */}
      <aside
        className="mt-6 flex gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3"
        aria-label="Privacy notice"
      >
        <FileText
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Privacy notice:</strong> Uploaded files
          are processed entirely in server memory and are not retained, logged, or stored after
          verification is complete. Personal data found in signatures is masked in all outputs.
        </p>
      </aside>
    </div>
  );
}

export default VerifyUploadPage;
