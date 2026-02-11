import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import { exchangeCredentials } from '@/lib/exchange';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(body: unknown): {
  credentials: Record<string, unknown>;
  slug: string;
  organisationId: string;
} | null {
  if (!isRecord(body)) {
    return null;
  }

  const { credentials, slug, organisationId } = body;

  if (!isRecord(credentials) || typeof slug !== 'string' || typeof organisationId !== 'string') {
    return null;
  }

  return {
    credentials,
    slug: slug.trim(),
    organisationId: organisationId.trim(),
  };
}

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');

  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }

  return req.headers.get('X-API-Key');
}

export async function POST(request: NextRequest) {
  const secret = process.env.TOKEN_EXCHANGE_SECRET;

  if (!secret) {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Token exchange is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const provided = getAuthHeader(request);

  if (!provided || provided !== secret) {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Invalid JSON body', code: 'INVALID_JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const parsed = parseBody(body);

  if (!parsed) {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'Missing or invalid fields: credentials, slug, organisationId',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const result = await exchangeCredentials(parsed);

  if (!result.success) {
    const status =
      result.code === 'INVALID_CREDENTIALS'
        ? 401
        : result.code === 'ORGANISATION_NOT_FOUND' || result.code === 'INVALID_SLUG'
          ? 404
          : result.code === 'TEAM_URL_TAKEN'
            ? 409
            : 400;

    return cors(
      request,
      new Response(JSON.stringify({ error: result.error, code: result.code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  return cors(
    request,
    new Response(
      JSON.stringify({
        teamId: result.teamId,
        apiKey: result.apiKey,
        teamCreated: result.teamCreated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
}

export function OPTIONS(request: NextRequest) {
  return cors(request, new Response(null, { status: 204 }));
}
