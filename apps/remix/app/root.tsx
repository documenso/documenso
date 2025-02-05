import { Suspense } from 'react';

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  data,
  isRouteErrorResponse,
  useLoaderData,
} from 'react-router';
import { ThemeProvider } from 'remix-themes';

import { SessionProvider } from '@documenso/lib/client-only/providers/session';
import { APP_I18N_OPTIONS } from '@documenso/lib/constants/i18n';
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

// Todo: Meta data.
// export function generateMetadata() {
//   return {
//     title: {
//       template: '%s - Documenso',
//       default: 'Documenso',
//     },
//     description:
//       'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
//     keywords:
//       'Documenso, open source, DocuSign alternative, document signing, open signing infrastructure, open-source community, fast signing, beautiful signing, smart templates',
//     authors: { name: 'Documenso, Inc.' },
//     robots: 'index, follow',
//     metadataBase: new URL(NEXT_PUBLIC_WEBAPP_URL() ?? 'http://localhost:3000'),
//     openGraph: {
//       title: 'Documenso - The Open Source DocuSign Alternative',
//       description:
//         'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
//       type: 'website',
//       images: ['/opengraph-image.jpg'],
//     },
//     twitter: {
//       site: '@documenso',
//       card: 'summary_large_image',
//       images: ['/opengraph-image.jpg'],
//       description:
//         'Join Documenso, the open signing infrastructure, and get a 10x better signing experience. Pricing starts at $30/mo. forever! Sign in now and enjoy a faster, smarter, and more beautiful document signing process. Integrates with your favorite tools, customizable, and expandable. Support our mission and become a part of our open-source community.',
//     },
//   };
// }

export async function loader({ request, context }: Route.LoaderArgs) {
  const { getTheme } = await themeSessionResolver(request);

  let lang = await langCookie.parse(request.headers.get('cookie') ?? '');

  if (!APP_I18N_OPTIONS.supportedLangs.includes(lang)) {
    lang = extractLocaleData({ headers: request.headers });
  }

  return data(
    {
      lang,
      theme: getTheme(),
      session: context.session,
      __ENV__: Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_')), // Todo: I'm pretty sure this will leak?
      ),
    },
    {
      headers: {
        'Set-Cookie': await langCookie.serialize(lang),
      },
    },
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { __ENV__, theme, lang } = useLoaderData<typeof loader>() || {};

  // const [theme] = useTheme();

  return (
    <html translate="no" lang={lang} data-theme={theme ?? ''}>
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
        {/* <PreventFlashOnWrongTheme ssrTheme={Boolean(theme)} /> */}

        <Suspense>
          <PostHogPageview />
        </Suspense>
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />

        {/* Todo: Do we want this here? */}
        <RefreshOnFocus />

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
  console.error('[RootErrorBoundary]', error);

  const errorCode = isRouteErrorResponse(error) ? error.status : 500;

  return <GenericErrorLayout errorCode={errorCode} />;
}
