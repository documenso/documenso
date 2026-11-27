import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedBlankTemplate, seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import type { TUseEnvelopePayload } from '@documenso/trpc/server/envelope-router/use-envelope.types';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { FolderType } from '@prisma/client';

const baseUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2`;

const seedTemplateWithTargetFolder = async () => {
  const { user, team } = await seedUser();

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'target-folder',
    expiresIn: null,
  });

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

  const recipients = template.recipients.map((recipient) => ({
    id: recipient.id,
    email: seedTestEmail(),
    name: 'Recipient',
  }));

  return {
    user,
    team,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    targetFolder,
    template,
    recipients,
  };
};

const useEnvelope = async (
  request: APIRequestContext,
  headers: Record<string, string>,
  payload: TUseEnvelopePayload,
) => {
  const formData = new FormData();

  formData.append('payload', JSON.stringify(payload));

  const res = await request.post(`${baseUrl}/envelope/use`, {
    headers,
    multipart: formData,
  });

  expect(res.ok(), await res.text()).toBeTruthy();

  const { id } = await res.json();

  return await prisma.envelope.findFirstOrThrow({
    where: {
      id,
    },
  });
};

test('[TEMPLATE_TARGET_FOLDER_API]: envelope API sets, reads, uses and clears the target folder', async ({
  request,
}) => {
  const { headers, targetFolder, template, recipients } = await seedTemplateWithTargetFolder();

  const updateRes = await request.post(`${baseUrl}/envelope/update`, {
    headers,
    data: {
      envelopeId: template.id,
      data: {
        targetFolderId: targetFolder.id,
      },
    },
  });

  expect(updateRes.ok(), await updateRes.text()).toBeTruthy();

  const getRes = await request.get(`${baseUrl}/envelope/${template.id}`, {
    headers,
  });

  expect(getRes.ok()).toBeTruthy();
  expect((await getRes.json()).targetFolderId).toBe(targetFolder.id);

  const documentInTarget = await useEnvelope(request, headers, {
    envelopeId: template.id,
    recipients,
  });

  expect(documentInTarget.folderId).toBe(targetFolder.id);

  const documentAtRoot = await useEnvelope(request, headers, {
    envelopeId: template.id,
    recipients,
    folderId: null,
  });

  expect(documentAtRoot.folderId).toBeNull();

  const clearRes = await request.post(`${baseUrl}/envelope/update`, {
    headers,
    data: {
      envelopeId: template.id,
      data: {
        targetFolderId: null,
      },
    },
  });

  expect(clearRes.ok()).toBeTruthy();

  const clearedTemplate = await prisma.envelope.findFirstOrThrow({
    where: {
      id: template.id,
    },
  });

  expect(clearedTemplate.targetFolderId).toBeNull();
});

test('[TEMPLATE_TARGET_FOLDER_API]: deprecated template API ignores the target folder', async ({ request }) => {
  const { headers, targetFolder, template, recipients } = await seedTemplateWithTargetFolder();

  await prisma.envelope.update({
    where: {
      id: template.id,
    },
    data: {
      targetFolderId: targetFolder.id,
    },
  });

  const templateId = mapSecondaryIdToTemplateId(template.secondaryId);

  const getRes = await request.get(`${baseUrl}/template/${templateId}`, {
    headers,
  });

  expect(getRes.ok()).toBeTruthy();
  expect(await getRes.json()).not.toHaveProperty('targetFolderId');

  const useRes = await request.post(`${baseUrl}/template/use`, {
    headers,
    data: {
      templateId,
      recipients,
    },
  });

  expect(useRes.ok(), await useRes.text()).toBeTruthy();

  const createdDocument = await prisma.envelope.findFirstOrThrow({
    where: {
      id: (await useRes.json()).envelopeId,
    },
  });

  expect(createdDocument.folderId).toBeNull();
});

test('[TEMPLATE_TARGET_FOLDER_API]: envelope API rejects a target folder on v1 templates', async ({ request }) => {
  const { user, team, headers } = await seedTemplateWithTargetFolder();

  const folder = await seedBlankFolder(user, team.id, {
    createFolderOptions: {
      type: FolderType.DOCUMENT,
    },
  });

  const legacyTemplate = await seedBlankTemplate(user, team.id);

  const res = await request.post(`${baseUrl}/envelope/update`, {
    headers,
    data: {
      envelopeId: legacyTemplate.id,
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
