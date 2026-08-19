import type { ServerResponse } from 'node:http';
import { TRPCError } from '@trpc/server';
import type { FetchHandlerOptions } from '@trpc/server/adapters/fetch';
import { createOpenApiNodeHttpHandler, type OpenApiRouter } from 'trpc-to-openapi';

const CONTENT_TYPE_JSON = 'application/json';
const CONTENT_TYPE_URLENCODED = 'application/x-www-form-urlencoded';
const CONTENT_TYPE_MULTIPART = 'multipart/form-data';

const getUrlEncodedBody = async (req: Request) => {
  const params = new URLSearchParams(await req.text());

  const data: Record<string, string[]> = {};

  for (const key of params.keys()) {
    data[key] = params.getAll(key);
  }

  return data;
};

const getMultipartBody = async (req: Request) => {
  const formData = await req.formData();

  const data: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};

  for (const [key, value] of formData.entries()) {
    // !: Handles cases where our generated SDKs send key[] syntax for arrays.
    const normalizedKey = key.endsWith('[]') ? key.slice(0, -2) : key;

    const existing = data[normalizedKey];

    if (existing === undefined) {
      data[normalizedKey] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      data[normalizedKey] = [existing, value];
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
          // SAFETY: Every property this trap does not special-case is forwarded from the
          // original Request, so `prop` can only be a key the caller reads off a Request.
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return target[prop as keyof Request];
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

  // The handler is typed against Node HTTP req/res, but only reads properties our request
  // proxy and mock response provide, so we declare it against the fetch-based types we pass.
  // @ts-expect-error Inherited from original fetch handler in `trpc-to-openapi`
  const openApiHttpHandler: (req: Request, res: ServerResponse) => void = createOpenApiNodeHttpHandler(opts);

  return new Promise<Response>((resolve) => {
    let statusCode: number;

    // SAFETY: The Node HTTP handler only calls setHeader/statusCode/end on the response,
    // which this mock implements to bridge Node HTTP APIs with a Fetch API Response.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const res = {
      setHeader: (key: string, value: string | string[]) => {
        if (Array.isArray(value)) {
          for (const v of value) {
            resHeaders.append(key, v);
          }
        } else {
          resHeaders.set(key, value);
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

    void openApiHttpHandler(req, res);
  });
};
