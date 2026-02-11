/**
 * CORS helper for API routes.
 * Based on: https://github.com/vercel/examples/blob/main/edge-functions/cors/lib/cors.ts
 */

type StaticOrigin = boolean | string | RegExp | (boolean | string | RegExp)[];

type OriginFn = (origin: string | undefined, req: Request) => StaticOrigin | Promise<StaticOrigin>;

interface CorsOptions {
  origin?: StaticOrigin | OriginFn;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

const defaultOptions: CorsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Authorization, X-API-Key',
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

function isOriginAllowed(origin: string, allowed: StaticOrigin): boolean {
  return Array.isArray(allowed)
    ? allowed.some((o) => isOriginAllowed(origin, o))
    : typeof allowed === 'string'
      ? origin === allowed
      : allowed instanceof RegExp
        ? allowed.test(origin)
        : !!allowed;
}

function getOriginHeaders(reqOrigin: string | undefined, origin: StaticOrigin) {
  const headers = new Headers();

  if (origin === '*') {
    headers.set('Access-Control-Allow-Origin', '*');
  } else if (typeof origin === 'string') {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.append('Vary', 'Origin');
  } else {
    const allowed = isOriginAllowed(reqOrigin ?? '', origin);

    if (allowed && reqOrigin) {
      headers.set('Access-Control-Allow-Origin', reqOrigin);
    }
    headers.append('Vary', 'Origin');
  }

  return headers;
}

async function originHeadersFromReq(req: Request, origin: StaticOrigin | OriginFn) {
  const reqOrigin = req.headers.get('Origin') || undefined;
  const value = typeof origin === 'function' ? await origin(reqOrigin!, req) : origin;

  if (!value) return;
  return getOriginHeaders(reqOrigin, value);
}

function getAllowedHeaders(req: Request, allowed?: string | string[]) {
  const headers = new Headers();

  if (!allowed) {
    allowed = req.headers.get('Access-Control-Request-Headers') ?? '';
    headers.append('Vary', 'Access-Control-Request-Headers');
  } else if (Array.isArray(allowed)) {
    allowed = allowed.join(',');
  }
  if (allowed) {
    headers.set('Access-Control-Allow-Headers', allowed);
  }

  return headers;
}

export default async function cors(req: Request, res: Response, options?: CorsOptions) {
  const opts = { ...defaultOptions, ...options };
  const { headers } = res;
  const originHeaders = await originHeadersFromReq(req, opts.origin ?? false);

  const mergeHeaders = (v: string, k: string) => {
    if (k === 'Vary') {
      headers.append(k, v);
    } else {
      headers.set(k, v);
    }
  };

  if (!originHeaders) return res;

  originHeaders.forEach(mergeHeaders);

  if (opts.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  const exposed = Array.isArray(opts.exposedHeaders)
    ? opts.exposedHeaders.join(',')
    : opts.exposedHeaders;

  if (exposed) {
    headers.set('Access-Control-Expose-Headers', exposed);
  }

  if (req.method === 'OPTIONS') {
    if (opts.methods) {
      const methods = Array.isArray(opts.methods) ? opts.methods.join(',') : opts.methods;
      headers.set('Access-Control-Allow-Methods', methods);
    }

    getAllowedHeaders(req, opts.allowedHeaders).forEach(mergeHeaders);

    if (typeof opts.maxAge === 'number') {
      headers.set('Access-Control-Max-Age', String(opts.maxAge));
    }

    if (opts.preflightContinue) return res;

    headers.set('Content-Length', '0');
    return new Response(null, { status: opts.optionsSuccessStatus ?? 204, headers });
  }

  return res;
}
