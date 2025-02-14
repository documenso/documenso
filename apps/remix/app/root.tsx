import { Suspense, useEffect } from 'react';

import Plausible from 'plausible-tracker';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
} from 'react-router';
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from 'remix-themes';
import { getOptionalLoaderSession } from 'server/utils/get-loader-session';

import { SessionProvider } from '@documenso/lib/client-only/providers/session';
import { APP_I18N_OPTIONS, type SupportedLanguageCodes } from '@documenso/lib/constants/i18n';
import { createPublicEnv } from '@documenso/lib/utils/env';
import { extractLocaleData } from '@documenso/lib/utils/i18n';
import { TrpcProvider } from '@documenso/trpc/react';
import { Toaster } from '@documenso/ui/primitives/toaster';
import { TooltipProvider } from '@documenso/ui/primitives/tooltip';

import type { Route } from './+types/root';
import stylesheet from './app.css?url';
import { GenericErrorLayout } from './components/general/generic-error-layout';
import { RefreshOnFocus } from './components/general/refresh-on-focus';
import { PostHogPageview } from './providers/posthog';
import { langCookie } from './storage/lang-cookie.server';
import { themeSessionResolver } from './storage/theme-session.server';
import { appMetaTags } from './utils/meta';

const { trackPageview } = Plausible({
  domain: 'documenso.com',
});

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

export function meta() {
  return appMetaTags();
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = getOptionalLoaderSession();

  const { getTheme } = await themeSessionResolver(request);

  let lang: SupportedLanguageCodes = await langCookie.parse(request.headers.get('cookie') ?? '');

  if (!APP_I18N_OPTIONS.supportedLangs.includes(lang)) {
    lang = extractLocaleData({ headers: request.headers }).lang;
  }

  return data(
    {
      lang,
      theme: getTheme(),
      session,
      publicEnv: createPublicEnv(),
    },
    {
      headers: {
        'Set-Cookie': await langCookie.serialize(lang),
      },
    },
  );
}

export function App() {
  const { publicEnv, lang, session, ...data } = useLoaderData<typeof loader>() || {};

  const [theme] = useTheme();

  return (
    <html translate="no" lang={lang} className={theme ?? ''}>
      <head>
        <meta charSet="utf-8" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="google" content="notranslate" />
        <Meta />
        <Links />
        <meta name="google" content="notranslate" />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data.theme)} />

        <Suspense>
          <PostHogPageview />
        </Suspense>
      </head>
      <body>
        <SessionProvider session={session}>
          <TooltipProvider>
            <TrpcProvider>
              <Outlet />
              <Toaster />
            </TrpcProvider>
          </TooltipProvider>
        </SessionProvider>

        <ScrollRestoration />
        <Scripts />

        <RefreshOnFocus />

        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(publicEnv)}`,
          }}
        />
      </body>
    </html>
  );
}

/**
 * We have this weird setup with:
 * - No root layout
 * - AppWithTheme
 *
 * To handle remix-themes.
 */
export default function AppWithTheme({ loaderData }: Route.ComponentProps) {
  const location = useLocation();

  useEffect(() => {
    trackPageview();
  }, [location.pathname]);

  return (
    <ThemeProvider specifiedTheme={loaderData.theme} themeAction="/api/theme">
      <App />
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  console.error('[RootErrorBoundary]', error);

  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  return <GenericErrorLayout errorCode={errorCode} />;
}
