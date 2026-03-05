/**
 * Client for calling the Documenso main app API.
 * Used for create-presign-token and get-templates.
 */

const getDocumensoUrl = (): string => {
  const url = process.env.DOCUMENSO_URL ?? process.env.NEXT_PUBLIC_DOCUMENSO_URL;
  if (!url) {
    throw new Error('DOCUMENSO_URL or NEXT_PUBLIC_DOCUMENSO_URL is not set');
  }
  return url.replace(/\/$/, '');
};

export type CreatePresignTokenResponse = {
  token: string;
  expiresAt: string;
  expiresIn: number;
};

export async function createPresignToken(
  apiKey: string,
  options?: { expiresIn?: number; scope?: string },
): Promise<CreatePresignTokenResponse> {
  const baseUrl = getDocumensoUrl();
  const res = await fetch(`${baseUrl}/api/v2-beta/embedding/create-presign-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expiresIn: options?.expiresIn ?? 60,
      scope: options?.scope,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Documenso create-presign-token failed (${res.status}): ${body.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<CreatePresignTokenResponse>;
}

export type TemplateListItem = {
  id: number;
  externalId: string | null;
  type: string;
  title: string;
  userId: number;
  teamId: number | null;
  createdAt: string;
  updatedAt: string;
  directLink?: { token: string; enabled: boolean } | null;
};

export type GetTemplatesResponse = {
  templates: TemplateListItem[];
  totalPages: number;
};

export async function getTemplates(
  apiKey: string,
  options?: { page?: number; perPage?: number },
): Promise<GetTemplatesResponse> {
  const baseUrl = getDocumensoUrl();
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.perPage) params.set('perPage', String(options.perPage));

  const url = `${baseUrl}/api/v1/templates${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Documenso get-templates failed (${res.status}): ${body.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<GetTemplatesResponse>;
}

/**
 * Encodes embed params for the authoring URL hash.
 * The authoring pages expect: base64(encodeURIComponent(JSON.stringify(params)))
 */
function encodeEmbedAuthoringHash(params: Record<string, unknown> = {}): string {
  const json = JSON.stringify(params);
  return Buffer.from(encodeURIComponent(json), 'utf-8').toString('base64');
}

export function buildTemplateAuthoringLink(presignToken: string): string {
  const baseUrl = getDocumensoUrl();
  const hash = encodeEmbedAuthoringHash({});
  return `${baseUrl}/embed/v1/authoring/template/create?token=${encodeURIComponent(presignToken)}#${hash}`;
}

export function buildTemplateEditAuthoringLink(id: number, presignToken: string): string {
  const baseUrl = getDocumensoUrl();
  const hash = encodeEmbedAuthoringHash({});
  return `${baseUrl}/embed/v1/authoring/template/edit/${id}?token=${encodeURIComponent(presignToken)}#${hash}`;
}

export type CreateEnvelopeRequest = {
  recipientEmail: string;
  recipientName?: string;
  title?: string;
  prefillFields?: Array<{
    id: number;
    type: string;
    value?: string | string[];
    [key: string]: unknown;
  }>;
};

export type CreateEnvelopeResponse = {
  envelopeId: string;
  signingUrl: string;
  signingToken: string;
};

export type CreateTemplateResponse = {
  envelopeId: string;
  id: number;
};

export async function createTemplate(
  apiKey: string,
  formData: FormData,
): Promise<CreateTemplateResponse> {
  const baseUrl = getDocumensoUrl();
  const url = `${baseUrl}/api/v2-beta/template/create`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Documenso create-template failed (${res.status}): ${text.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<CreateTemplateResponse>;
}

export async function createEnvelope(
  apiKey: string,
  templateEnvelopeId: string,
  body: CreateEnvelopeRequest,
): Promise<CreateEnvelopeResponse> {
  const baseUrl = getDocumensoUrl();
  const url = `${baseUrl}/api/v2/template/${encodeURIComponent(templateEnvelopeId)}/create-envelope`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Documenso create-envelope failed (${res.status}): ${text.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<CreateEnvelopeResponse>;
}
