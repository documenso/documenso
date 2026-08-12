import { resolveEmailBrandingColors } from '@documenso/lib/utils/email-branding-colors';
import { renderEmailWithI18N } from '@documenso/lib/utils/render-email-with-i18n';

import { getTemplate } from '../lib/templates';
import type { Route } from './+types/api.render';

type RenderRequestBody = {
  slug: string;
  props: Record<string, unknown>;
  lang?: string;
  colors?: Record<string, string> | null;
  assetBaseUrl: string;
};

/**
 * POST /api/render — render an email template to HTML via the REAL production
 * pipeline (`renderEmailWithI18N`), so i18n and brand-colour injection match a
 * live send. Returns `text/html` for the client to drop into an iframe srcDoc.
 */
export const action = async ({ request }: Route.ActionArgs) => {
  const body = (await request.json()) as RenderRequestBody;

  const template = getTemplate(body.slug);

  if (!template) {
    return new Response(JSON.stringify({ error: `Unknown template: ${body.slug}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Resolve brand colours through the same resolver production uses, so the
  // preview applies the same per-token fallbacks as a live send.
  const brandingColors =
    body.colors && Object.keys(body.colors).length > 0 ? resolveEmailBrandingColors(body.colors) : null;

  const Component = template.component;
  const element = <Component {...body.props} assetBaseUrl={body.assetBaseUrl} />;

  const html = await renderEmailWithI18N(element, {
    lang: body.lang ?? 'en',
    branding: brandingColors
      ? {
          brandingEnabled: true,
          brandingUrl: '',
          brandingLogo: '',
          brandingCompanyDetails: '',
          brandingHidePoweredBy: false,
          brandingColors,
        }
      : undefined,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
