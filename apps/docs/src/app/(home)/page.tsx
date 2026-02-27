import Link from 'next/link';

import {
  BookOpenIcon,
  CodeIcon,
  FileTextIcon,
  GithubIcon,
  ServerIcon,
  ShieldCheckIcon,
  UserIcon,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Hero */}
      <div className="mb-16 pt-6 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Documenso Documentation</h1>
        <p className="text-fd-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
          The open-source document signing platform. Send documents for signatures, integrate with
          your apps, or self-host with full control.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/docs/users"
            className="bg-documenso text-fd-primary-foreground hover:bg-documenso-dark/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/documenso/documenso"
            className="bg-fd-background hover:bg-fd-accent inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            <GithubIcon className="size-4" />
            View on GitHub
          </a>
        </div>
      </div>

      {/* Main Guide Cards */}
      <div className="mb-16 grid gap-4 md:grid-cols-3">
        <Link
          href="/docs/users"
          className="group bg-fd-card hover:border-fd-primary/50 relative flex flex-col rounded-xl border p-6 transition-all hover:shadow-md"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserIcon className="size-6" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">User Guide</h2>
          <p className="text-fd-muted-foreground mb-4 flex-1 text-sm">
            Send documents, create templates, and manage your team using the web application.
          </p>
          <span className="text-fd-primary text-sm font-medium">Get started →</span>
        </Link>

        <Link
          href="/docs/developers"
          className="group bg-fd-card hover:border-fd-primary/50 relative flex flex-col rounded-xl border p-6 transition-all hover:shadow-md"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CodeIcon className="size-6" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Developer Guide</h2>
          <p className="text-fd-muted-foreground mb-4 flex-1 text-sm">
            Integrate document signing into your applications with the REST API, webhooks, and
            embedding.
          </p>
          <span className="text-fd-primary text-sm font-medium">View API docs →</span>
        </Link>

        <Link
          href="/docs/self-hosting"
          className="group bg-fd-card hover:border-fd-primary/50 relative flex flex-col rounded-xl border p-6 transition-all hover:shadow-md"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ServerIcon className="size-6" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Self-Hosting Guide</h2>
          <p className="text-fd-muted-foreground mb-4 flex-1 text-sm">
            Deploy your own Documenso instance with Docker, Kubernetes, or Railway.
          </p>
          <span className="text-fd-primary text-sm font-medium">Deploy now →</span>
        </Link>
      </div>

      {/* Quick Start & Core Concepts */}
      <div className="mb-16 grid gap-8 md:grid-cols-2">
        <div className="bg-fd-card/50 rounded-xl border p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <BookOpenIcon className="text-fd-muted-foreground size-5" />
            Quick Start
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Send your first document</h4>
              <ol className="text-fd-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>
                  <Link
                    href="/docs/users/getting-started/create-account"
                    className="text-fd-primary hover:underline"
                  >
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/users/getting-started/send-first-document"
                    className="text-fd-primary hover:underline"
                  >
                    Upload and send a document
                  </Link>
                </li>
              </ol>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium">Integrate with the API</h4>
              <ol className="text-fd-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>
                  <Link
                    href="/docs/developers/getting-started/authentication"
                    className="text-fd-primary hover:underline"
                  >
                    Get your API key
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/developers/getting-started/first-api-call"
                    className="text-fd-primary hover:underline"
                  >
                    Make your first API call
                  </Link>
                </li>
              </ol>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium">Deploy self-hosted</h4>
              <ol className="text-fd-muted-foreground list-inside list-decimal space-y-1 text-sm">
                <li>
                  <Link
                    href="/docs/self-hosting/getting-started/requirements"
                    className="text-fd-primary hover:underline"
                  >
                    Check requirements
                  </Link>
                </li>
                <li>
                  <Link
                    href="/docs/self-hosting/getting-started/quick-start"
                    className="text-fd-primary hover:underline"
                  >
                    Run with Docker
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-fd-card/50 rounded-xl border p-6">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <BookOpenIcon className="text-fd-muted-foreground size-5" />
            Core Concepts
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/docs/concepts/document-lifecycle"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Document Lifecycle</div>
              <div className="text-fd-muted-foreground text-xs">Draft to completed</div>
            </Link>
            <Link
              href="/docs/concepts/recipient-roles"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Recipient Roles</div>
              <div className="text-fd-muted-foreground text-xs">Signers and approvers</div>
            </Link>
            <Link
              href="/docs/concepts/field-types"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Field Types</div>
              <div className="text-fd-muted-foreground text-xs">Signatures and inputs</div>
            </Link>
            <Link
              href="/docs/concepts/signing-certificates"
              className="bg-fd-background hover:border-fd-primary/50 rounded-lg border p-3 text-sm transition-colors"
            >
              <div className="mb-1 font-medium">Signing Certificates</div>
              <div className="text-fd-muted-foreground text-xs">Digital verification</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Compliance & Policies */}
      <div className="mb-16 grid gap-4 md:grid-cols-2">
        <Link
          href="/docs/compliance"
          className="bg-fd-card/50 hover:border-fd-primary/50 flex items-start gap-4 rounded-xl border p-5 transition-all"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Compliance & Legal</h3>
            <p className="text-fd-muted-foreground text-sm">
              ESIGN, UETA, eIDAS compliance, GDPR, and signature levels explained.
            </p>
          </div>
        </Link>

        <Link
          href="/docs/policies"
          className="bg-fd-card/50 hover:border-fd-primary/50 flex items-start gap-4 rounded-xl border p-5 transition-all"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <FileTextIcon className="size-5" />
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Policies & Licensing</h3>
            <p className="text-fd-muted-foreground text-sm">
              AGPL and Enterprise licenses, fair use, privacy policy, and support.
            </p>
          </div>
        </Link>
      </div>

      {/* Community CTA */}
      <div className="from-fd-primary/5 to-fd-primary/10 rounded-xl border bg-gradient-to-r p-8 text-center">
        <h3 className="mb-2 text-lg font-semibold">Join the Community</h3>
        <p className="text-fd-muted-foreground mb-6 text-sm">
          Documenso is open source. Contribute, ask questions, or share feedback.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://github.com/documenso/documenso"
            className="bg-fd-background hover:bg-fd-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          >
            <GithubIcon className="size-4" />
            GitHub
          </a>
          <a
            href="https://documen.so/discord"
            className="bg-fd-background hover:bg-fd-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
            </svg>
            Discord
          </a>
          <a
            href="https://app.documenso.com/signup"
            className="bg-documenso text-fd-primary-foreground hover:bg-documenso/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Try Documenso
          </a>
        </div>
      </div>
    </main>
  );
}
