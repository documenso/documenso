import { createSession, generateSessionToken } from '@documenso/auth/server/lib/session/session';
import { getAuthSecret } from '@documenso/auth/server/lib/session/session-cookies';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { formatHostCookieName } from '@documenso/lib/constants/auth';
import { createDataContentImage } from '@documenso/lib/server-only/data-content/create-data-content-image';
import { EnvelopeContentType, ZEnvelopeContentMetaSchema } from '@documenso/lib/types/envelope-content-meta';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedDraftDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { serializeSigned } from 'hono/utils/cookie';

import { apiSignin } from '../../../fixtures/authentication';
import { createImageFile } from '../../../fixtures/contents';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

const contentImageUrl = (envelopeId: string, dataContentId: string) =>
  `${WEBAPP_BASE_URL}/api/files/envelope/${envelopeId}/dataContent/${dataContentId}/image`;

const envelopeItemPdfUrl = (envelopeId: string, envelopeItemId: string, documentDataId: string) =>
  `${WEBAPP_BASE_URL}/api/files/envelope/${envelopeId}/envelopeItem/${envelopeItemId}/dataId/${documentDataId}/current/item.pdf`;

/**
 * An owner with a draft document holding one image content.
 */
const seedOwnerWithImageContent = async () => {
  const owner = await seedUser();

  const draft = await seedDraftDocument(owner.user, owner.team.id, [], {
    createDocumentOptions: { title: 'Content Image Auth Test' },
  });

  const envelopeItem = draft.envelopeItems[0];

  const png = await createImageFile('auth-test.png', 64, 64);

  const dataContent = await createDataContentImage({
    file: {
      name: png.name,
      arrayBuffer: async () => await new Blob([png.buffer]).arrayBuffer(),
    },
  });

  await prisma.envelopeContent.create({
    data: {
      id: generateDatabaseId('envelope_content'),
      envelopeId: draft.id,
      envelopeItemId: envelopeItem.id,
      dataContentId: dataContent.id,
      contentMeta: ZEnvelopeContentMetaSchema.parse({
        type: EnvelopeContentType.IMAGE,
        page: 1,
        positionX: 10,
        positionY: 10,
        width: 20,
        height: 20,
      }),
    },
  });

  return { owner, draft, envelopeItem, dataContent };
};

/**
 * Mint an embed-only session for the user, the way the embed auth popup does
 * once it is redeemed, and return the `Cookie` header a browser would send
 * for it.
 *
 * Signed with the same secret and in the same format as `setEmbedSessionCookie`
 * so the server accepts it as genuine; only its `isEmbed` flag should stop it.
 */
const createEmbedSessionCookieHeader = async (userId: number) => {
  const token = generateSessionToken();

  await createSession(token, userId, {}, { isEmbed: true });

  const cookieName = formatHostCookieName('embedSessionId');

  const setCookie = await serializeSigned(cookieName, token, getAuthSecret(), { path: '/' });

  // Only the `name=value` pair is sent back on a request.
  return setCookie.split(';')[0];
};

test.describe('Content image endpoint authorization', () => {
  test('rejects an unauthenticated request', async ({ request }) => {
    const { draft, dataContent } = await seedOwnerWithImageContent();

    const res = await request.get(contentImageUrl(draft.id, dataContent.id));

    expect(res.status()).toBe(404);
  });

  test('rejects a request from a user outside the team', async ({ page }) => {
    const { draft, dataContent } = await seedOwnerWithImageContent();
    const { user: outsider } = await seedUser();

    await apiSignin({ page, email: outsider.email });

    const res = await page.request.get(contentImageUrl(draft.id, dataContent.id));

    expect(res.status()).toBe(404);
  });

  test('allows the owner with a normal session', async ({ page }) => {
    const { owner, draft, dataContent } = await seedOwnerWithImageContent();

    await apiSignin({ page, email: owner.user.email });

    const res = await page.request.get(contentImageUrl(draft.id, dataContent.id));

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  });

  /**
   * Embed sessions exist only to let a recipient sign inside an iframe. The
   * other `/api/files` routes treat one as anonymous, and this route must too,
   * otherwise a leaked embed cookie could read content images across every
   * team the account belongs to.
   */
  test('rejects an embed-only session, matching the envelope item pdf route', async ({ request }) => {
    const { owner, draft, envelopeItem, dataContent } = await seedOwnerWithImageContent();

    const cookie = await createEmbedSessionCookieHeader(owner.user.id);

    // Control: the cookie is a genuine session as far as the server is
    // concerned, so the refusals below are down to it being an embed session
    // and not to the cookie being ignored.
    const sessionRes = await request.get(`${WEBAPP_BASE_URL}/api/auth/session`, {
      headers: { Cookie: cookie },
    });

    expect(sessionRes.status()).toBe(200);

    const session = await sessionRes.json();

    expect(session.isAuthenticated).toBe(true);
    expect(session.user?.id).toBe(owner.user.id);
    expect(session.session?.isEmbed).toBe(true);

    const imageRes = await request.get(contentImageUrl(draft.id, dataContent.id), {
      headers: { Cookie: cookie },
    });

    expect(imageRes.status()).toBe(404);

    // Baseline: the same cookie is refused by the sibling PDF route.
    const pdfRes = await request.get(envelopeItemPdfUrl(draft.id, envelopeItem.id, envelopeItem.documentDataId), {
      headers: { Cookie: cookie },
    });

    expect(pdfRes.status()).toBe(404);
  });
});
