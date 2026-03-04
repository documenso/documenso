import { Trans } from '@lingui/react/macro';
import { AlertCircle } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Link, isRouteErrorResponse, redirect, useLoaderData, useRouteError } from 'react-router';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getDocumentByAccessToken } from '@documenso/lib/server-only/document/get-document-by-access-token';
import { qrShareViewRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { tokenFingerprint } from '@documenso/lib/universal/crypto';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { logger } from '@documenso/lib/utils/logger';
import { Button } from '@documenso/ui/primitives/button';

import { DocumentCertificateQRView } from '~/components/general/document/document-certificate-qr-view';
import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/share.$slug';

export function meta({ params: { slug }, loaderData }: Route.MetaArgs) {
  if (slug.startsWith('qr_')) {
    const documentTitle = loaderData?.document?.title ?? 'Shared Document';

    return [...appMetaTags(documentTitle), { name: 'robots', content: 'noindex, nofollow' }];
  }

  return [
    { title: 'Documenso - Share' },
    { description: 'I just signed a document in style with Documenso!' },
    {
      property: 'og:title',
      content: 'Documenso - Join the open source signing revolution',
    },
    {
      property: 'og:description',
      content: 'I just signed with Documenso!',
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}/opengraph`,
    },
    {
      name: 'twitter:site',
      content: '@documenso',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}/opengraph`,
    },
    {
      name: 'twitter:description',
      content: 'I just signed with Documenso!',
    },
  ];
}

type TQrShareErrorPayload = {
  code: string;
  message: string;
  correlationId: string;
};

const createQrShareErrorResponse = ({
  status,
  code,
  message,
  correlationId,
  headers,
}: {
  status: number;
  code: string;
  message: string;
  correlationId: string;
  headers?: HeadersInit;
}) => {
  return new Response(
    JSON.stringify({
      code,
      message,
      correlationId,
    } satisfies TQrShareErrorPayload),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Documenso-Error-Code': code,
        ...headers,
      },
    },
  );
};

const parseQrShareErrorPayload = (value: unknown): TQrShareErrorPayload | null => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      typeof parsed.code === 'string' &&
      typeof parsed.message === 'string' &&
      typeof parsed.correlationId === 'string'
    ) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
};

export const loader = async ({ request, params: { slug } }: Route.LoaderArgs) => {
  if (slug.startsWith('qr_')) {
    const correlationId = request.headers.get('x-request-id') ?? nanoid(12);
    const requestMetadata = extractRequestMetadata(request);
    const rateLimitResult = await qrShareViewRateLimit.check({
      ip: requestMetadata.ipAddress ?? 'unknown',
      identifier: tokenFingerprint(slug),
    });

    if (rateLimitResult.isLimited) {
      const retryAfter = String(
        Math.max(1, Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000)),
      );

      logger.warn({
        msg: 'QR share access throttled',
        documentId: null,
        recipientId: null,
        result: 'deny',
        denyReasonCode: 'QR_VIEW_RATE_LIMITED',
        correlationId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      throw createQrShareErrorResponse({
        status: 429,
        code: 'QR_VIEW_RATE_LIMITED',
        message: 'Too many requests. Please try again shortly.',
        correlationId,
        headers: {
          'Retry-After': retryAfter,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.reset.getTime() / 1000)),
        },
      });
    }

    try {
      const document = await getDocumentByAccessToken({ token: slug });

      logger.info({
        msg: 'QR share access allowed',
        documentId: document.id,
        recipientId: null,
        result: 'allow',
        denyReasonCode: null,
        correlationId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      return {
        document,
        token: slug,
      };
    } catch (error) {
      const appError = AppError.parseError(error);

      let status = 500;
      let code = 'QR_VIEW_INTERNAL_ERROR';
      let message = 'An unexpected error occurred while opening this document.';

      if (appError.code === AppErrorCode.NOT_FOUND) {
        status = 404;
        code = 'QR_VIEW_NOT_FOUND';
        message = 'The shared document could not be found.';
      } else if (appError.code === AppErrorCode.INVALID_REQUEST || appError.statusCode === 409) {
        status = 409;
        code = 'QR_VIEW_NOT_COMPLETED';
        message = 'This document is not fully completed yet.';
      } else if (appError.code === AppErrorCode.UNAUTHORIZED && appError.statusCode === 403) {
        status = 403;
        code = 'QR_VIEW_DISABLED';
        message = 'Public completed-document access is currently disabled.';
      } else if (appError.code === AppErrorCode.UNAUTHORIZED) {
        status = 401;
        code = 'QR_VIEW_UNAUTHORIZED';
        message = 'You are not authorized to view this document.';
      }

      logger.warn({
        msg: 'QR share access denied',
        documentId: null,
        recipientId: null,
        result: 'deny',
        denyReasonCode: code,
        correlationId,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      throw createQrShareErrorResponse({
        status,
        code,
        message,
        correlationId,
      });
    }
  }

  const userAgent = request.headers.get('User-Agent') ?? '';

  if (/bot|facebookexternalhit|WhatsApp|google|bing|duckduckbot|MetaInspector/i.test(userAgent)) {
    return {};
  }

  // Is hardcoded because this whole meta is hardcoded anyway for Documenso.
  throw redirect('https://documenso.com');
};

export default function SharePage() {
  const { document, token } = useLoaderData<typeof loader>();

  if (document) {
    return (
      <DocumentCertificateQRView
        documentId={document.id}
        title={document.title}
        documentTeamUrl={document.documentTeamUrl}
        internalVersion={document.internalVersion}
        envelopeItems={document.envelopeItems}
        recipientCount={document.recipientCount}
        completedDate={document.completedAt ?? undefined}
        token={token}
      />
    );
  }

  return <div></div>;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const payload = isRouteErrorResponse(error) ? parseQrShareErrorPayload(error.data) : null;

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-x-4">
        <AlertCircle className="size-10 self-start text-destructive" />

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold leading-normal md:text-3xl lg:text-4xl">
            <Trans>Unable to Open Document</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            {payload?.message ?? (
              <Trans>Something went wrong while opening this shared view.</Trans>
            )}
          </p>

          {payload?.correlationId && (
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Trans>Support code: {payload.correlationId}</Trans>
            </p>
          )}

          <Button className="mt-6 w-fit" asChild>
            <Link to="/">
              <Trans>Return Home</Trans>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
