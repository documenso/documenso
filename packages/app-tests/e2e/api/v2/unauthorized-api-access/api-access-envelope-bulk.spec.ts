import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';
import { EnvelopeType, FolderType } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedBlankFolder } from '@documenso/prisma/seed/folders';
import { seedUser } from '@documenso/prisma/seed/users';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

// Todo: Remove skip once the API endpoints are released.
test.describe.skip('Envelope Bulk API V2', () => {
  let userA: User, teamA: Team, userB: User, teamB: Team, tokenA: string, tokenB: string;

  test.beforeEach(async () => {
    ({ user: userA, team: teamA } = await seedUser());
    ({ token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'userA',
      expiresIn: null,
    }));

    ({ user: userB, team: teamB } = await seedUser());
    ({ token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    }));
  });

  test.describe('Envelope bulk move endpoint', () => {
    test('should block unauthorized access to envelope bulk move endpoint', async ({ request }) => {
      // Create a document owned by userA
      const doc = await seedBlankDocument(userA, teamA.id);

      // UserB tries to move userA's document
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/move`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          envelopeIds: [doc.id],
          envelopeType: EnvelopeType.DOCUMENT,
          folderId: null,
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.movedCount).toBe(0);

      // Verify in database that the document was not modified
      const docInDb = await prisma.envelope.findFirst({
        where: { id: doc.id },
      });

      expect(docInDb).not.toBeNull();
      expect(docInDb?.folderId).toBeNull();
    });

    test('should block moving envelopes to unauthorized folder', async ({ request }) => {
      // Create a document owned by userB
      const doc = await seedBlankDocument(userB, teamB.id);

      // Create a folder owned by userA
      const folderA = await seedBlankFolder(userA, teamA.id, {
        createFolderOptions: {
          name: 'UserA Folder',
          type: FolderType.DOCUMENT,
        },
      });

      // UserB tries to move their document to userA's folder
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/move`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          envelopeIds: [doc.id],
          envelopeType: EnvelopeType.DOCUMENT,
          folderId: folderA.id,
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);

      // Verify in database that the document was not modified
      const docInDb = await prisma.envelope.findFirst({
        where: { id: doc.id },
      });

      expect(docInDb).not.toBeNull();
      expect(docInDb?.folderId).toBeNull();
    });

    test('should allow authorized access to envelope bulk move endpoint', async ({ request }) => {
      // Create a document owned by userA
      const doc = await seedBlankDocument(userA, teamA.id);

      // Create a folder owned by userA
      const folderA = await seedBlankFolder(userA, teamA.id, {
        createFolderOptions: {
          name: 'UserA Folder',
          type: FolderType.DOCUMENT,
        },
      });

      // UserA moves their own document to their own folder
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/move`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          envelopeIds: [doc.id],
          envelopeType: EnvelopeType.DOCUMENT,
          folderId: folderA.id,
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.movedCount).toBe(1);

      // Verify in database that the document was moved to the folder
      const docInDb = await prisma.envelope.findFirst({
        where: { id: doc.id },
      });

      expect(docInDb).not.toBeNull();
      expect(docInDb?.folderId).toBe(folderA.id);
    });

    test('should only move authorized envelopes when given mixed array of envelope IDs', async ({
      request,
    }) => {
      // Create documents owned by userA
      const docA1 = await seedBlankDocument(userA, teamA.id);
      const docA2 = await seedBlankDocument(userA, teamA.id);

      // Create a document owned by userB
      const docB = await seedBlankDocument(userB, teamB.id);

      // Create a folder owned by userA
      const folderA = await seedBlankFolder(userA, teamA.id, {
        createFolderOptions: {
          name: 'UserA Folder',
          type: FolderType.DOCUMENT,
        },
      });

      // UserA tries to move a mix of their own documents and userB's document
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/move`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          envelopeIds: [docA1.id, docB.id, docA2.id],
          envelopeType: EnvelopeType.DOCUMENT,
          folderId: folderA.id,
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      // Only userA's documents should be moved
      expect(body.movedCount).toBe(2);

      // Verify userA's documents were moved
      const docA1InDb = await prisma.envelope.findFirst({
        where: { id: docA1.id },
      });
      expect(docA1InDb).not.toBeNull();
      expect(docA1InDb?.folderId).toBe(folderA.id);

      const docA2InDb = await prisma.envelope.findFirst({
        where: { id: docA2.id },
      });
      expect(docA2InDb).not.toBeNull();
      expect(docA2InDb?.folderId).toBe(folderA.id);

      // Verify userB's document was NOT moved
      const docBInDb = await prisma.envelope.findFirst({
        where: { id: docB.id },
      });
      expect(docBInDb).not.toBeNull();
      expect(docBInDb?.folderId).toBeNull();
    });

    test('should move zero envelopes when all envelope IDs in array are unauthorized', async ({
      request,
    }) => {
      // Create documents owned by userB
      const docB1 = await seedBlankDocument(userB, teamB.id);
      const docB2 = await seedBlankDocument(userB, teamB.id);

      // Create a folder owned by userA
      const folderA = await seedBlankFolder(userA, teamA.id, {
        createFolderOptions: {
          name: 'UserA Folder',
          type: FolderType.DOCUMENT,
        },
      });

      // UserA tries to move userB's documents
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/move`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          envelopeIds: [docB1.id, docB2.id],
          envelopeType: EnvelopeType.DOCUMENT,
          folderId: folderA.id,
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.movedCount).toBe(0);

      // Verify userB's documents were NOT moved
      const docB1InDb = await prisma.envelope.findFirst({
        where: { id: docB1.id },
      });
      expect(docB1InDb).not.toBeNull();
      expect(docB1InDb?.folderId).toBeNull();

      const docB2InDb = await prisma.envelope.findFirst({
        where: { id: docB2.id },
      });
      expect(docB2InDb).not.toBeNull();
      expect(docB2InDb?.folderId).toBeNull();
    });
  });

  test.describe('Envelope bulk delete endpoint', () => {
    test('should block unauthorized access to envelope bulk delete endpoint', async ({
      request,
    }) => {
      // Create a document owned by userA
      const doc = await seedBlankDocument(userA, teamA.id);

      // UserB tries to delete userA's document
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          envelopeIds: [doc.id],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.deletedCount).toBe(0);
      // Unauthorized envelope ID should be in failedIds
      expect(body.failedIds).toEqual([doc.id]);

      // Verify in database that the document still exists
      const docInDb = await prisma.envelope.findFirst({
        where: { id: doc.id },
      });

      expect(docInDb).not.toBeNull();
      expect(docInDb?.id).toBe(doc.id);
      expect(docInDb?.deletedAt).toBeNull();
    });

    test('should allow authorized access to envelope bulk delete endpoint', async ({ request }) => {
      // Create a document owned by userA
      const doc = await seedBlankDocument(userA, teamA.id);

      // UserA deletes their own document
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          envelopeIds: [doc.id],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.deletedCount).toBe(1);
      expect(body.failedIds).toEqual([]);

      // Verify in database that the document no longer exists
      const docInDb = await prisma.envelope.findFirst({
        where: { id: doc.id },
      });

      expect(docInDb).toBeNull();
    });

    test('should only delete authorized envelopes when given mixed array of envelope IDs', async ({
      request,
    }) => {
      // Create documents owned by userA
      const docA1 = await seedBlankDocument(userA, teamA.id);
      const docA2 = await seedBlankDocument(userA, teamA.id);

      // Create a document owned by userB
      const docB = await seedBlankDocument(userB, teamB.id);

      // UserA tries to delete a mix of their own documents and userB's document
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          envelopeIds: [docA1.id, docB.id, docA2.id],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      // Only userA's documents should be deleted
      expect(body.deletedCount).toBe(2);
      // Unauthorized envelope ID (docB) should be in failedIds
      expect(body.failedIds).toEqual([docB.id]);

      // Verify userA's documents were deleted
      const docA1InDb = await prisma.envelope.findFirst({
        where: { id: docA1.id },
      });
      expect(docA1InDb).toBeNull();

      const docA2InDb = await prisma.envelope.findFirst({
        where: { id: docA2.id },
      });
      expect(docA2InDb).toBeNull();

      // Verify userB's document was NOT deleted
      const docBInDb = await prisma.envelope.findFirst({
        where: { id: docB.id },
      });
      expect(docBInDb).not.toBeNull();
      expect(docBInDb?.id).toBe(docB.id);
      expect(docBInDb?.deletedAt).toBeNull();
    });

    test('should delete zero envelopes when all envelope IDs in array are unauthorized', async ({
      request,
    }) => {
      // Create documents owned by userB
      const docB1 = await seedBlankDocument(userB, teamB.id);
      const docB2 = await seedBlankDocument(userB, teamB.id);

      // UserA tries to delete userB's documents
      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/bulk/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          envelopeIds: [docB1.id, docB2.id],
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.deletedCount).toBe(0);
      // All unauthorized envelope IDs should be in failedIds
      expect(body.failedIds).toEqual(expect.arrayContaining([docB1.id, docB2.id]));
      expect(body.failedIds).toHaveLength(2);

      // Verify userB's documents were NOT deleted
      const docB1InDb = await prisma.envelope.findFirst({
        where: { id: docB1.id },
      });
      expect(docB1InDb).not.toBeNull();
      expect(docB1InDb?.id).toBe(docB1.id);
      expect(docB1InDb?.deletedAt).toBeNull();

      const docB2InDb = await prisma.envelope.findFirst({
        where: { id: docB2.id },
      });
      expect(docB2InDb).not.toBeNull();
      expect(docB2InDb?.id).toBe(docB2.id);
      expect(docB2InDb?.deletedAt).toBeNull();
    });
  });
});
