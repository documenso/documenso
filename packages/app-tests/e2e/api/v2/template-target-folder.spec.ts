import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedBlankTemplate, seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { FolderType } from '@prisma/client';

const baseUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2`;

test('[TEMPLATE_TARGET_FOLDER_API]: target folder can be set, read, used and cleared through the template API', async ({
  request,
}) => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'target-folder',
    expiresIn: null,
  });

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  const targetFolder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      name: 'API Target Folder',
      type: FolderType.DOCUMENT,
    },
  });

  const template = await seedDirectTemplate({
    title: 'API target folder template',
    userId: user.id,
    teamId: team.id,
    internalVersion: 2,
  });

  const templateId = mapSecondaryIdToTemplateId(template.secondaryId);

  const recipients = template.recipients.map((recipient) => ({
    id: recipient.id,
    email: seedTestEmail(),
    name: 'Recipient',
  }));

  const updateRes = await request.post(`${baseUrl}/template/update`, {
    headers,
    data: {
      templateId,
      data: {
        targetFolderId: targetFolder.id,
      },
    },
  });

  expect(updateRes.ok()).toBeTruthy();
  expect((await updateRes.json()).targetFolderId).toBe(targetFolder.id);

  const getRes = await request.get(`${baseUrl}/template/${templateId}`, {
    headers,
  });

  expect(getRes.ok()).toBeTruthy();
  expect((await getRes.json()).targetFolderId).toBe(targetFolder.id);

  const useWithTargetRes = await request.post(`${baseUrl}/template/use`, {
    headers,
    data: {
      templateId,
      recipients,
    },
  });

  expect(useWithTargetRes.ok()).toBeTruthy();

  const documentInTarget = await prisma.envelope.findFirstOrThrow({
    where: {
      id: (await useWithTargetRes.json()).envelopeId,
    },
  });

  expect(documentInTarget.folderId).toBe(targetFolder.id);

  const useAtRootRes = await request.post(`${baseUrl}/template/use`, {
    headers,
    data: {
      templateId,
      recipients,
      folderId: null,
    },
  });

  expect(useAtRootRes.ok()).toBeTruthy();

  const documentAtRoot = await prisma.envelope.findFirstOrThrow({
    where: {
      id: (await useAtRootRes.json()).envelopeId,
    },
  });

  expect(documentAtRoot.folderId).toBeNull();

  const clearRes = await request.post(`${baseUrl}/template/update`, {
    headers,
    data: {
      templateId,
      data: {
        targetFolderId: null,
      },
    },
  });

  expect(clearRes.ok()).toBeTruthy();
  expect((await clearRes.json()).targetFolderId).toBeNull();
});

test('[TEMPLATE_TARGET_FOLDER_API]: template API rejects a target folder on v1 templates', async ({ request }) => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'target-folder-v1',
    expiresIn: null,
  });

  const folder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      type: FolderType.DOCUMENT,
    },
  });

  const legacyTemplate = await seedBlankTemplate(user, team.id);

  const res = await request.post(`${baseUrl}/template/update`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      templateId: mapSecondaryIdToTemplateId(legacyTemplate.secondaryId),
      data: {
        targetFolderId: folder.id,
      },
    },
  });

  expect(res.status()).toBe(400);

  const unchanged = await prisma.envelope.findFirstOrThrow({
    where: {
      id: legacyTemplate.id,
    },
  });

  expect(unchanged.targetFolderId).toBeNull();
});
