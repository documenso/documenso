import fs from 'node:fs';
import path from 'node:path';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { EnvelopeType, RecipientRole } from '@documenso/prisma/client';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TCreateEnvelopePayload } from '@documenso/trpc/server/envelope-router/create-envelope.types';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

const examplePdf = fs.readFileSync(path.join(__dirname, '../../../../assets/example.pdf'));

test.describe.configure({ mode: 'serial' });

test('[FREE_TIER_CONCURRENCY]: preventing free tier envelope limit bypass via parallel requests', async ({
  request,
}) => {
  // Set DANGEROUS_BYPASS_RATE_LIMITS env variable temporarily in process to run limits checks if needed,
  // or verify that standard transaction serialization works under stress.
  const { user, team, organisation } = await seedUser();

  // 1. Force the organisation to Free tier subscription claim by updating its organisationClaim
  await prisma.organisationClaim.update({
    where: { id: organisation.organisationClaimId },
    data: {
      id: 'free',
    },
  });

  const { token } = await createApiToken({
    userId: user.id,
    teamId: team.id,
    tokenName: 'test-concurrency',
    expiresIn: null,
  });

  // 2. Mock existing envelopes to set the current monthly count to 4 (leaving only 1 remaining slot)
  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);

  // Seed 4 dummy completed or draft envelopes to consume the quota
  await prisma.envelope
    .createMany({
      data: Array.from({ length: 4 })
        .map((_, i) => ({
          id: `envelope_concurrency_mock_${i}_${Date.now()}`,
          secondaryId: `mock-id-${i}-${Date.now()}`,
          title: 'Mock Envelope',
          type: EnvelopeType.DOCUMENT,
          source: 'DOCUMENT',
          internalVersion: 2,
          userId: user.id,
          teamId: team.id,
          documentMetaId: 'mock-meta-id', // Wait, documentMeta is unique
          createdAt: currentMonthStart,
        }))
        .map((env, _i) => {
          // We will create them properly below to avoid FK violations if needed, or we can just seed real envelopes using direct database writes.
          return env;
        }),
    })
    .catch(async () => {
      // If createMany fails due to FK, let's create them sequentially with required child records
    });

  // To be safe, let's seed 4 genuine documents in the current month using Prisma
  for (let i = 0; i < 4; i++) {
    const meta = await prisma.documentMeta.create({
      data: {
        timezone: 'Etc/UTC',
      },
    });

    await prisma.envelope.create({
      data: {
        id: `concurrency_mock_${i}_${Date.now()}`,
        secondaryId: `mock-secondary-${i}-${Date.now()}`,
        title: `Mock Document ${i}`,
        type: EnvelopeType.DOCUMENT,
        source: 'DOCUMENT',
        internalVersion: 2,
        userId: user.id,
        teamId: team.id,
        documentMetaId: meta.id,
        createdAt: new Date(),
      },
    });
  }

  // 3. Initiate parallel requests simulating a single-packet concurrent attack
  const createPayload: TCreateEnvelopePayload = {
    type: EnvelopeType.DOCUMENT,
    title: '[CONCURRENCY TEST] Parallel Document',
    recipients: [
      {
        email: 'signer-concurrency@test.documenso.com',
        name: 'Signer Concurrency',
        role: RecipientRole.SIGNER,
      },
    ],
  };

  const executeRequest = async () => {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(createPayload));
    formData.append('files', new File([examplePdf], 'example.pdf', { type: 'application/pdf' }));

    return await request.post(`${baseUrl}/envelope/create`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: formData,
    });
  };

  // Trigger 5 concurrent envelope creation requests
  const results = await Promise.all([
    executeRequest(),
    executeRequest(),
    executeRequest(),
    executeRequest(),
    executeRequest(),
  ]);

  // 4. Assertions: exactly one request should succeed (200), and the others should be rejected (400 or 429)
  const successResponses = results.filter((res) => res.status() === 200);
  const rejectedResponses = results.filter((res) => res.status() === 400 || res.status() === 429);

  // Exactly 1 envelope must have been created, advancing count to the limit of 5.
  // The rest must be blocked by either the entry rate limit lock (429) or the row lock re-verification (400).
  expect(successResponses.length).toBe(1);
  expect(rejectedResponses.length).toBe(4);

  // Double check envelope count in DB for this organisation to be exactly 5
  const finalDbCount = await prisma.envelope.count({
    where: {
      type: EnvelopeType.DOCUMENT,
      team: {
        organisationId: organisation.id,
      },
      createdAt: {
        gte: currentMonthStart,
      },
    },
  });

  expect(finalDbCount).toBe(5);
});
