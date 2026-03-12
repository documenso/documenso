import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-32 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Page not found</h1>
      <p className="text-fd-muted-foreground mt-4 text-lg">
        The page you are looking for may have moved. Our documentation was recently restructured.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/docs/users"
          className="bg-documenso text-fd-primary-foreground hover:bg-documenso/90 inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
        >
          Browse documentation
        </Link>
        <Link
          href="/"
          className="bg-fd-background hover:bg-fd-accent inline-flex items-center rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
        >
          Go to homepage
        </Link>
      </div>
    </main>
  );
}
