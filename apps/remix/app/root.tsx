import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
} from 'react-router';
import { ThemeProvider } from 'remix-themes';

import { SessionProvider } from '@documenso/lib/client-only/providers/session';
import { TrpcProvider } from '@documenso/trpc/react';
import { Toaster } from '@documenso/ui/primitives/toaster';
import { TooltipProvider } from '@documenso/ui/primitives/tooltip';

import type { Route } from './+types/root';
import stylesheet from './app.css?url';
import { themeSessionResolver } from './storage/theme-session.server';

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400..600&display=swap',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
  { rel: 'stylesheet', href: stylesheet },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const { getTheme } = await themeSessionResolver(request);

  return {
    theme: getTheme(),
    session: context.session,
    __ENV__: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_')),
    ),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { __ENV__, theme } = useLoaderData<typeof loader>() || {};

  // const [theme] = useTheme();

  return (
    <html lang="en" data-theme={theme ?? ''}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* <PreventFlashOnWrongTheme ssrTheme={Boolean(theme)} /> */}
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />

        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(__ENV__)}`,
          }}
        />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <SessionProvider session={loaderData.session}>
      {/* Todo: Themes (this won't work for now) */}
      <ThemeProvider specifiedTheme={loaderData.theme} themeAction="/api/theme">
        <TooltipProvider>
          <TrpcProvider>
            <Outlet />

            <Toaster />
          </TrpcProvider>
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full overflow-x-auto p-4">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
