import { useEffect } from 'react';

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
import { PreventFlashOnWrongTheme, type Theme, ThemeProvider, useTheme } from 'remix-themes';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { SessionProvider } from '@documenso/lib/client-only/providers/session';
import { getCookieDomain, useSecureCookies } from '@documenso/lib/constants/auth';
import { APP_I18N_OPTIONS, type SupportedLanguageCodes } from '@documenso/lib/constants/i18n';
import { createPublicEnv, env } from '@documenso/lib/utils/env';
import { extractLocaleData } from '@documenso/lib/utils/i18n';
import { TrpcProvider } from '@documenso/trpc/react';
import { getOrganisationSession } from '@documenso/trpc/server/organisation-router/get-organisation-session';
import { Toaster } from '@documenso/ui/primitives/toaster';
import { TooltipProvider } from '@documenso/ui/primitives/tooltip';

import type { Route } from './+types/root';
import stylesheet from './app.css?url';
import { GenericErrorLayout } from './components/general/generic-error-layout';
import { langCookie } from './storage/lang-cookie.server';
import { themeSessionResolver } from './storage/theme-session.server';
import { appMetaTags } from './utils/meta';

const { trackPageview } = Plausible({
  domain: 'documenso.com',
  trackLocalhost: false,
});

export const links: Route.LinksFunction = () => [{ rel: 'stylesheet', href: stylesheet }];

export function meta() {
  // Don't return a title here - let child routes set their own titles
  // This prevents React Router from merging titles inconsistently in dev mode
  return appMetaTags().filter((tag) => !('title' in tag));
}

/**
 * Don't revalidate (run the loader on sequential navigations) on the root layout
 *
 * Update values via providers.
 */
export const shouldRevalidate = () => false;

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getOptionalSession(request);

  // Handle theme cookie parsing with error handling for corrupted cookies
  let theme: Theme | null = null;
  let clearThemeCookie = false;
  try {
    const { getTheme } = await themeSessionResolver(request);
    theme = getTheme();
  } catch (error) {
    // If cookie is corrupted, use default theme and clear the bad cookie
    console.warn('Failed to parse theme cookie, clearing and using default theme:', error);
    theme = 'system';
    clearThemeCookie = true;
  }

  let lang: SupportedLanguageCodes = await langCookie.parse(request.headers.get('cookie') ?? '');

  if (!APP_I18N_OPTIONS.supportedLangs.includes(lang)) {
    lang = extractLocaleData({ headers: request.headers }).lang;
  }

  let organisations = null;

  if (session.isAuthenticated) {
    organisations = await getOrganisationSession({ userId: session.user.id });
  }

  const headers = new Headers();
  headers.set('Set-Cookie', await langCookie.serialize(lang));

  // Clear corrupted theme cookie if needed
  if (clearThemeCookie) {
    // Manually clear the corrupted cookie by setting it to empty with expired date
    const cookieDomain = getCookieDomain();
    const secureFlag = useSecureCookies ? '; Secure' : '';
    headers.append(
      'Set-Cookie',
      `theme=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Domain=${cookieDomain}${secureFlag}`,
    );
  }

  return data(
    {
      lang,
      theme,
      session: session.isAuthenticated
        ? {
            user: session.user,
            session: session.session,
            organisations: organisations || [],
          }
        : null,
      publicEnv: createPublicEnv(),
    },
    {
      headers,
    },
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme } = useLoaderData<typeof loader>() || {};

  const location = useLocation();

  useEffect(() => {
    if (env('NODE_ENV') === 'production') {
      trackPageview();
    }
  }, [location.pathname]);

  return (
    <ThemeProvider specifiedTheme={theme} themeAction="/api/theme">
      <LayoutContent>{children}</LayoutContent>
    </ThemeProvider>
  );
}

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const { publicEnv, session, lang, ...data } = useLoaderData<typeof loader>() || {};

  const [theme] = useTheme();

  return (
    <html translate="no" lang={lang} data-theme={theme} className={theme ?? ''}>
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

        {/* Fix: https://stackoverflow.com/questions/21147149/flash-of-unstyled-content-fouc-in-firefox-only-is-ff-slow-renderer */}
        <script>0</script>
      </head>
      <body>
        <SessionProvider initialSession={session}>
          <TooltipProvider>
            <TrpcProvider>
              {children}

              <Toaster />
            </TrpcProvider>
          </TooltipProvider>
        </SessionProvider>

        <ScrollRestoration />
        <Scripts />

        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(publicEnv)}`,
          }}
        />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  if (errorCode !== 404) {
    console.error('[RootErrorBoundary]', error);
  }

  return <GenericErrorLayout errorCode={errorCode} />;
}
