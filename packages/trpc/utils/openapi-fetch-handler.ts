import { TRPCError } from '@trpc/server';
import type { FetchHandlerOptions } from '@trpc/server/adapters/fetch';
import type { ServerResponse } from 'node:http';
import { type OpenApiRouter, createOpenApiNodeHttpHandler } from 'trpc-to-openapi';

const CONTENT_TYPE_JSON = 'application/json';
const CONTENT_TYPE_URLENCODED = 'application/x-www-form-urlencoded';
const CONTENT_TYPE_MULTIPART = 'multipart/form-data';

const getUrlEncodedBody = async (req: Request) => {
  const params = new URLSearchParams(await req.text());

  const data: Record<string, unknown> = {};

  for (const key of params.keys()) {
    data[key] = params.getAll(key);
  }

  return data;
};

const getMultipartBody = async (req: Request) => {
  const formData = await req.formData();

  const data: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // !: Handles cases where our generated SDKs send key[] syntax for arrays.
    const normalizedKey = key.endsWith('[]') ? key.slice(0, -2) : key;

    if (data[normalizedKey] === undefined) {
      data[normalizedKey] = value;
    } else if (Array.isArray(data[normalizedKey])) {
      data[normalizedKey].push(value);
    } else {
      data[normalizedKey] = [data[normalizedKey], value];
    }
  }

  return data;
};
/**
 * Parses the request body based on its content type.
 *
 * Handles JSON, URL-encoded, and multipart/form-data requests.
 * For multipart requests, converts FormData to a plain object (similar to URL-encoded)
 * so it can be validated by tRPC schemas. The content-type header is rewritten
 * later to prevent downstream parsing issues.
 */
const getRequestBody = async (req: Request) => {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes(CONTENT_TYPE_JSON)) {
      return {
        isValid: true,
        // Use JSON.parse instead of req.json() because req.json() does not throw on invalid JSON
        data: JSON.parse(await req.text()),
      };
    }

    if (contentType.includes(CONTENT_TYPE_URLENCODED)) {
      return {
        isValid: true,
        data: await getUrlEncodedBody(req),
      };
    }

    // Handle multipart/form-data by parsing as FormData and converting to a plain object.
    // This mirrors how URL-encoded data is structured, allowing tRPC to validate it normally.
    // The content-type header is rewritten to application/json later via the request proxy
    // because createOpenApiNodeHttpHandler aborts on any bodied request that isn't application/json.
    if (contentType.includes(CONTENT_TYPE_MULTIPART)) {
      return {
        isValid: true,
        data: await getMultipartBody(req),
      };
    }

    return {
      isValid: true,
      data: req.body,
    };
  } catch (err) {
    return {
      isValid: false,
      cause: err,
    };
  }
};

/**
 * Creates a proxy around the original Request that intercepts property access
 * to transform the request for compatibility with the Node HTTP handler.
 *
 * Key transformations:
 * - Parses and provides the body as a plain object (handles multipart/form-data conversion)
 * - Rewrites content-type header for multipart requests to application/json
 *   (required because createOpenApiNodeHttpHandler aborts on non-JSON bodied requests)
 */
const createRequestProxy = async (req: Request, url?: string) => {
  const body = await getRequestBody(req);

  const originalContentType = req.headers.get('content-type') || '';

  const isMultipart = originalContentType.includes(CONTENT_TYPE_MULTIPART);

  return new Proxy(req, {
    get: (target, prop) => {
      switch (prop) {
        case 'url':
          return url ?? target.url;

        case 'body': {
          if (!body.isValid) {
            throw new TRPCError({
              code: 'PARSE_ERROR',
              message: 'Failed to parse request body',
              cause: body.cause,
            });
          }

          return body.data;
        }

        case 'headers': {
          const headers = new Headers(target.headers);

          // Rewrite content-type header for multipart requests to application/json.
          // This is necessary because `createOpenApiNodeHttpHandler` aborts on any bodied
          // request that isn't application/json. Since we've already parsed the multipart
          // data into a plain object above, this is safe to do.
          if (isMultipart) {
            headers.set('content-type', CONTENT_TYPE_JSON);
          }

          return headers;
        }

        default:
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
          return (target as unknown as Record<string | number | symbol, unknown>)[prop];
      }
    },
  });
};

export type CreateOpenApiFetchHandlerOptions<TRouter extends OpenApiRouter> = Omit<
  FetchHandlerOptions<TRouter>,
  'batching'
> & {
  req: Request;
  endpoint: `/${string}`;
};

export const createOpenApiFetchHandler = async <TRouter extends OpenApiRouter>(
  opts: CreateOpenApiFetchHandlerOptions<TRouter>,
): Promise<Response> => {
  const resHeaders = new Headers();
  const url = new URL(opts.req.url.replace(opts.endpoint, ''));
  const req: Request = await createRequestProxy(opts.req, url.toString());

  // @ts-expect-error Inherited from original fetch handler in `trpc-to-openapi`
  const openApiHttpHandler = createOpenApiNodeHttpHandler(opts);

  return new Promise<Response>((resolve) => {
    let statusCode: number;

    // Create a mock ServerResponse object that bridges Node HTTP APIs with Fetch API Response.
    // This allows the Node HTTP handler to work with Fetch API Request objects.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res = {
      setHeader: (key: string, value: string | readonly string[]) => {
        if (typeof value === 'string') {
          resHeaders.set(key, value);
        } else {
          for (const v of value) {
            resHeaders.append(key, v);
          }
        }
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(code: number) {
        statusCode = code;
      },
      end: (body: string) => {
        resolve(
          new Response(body, {
            headers: resHeaders,
            status: statusCode,
          }),
        );
      },
    } as ServerResponse;

    // Type assertions are necessary here for interop between Fetch API Request/Response
    // and Node HTTP IncomingMessage/ServerResponse types.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const nodeReq = req as unknown as Parameters<typeof openApiHttpHandler>[0];

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const nodeRes = res as unknown as Parameters<typeof openApiHttpHandler>[1];

    void openApiHttpHandler(nodeReq, nodeRes);
  });
};
