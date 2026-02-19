# tRPC File Upload Flow (Documenso)

This document explains how Documenso uploads files via tRPC using `multipart/form-data`, from client to server validation and persistence.

## 1) Client: send `FormData` to a tRPC mutation

In `apps/remix/app/components/general/envelope/envelope-upload-button.tsx`, the UI builds a `FormData` payload and calls the mutation directly:

- `payload` is appended as a JSON string.
- each file is appended with the same key (`files`) so it becomes a repeatable field.

Pattern:

```ts
const formData = new FormData();
formData.append('payload', JSON.stringify(payload));

for (const file of files) {
  formData.append('files', file);
}

await createEnvelope(formData);
```

Important details:

- The mutation call is `trpc.envelope.create.useMutation()` and accepts `FormData` for this route.
- The client also does pre-check UX (limits, max files, size messaging), but server still enforces authoritative validation.

## 2) Route contract: multipart + zod-form-data

In `packages/trpc/server/envelope-router/create-envelope.types.ts`:

- OpenAPI metadata explicitly marks the route as multipart:
  - `contentTypes: ['multipart/form-data']`
- request schema uses a custom `zodFormData(...)` wrapper.
- `payload` is parsed from JSON with `zfd.json(...)`.
- `files` is parsed as repeated files with `zfd.repeatableOfType(zfd.file())`.

Pattern:

```ts
export const ZCreateEnvelopeRequestSchema = zodFormData({
  payload: zfd.json(ZCreateEnvelopePayloadSchema),
  files: zfd.repeatableOfType(zfd.file()),
});
```

This gives a strongly typed input:

- `input.payload` is a validated object.
- `input.files` is a validated `File[]`.

## 3) Why `zodFormData` exists

In `packages/trpc/utils/zod-form-data.ts`, `zodFormData` is a thin preprocess helper:

- if input is `FormData`, it converts it into a plain object.
- duplicate keys become arrays (`getAll(key)` behavior).
- then runs `z.object(schema)` validation.

Reason in code comments:

- it replaces `zfd.formData()` due to pipeline/openapi edge cases where `undefined` can surface and break parsing.

So this helper is a compatibility layer that still behaves like normal form-data parsing for Zod.

Full file:

```ts
import type { ZodRawShape } from 'zod';
import z from 'zod';

/**
 * This helper takes the place of the `z.object` at the root of your schema.
 * It wraps your schema in a `z.preprocess` that extracts all the data out of a `FormData`
 * and transforms it into a regular object.
 * If the `FormData` contains multiple entries with the same field name,
 * it will automatically turn that field into an array.
 *
 * This is used instead of `zfd.formData()` because it receives `undefined`
 * somewhere in the pipeline of our openapi schema generation and throws
 * an error. This provides the same functionality as `zfd.formData()` but
 * can be considered somewhat safer.
 */
export const zodFormData = <T extends ZodRawShape>(schema: T) => {
  return z.preprocess((data) => {
    if (data instanceof FormData) {
      const formData: Record<string, unknown> = {};

      for (const key of data.keys()) {
        const values = data.getAll(key);

        formData[key] = values.length > 1 ? values : values[0];
      }

      return formData;
    }

    return data;
  }, z.object(schema));
};
```

## 4) Server mutation: validate and process each uploaded file

In `packages/trpc/server/envelope-router/create-envelope.ts`:

1. input is already schema-validated (`.input(ZCreateEnvelopeRequestSchema)`).
2. server enforces limits and file rules:
   - monthly doc limit
   - max envelope item count
   - MIME must start with `application/pdf`
3. each uploaded file is processed:
   - convert to buffer via `await file.arrayBuffer()`
   - optionally inject form values into PDF
   - normalize PDF
   - extract placeholders
   - upload file bytes server-side (`putPdfFileServerSide`)
4. resulting uploaded file IDs (`documentDataId`) are attached to envelope items.
5. envelope is created with those items + recipient mapping logic.

Key loop:

```ts
const envelopeItems = await Promise.all(
  files.map(async (file) => {
    let pdf = Buffer.from(await file.arrayBuffer());
    // ... optional transform + normalize + placeholder extraction
    const { id: documentDataId } = await putPdfFileServerSide({
      name: file.name,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(cleanedPdf),
    });
    return { title: file.name, documentDataId, placeholders };
  }),
);
```

## 5) Multipart parsing infrastructure (critical)

The multipart body support is implemented in `packages/trpc/utils/openapi-fetch-handler.ts`.

For multipart requests, it:

- reads `req.formData()`,
- converts entries into a plain object (accumulating repeated keys into arrays),
- supports `key[]` sent by some SDKs by normalizing to `key`,
- rewrites request `content-type` to `application/json` for the OpenAPI node handler interop,
- and passes parsed body downstream.

This is why multipart routes can be validated by normal Zod/tRPC schemas in this codebase.

Key multipart handling code:

```ts
const CONTENT_TYPE_JSON = 'application/json';
const CONTENT_TYPE_URLENCODED = 'application/x-www-form-urlencoded';
const CONTENT_TYPE_MULTIPART = 'multipart/form-data';

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
```

Header rewrite and proxy behavior:

```ts
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
          return (target as unknown as Record<string | number | symbol, unknown>)[prop];
      }
    },
  });
};
```

## 6) Porting checklist for another project

Use this exact checklist:

1. **Client mutation**
   - Build `FormData`.
   - Append structured data as JSON string (for example `payload`).
   - Append each file under a repeatable field key (for example `files`).
2. **Route meta**
   - Mark route with `contentTypes: ['multipart/form-data']`.
3. **Schema**
   - Parse JSON field with `zfd.json(...)`.
   - Parse repeated files with `zfd.repeatableOfType(zfd.file())`.
   - Wrap root with a form-data preprocessor (`zodFormData` pattern).
4. **Request adapter**
   - Ensure your server adapter can parse multipart into plain object + file values before schema validation.
5. **Server safety checks**
   - Enforce limits/count/type server-side, not just UI.
6. **File processing**
   - Read each file (`arrayBuffer`), transform as needed, upload, persist returned storage IDs.

## 7) Common pitfalls

- Relying only on client-side file restrictions.
- Forgetting repeatable parsing for multiple files.
- Missing multipart handling in the HTTP/OpenAPI adapter layer.
- Using mismatched field names between client FormData and Zod schema keys.
