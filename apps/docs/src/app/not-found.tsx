import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-32 text-center">
      <h1 className="font-bold text-4xl tracking-tight">Page not found</h1>
      <p className="mt-4 text-fd-muted-foreground text-lg">
        The page you are looking for may have moved. Our documentation was recently restructured.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/docs/users"
          className="inline-flex items-center rounded-lg bg-documenso px-5 py-2.5 font-medium text-fd-primary-foreground text-sm transition-colors hover:bg-documenso/90"
        >
          Browse documentation
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border bg-fd-background px-5 py-2.5 font-medium text-sm transition-colors hover:bg-fd-accent"
        >
          Go to homepage
        </Link>
      </div>
    </main>
  );
}
