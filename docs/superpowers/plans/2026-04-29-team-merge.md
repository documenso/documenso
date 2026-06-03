# Team Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Org admins can merge multiple teams into a destination team (existing or new), reparenting all documents and folders, consolidating members, and deleting the source teams.

**Architecture:** Single Prisma `$transaction` handles the merge atomically. A shared count-query helper is used by both the merge function (for return value) and the preview function (for impact summary). TRPC routes wrap the server functions with Zod-validated inputs and `MANAGE_ORGANISATION` permission checks. The UI adds checkbox selection to the existing teams table and a merge dialog.

**Tech Stack:** TypeScript, Prisma ORM, tRPC, Zod, React, Shadcn UI, Lingui i18n

**Spec:** `docs/superpowers/specs/2026-04-29-team-merge-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/lib/server-only/team/merge-teams.ts` | `mergeTeams()`, `mergeTeamsPreview()`, and shared `getMergeImpact()` count helper |
| `packages/lib/server-only/team/merge-teams.test.ts` | Unit tests for merge logic (mocked Prisma) |
| `packages/trpc/server/team-router/merge-teams.types.ts` | Zod schemas for both merge and preview request/response |
| `packages/trpc/server/team-router/merge-teams.ts` | TRPC mutation route for `team.merge` |
| `packages/trpc/server/team-router/merge-teams-preview.ts` | TRPC query route for `team.mergePreview` |
| `packages/trpc/server/team-router/router.ts` | Register `merge` and `mergePreview` on the team router |
| `apps/remix/app/components/dialogs/team-merge-dialog.tsx` | Merge dialog with destination picker, impact preview, confirmation |
| `apps/remix/app/components/tables/organisation-teams-table.tsx` | Add checkbox column and expose selection state |
| `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.teams.tsx` | Manage selection state, show merge button when 2+ selected |

---

### Task 1: Zod Schemas for Merge and Preview

**Files:**
- Create: `packages/trpc/server/team-router/merge-teams.types.ts`

- [ ] **Step 1: Create the types file with all schemas**

```ts
// ABOUTME: Zod request/response schemas for team merge and merge preview TRPC routes.
// ABOUTME: Shared by both merge and mergePreview procedures.

import { z } from 'zod';

import { ZTeamNameSchema, ZTeamUrlSchema } from './schema';

export const ZMergeTeamsPreviewRequestSchema = z.object({
  organisationId: z.string(),
  sourceTeamIds: z.array(z.number()).min(1),
  destinationTeamId: z.number().optional(),
});

export type TMergeTeamsPreviewRequest = z.infer<typeof ZMergeTeamsPreviewRequestSchema>;

export const ZMergeTeamsPreviewResponseSchema = z.object({
  moving: z.object({
    documents: z.number(),
    templates: z.number(),
    folders: z.number(),
    members: z.number(),
  }),
  discarding: z.object({
    webhooks: z.number(),
    apiTokens: z.number(),
    teamEmails: z.number(),
    teamSettings: z.number(),
  }),
});

export type TMergeTeamsPreviewResponse = z.infer<typeof ZMergeTeamsPreviewResponseSchema>;

export const ZMergeTeamsRequestSchema = z
  .object({
    organisationId: z.string(),
    sourceTeamIds: z.array(z.number()).min(1),
    destinationTeamId: z.number().optional(),
    newTeamName: ZTeamNameSchema.optional(),
    newTeamUrl: ZTeamUrlSchema.optional(),
  })
  .refine(
    (data) => data.destinationTeamId !== undefined || (data.newTeamName && data.newTeamUrl),
    { message: 'Either destinationTeamId or both newTeamName and newTeamUrl are required' },
  );

export type TMergeTeamsRequest = z.infer<typeof ZMergeTeamsRequestSchema>;

export const ZMergeTeamsResponseSchema = ZMergeTeamsPreviewResponseSchema;

export type TMergeTeamsResponse = z.infer<typeof ZMergeTeamsResponseSchema>;
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/HerberR_1/code/documenso && npx -p typescript tsc --noEmit --project packages/trpc/tsconfig.json 2>&1 | head -20`

Expected: No errors related to merge-teams.types.ts

- [ ] **Step 3: Commit**

```bash
git add packages/trpc/server/team-router/merge-teams.types.ts
git commit -m "feat(team-merge): add Zod schemas for merge and preview routes"
```

---

### Task 2: Server Function — Shared Count Helper and Preview

**Files:**
- Create: `packages/lib/server-only/team/merge-teams.ts`

- [ ] **Step 1: Write the test for getMergeImpact**

Create `packages/lib/server-only/team/merge-teams.test.ts`:

```ts
// ABOUTME: Unit tests for team merge server functions.
// ABOUTME: Tests cover impact counting, org validation, empty-source rejection, and merge transaction steps.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganisationGroupType } from '@prisma/client';

const mockPrisma = {
  team: {
    findMany: vi.fn(),
  },
  envelope: {
    count: vi.fn(),
  },
  folder: {
    count: vi.fn(),
  },
  teamGroup: {
    findMany: vi.fn(),
  },
  webhook: {
    count: vi.fn(),
  },
  apiToken: {
    count: vi.fn(),
  },
  teamEmail: {
    count: vi.fn(),
  },
  teamGlobalSettings: {
    count: vi.fn(),
  },
};

vi.mock('@documenso/prisma', () => ({
  prisma: mockPrisma,
}));

describe('getMergeImpact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return counts for all affected tables', async () => {
    const { getMergeImpact } = await import('./merge-teams');

    mockPrisma.envelope.count.mockResolvedValueOnce(10); // documents
    mockPrisma.envelope.count.mockResolvedValueOnce(3); // templates
    mockPrisma.folder.count.mockResolvedValue(5);
    mockPrisma.teamGroup.findMany.mockResolvedValue([
      { organisationGroupId: 'g1', organisationGroup: { type: OrganisationGroupType.INTERNAL_ORGANISATION } },
      { organisationGroupId: 'g2', organisationGroup: { type: OrganisationGroupType.INTERNAL_TEAM } },
    ]);
    mockPrisma.webhook.count.mockResolvedValue(2);
    mockPrisma.apiToken.count.mockResolvedValue(1);
    mockPrisma.teamEmail.count.mockResolvedValue(1);
    mockPrisma.teamGlobalSettings.count.mockResolvedValue(2);

    const result = await getMergeImpact(mockPrisma as any, [1, 2], 3);

    expect(result.moving.documents).toBe(10);
    expect(result.moving.templates).toBe(3);
    expect(result.moving.folders).toBe(5);
    expect(result.moving.members).toBe(1); // only non-INTERNAL_TEAM groups
    expect(result.discarding.webhooks).toBe(2);
    expect(result.discarding.apiTokens).toBe(1);
    expect(result.discarding.teamEmails).toBe(1);
    expect(result.discarding.teamSettings).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/team/merge-teams.test.ts 2>&1 | tail -10`

Expected: FAIL — `getMergeImpact` is not exported

- [ ] **Step 3: Implement getMergeImpact and mergeTeamsPreview**

Create `packages/lib/server-only/team/merge-teams.ts`:

```ts
// ABOUTME: Server-side logic for merging teams — transaction, preview, and shared count helper.
// ABOUTME: All team IDs are validated against the caller's org to prevent cross-org IDOR.

import {
  EnvelopeType,
  OrganisationGroupType,
  Prisma,
  TeamMemberRole,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { TEAM_INTERNAL_GROUPS } from '../../constants/teams';
import { generateDatabaseId } from '../../universal/id';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { generateDefaultTeamSettings } from '../../utils/teams';

import type { TMergeTeamsPreviewResponse } from '@documenso/trpc/server/team-router/merge-teams.types';

type PrismaClient = typeof prisma;
type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export const getMergeImpact = async (
  tx: PrismaTransaction,
  sourceTeamIds: number[],
  destinationTeamId?: number,
): Promise<TMergeTeamsPreviewResponse> => {
  const [documents, templates, folders, sourceGroups, webhooks, apiTokens, teamEmails, teamSettings] =
    await Promise.all([
      tx.envelope.count({
        where: { teamId: { in: sourceTeamIds }, type: EnvelopeType.DOCUMENT },
      }),
      tx.envelope.count({
        where: { teamId: { in: sourceTeamIds }, type: EnvelopeType.TEMPLATE },
      }),
      tx.folder.count({
        where: { teamId: { in: sourceTeamIds } },
      }),
      tx.teamGroup.findMany({
        where: { teamId: { in: sourceTeamIds } },
        select: { organisationGroupId: true, organisationGroup: { select: { type: true } } },
      }),
      tx.webhook.count({
        where: { teamId: { in: sourceTeamIds } },
      }),
      tx.apiToken.count({
        where: { teamId: { in: sourceTeamIds } },
      }),
      tx.teamEmail.count({
        where: { teamId: { in: sourceTeamIds } },
      }),
      tx.teamGlobalSettings.count({
        where: { team: { id: { in: sourceTeamIds } } },
      }),
    ]);

  const nonInternalGroups = sourceGroups.filter(
    (g) => g.organisationGroup.type !== OrganisationGroupType.INTERNAL_TEAM,
  );

  const uniqueOrgGroupIds = new Set(nonInternalGroups.map((g) => g.organisationGroupId));

  let existingDestGroupIds = new Set<string>();

  if (destinationTeamId) {
    const destGroups = await tx.teamGroup.findMany({
      where: { teamId: destinationTeamId },
      select: { organisationGroupId: true },
    });

    existingDestGroupIds = new Set(destGroups.map((g) => g.organisationGroupId));
  }

  const newMemberCount = [...uniqueOrgGroupIds].filter((id) => !existingDestGroupIds.has(id)).length;

  return {
    moving: {
      documents,
      templates,
      folders,
      members: newMemberCount,
    },
    discarding: {
      webhooks,
      apiTokens,
      teamEmails,
      teamSettings,
    },
  };
};

export type MergeTeamsPreviewOptions = {
  userId: number;
  organisationId: string;
  sourceTeamIds: number[];
  destinationTeamId?: number;
};

export const mergeTeamsPreview = async ({
  userId,
  organisationId,
  sourceTeamIds,
  destinationTeamId,
}: MergeTeamsPreviewOptions): Promise<TMergeTeamsPreviewResponse> => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You are not authorized to manage this organisation.',
    });
  }

  const sourceTeams = await prisma.team.findMany({
    where: { id: { in: sourceTeamIds }, organisationId },
    select: { id: true },
  });

  if (sourceTeams.length !== sourceTeamIds.length) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'One or more source teams do not belong to this organisation.',
    });
  }

  if (destinationTeamId) {
    const destTeam = await prisma.team.findFirst({
      where: { id: destinationTeamId, organisationId },
    });

    if (!destTeam) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Destination team does not belong to this organisation.',
      });
    }
  }

  const effectiveSourceIds = sourceTeamIds.filter((id) => id !== destinationTeamId);

  if (effectiveSourceIds.length === 0) {
    return {
      moving: { documents: 0, templates: 0, folders: 0, members: 0 },
      discarding: { webhooks: 0, apiTokens: 0, teamEmails: 0, teamSettings: 0 },
    };
  }

  return getMergeImpact(prisma, effectiveSourceIds, destinationTeamId);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/team/merge-teams.test.ts 2>&1 | tail -10`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/team/merge-teams.ts packages/lib/server-only/team/merge-teams.test.ts
git commit -m "feat(team-merge): add getMergeImpact helper and mergeTeamsPreview function"
```

---

### Task 3: Server Function — mergeTeams Transaction

**Files:**
- Modify: `packages/lib/server-only/team/merge-teams.ts`
- Modify: `packages/lib/server-only/team/merge-teams.test.ts`

- [ ] **Step 1: Write the test for mergeTeams**

Append to `merge-teams.test.ts`:

```ts
describe('mergeTeams', () => {
  const mockTx = {
    ...mockPrisma,
    team: {
      ...mockPrisma.team,
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    envelope: {
      ...mockPrisma.envelope,
      updateMany: vi.fn(),
    },
    folder: {
      ...mockPrisma.folder,
      updateMany: vi.fn(),
    },
    teamGroup: {
      ...mockPrisma.teamGroup,
      createMany: vi.fn(),
    },
    teamGlobalSettings: {
      ...mockPrisma.teamGlobalSettings,
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    organisationGroup: {
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn().mockImplementation((fn: any) => fn(mockTx)),
    organisation: {
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.mock('@documenso/prisma', () => ({
      prisma: mockTx,
    }));
  });

  it('should reject when source teams belong to different org', async () => {
    const { mergeTeams } = await import('./merge-teams');

    mockTx.organisation.findFirst.mockResolvedValue({ id: 'org_1' });
    mockTx.team.findMany.mockResolvedValue([{ id: 1 }]); // only 1 of 2 found

    await expect(
      mergeTeams({
        userId: 1,
        organisationId: 'org_1',
        sourceTeamIds: [1, 2],
        destinationTeamId: 3,
      }),
    ).rejects.toThrow('One or more source teams do not belong to this organisation');
  });

  it('should reject when all sources equal destination', async () => {
    const { mergeTeams } = await import('./merge-teams');

    mockTx.organisation.findFirst.mockResolvedValue({ id: 'org_1' });
    mockTx.team.findMany.mockResolvedValue([{ id: 5, organisationId: 'org_1', teamGlobalSettingsId: 'ts_1' }]);
    mockTx.team.findFirst.mockResolvedValue({ id: 5, organisationId: 'org_1' });

    await expect(
      mergeTeams({
        userId: 1,
        organisationId: 'org_1',
        sourceTeamIds: [5],
        destinationTeamId: 5,
      }),
    ).rejects.toThrow('No source teams remaining');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/team/merge-teams.test.ts 2>&1 | tail -10`

Expected: FAIL — `mergeTeams` is not exported

- [ ] **Step 3: Implement mergeTeams**

Append to `packages/lib/server-only/team/merge-teams.ts`:

```ts
export type MergeTeamsOptions = {
  userId: number;
  organisationId: string;
  sourceTeamIds: number[];
  destinationTeamId?: number;
  newTeamName?: string;
  newTeamUrl?: string;
};

export const mergeTeams = async ({
  userId,
  organisationId,
  sourceTeamIds,
  destinationTeamId,
  newTeamName,
  newTeamUrl,
}: MergeTeamsOptions): Promise<TMergeTeamsPreviewResponse> => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You are not authorized to manage this organisation.',
    });
  }

  return prisma.$transaction(
    async (tx) => {
      // Step 1: Validate org ownership of all source teams
      const sourceTeams = await tx.team.findMany({
        where: { id: { in: sourceTeamIds }, organisationId },
        select: { id: true, teamGlobalSettingsId: true },
      });

      if (sourceTeams.length !== sourceTeamIds.length) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'One or more source teams do not belong to this organisation.',
        });
      }

      // Resolve destination
      let destId = destinationTeamId;

      if (destId) {
        // Validate destination belongs to same org + lock for concurrent merge safety
        const destTeam = await tx.$queryRaw`
          SELECT id FROM "Team" WHERE id = ${destId} AND "organisationId" = ${organisationId} FOR UPDATE
        ` as { id: number }[];

        if (destTeam.length === 0) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Destination team does not belong to this organisation.',
          });
        }
      } else if (newTeamName && newTeamUrl) {
        // Step 3: Create new destination team
        const teamSettings = await tx.teamGlobalSettings.create({
          data: {
            ...generateDefaultTeamSettings(),
            defaultRecipients: Prisma.DbNull,
            id: generateDatabaseId('team_setting'),
          },
        });

        const newTeam = await tx.team.create({
          data: {
            name: newTeamName,
            url: newTeamUrl,
            organisationId,
            teamGlobalSettingsId: teamSettings.id,
          },
        });

        destId = newTeam.id;
      } else {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'Either destinationTeamId or both newTeamName and newTeamUrl are required.',
        });
      }

      // Step 2: Exclude destination from deletion list
      const teamsToDelete = sourceTeams.filter((t) => t.id !== destId);

      if (teamsToDelete.length === 0) {
        throw new AppError(AppErrorCode.INVALID_REQUEST, {
          message: 'No source teams remaining after excluding destination.',
        });
      }

      const sourceIds = teamsToDelete.map((t) => t.id);

      // Step 4: Pre-merge counts
      const impact = await getMergeImpact(tx, sourceIds, destId);

      // Step 5: Reparent envelopes
      await tx.envelope.updateMany({
        where: { teamId: { in: sourceIds } },
        data: { teamId: destId },
      });

      // Step 6: Reparent folders
      await tx.folder.updateMany({
        where: { teamId: { in: sourceIds } },
        data: { teamId: destId },
      });

      // Step 7: Consolidate members (upsert pattern)
      const sourceGroupLinks = await tx.teamGroup.findMany({
        where: { teamId: { in: sourceIds } },
        include: { organisationGroup: { select: { type: true } } },
      });

      const nonInternalLinks = sourceGroupLinks.filter(
        (g) => g.organisationGroup.type !== OrganisationGroupType.INTERNAL_TEAM,
      );

      const existingDestGroups = await tx.teamGroup.findMany({
        where: { teamId: destId },
        select: { organisationGroupId: true },
      });

      const existingOrgGroupIds = new Set(existingDestGroups.map((g) => g.organisationGroupId));

      const newGroupLinks = nonInternalLinks
        .filter((g) => !existingOrgGroupIds.has(g.organisationGroupId))
        .reduce(
          (acc, g) => {
            if (!acc.seen.has(g.organisationGroupId)) {
              acc.seen.add(g.organisationGroupId);
              acc.links.push({
                id: generateDatabaseId('team_group'),
                teamId: destId!,
                organisationGroupId: g.organisationGroupId,
                teamRole: TeamMemberRole.MEMBER,
              });
            }
            return acc;
          },
          { seen: new Set<string>(), links: [] as any[] },
        ).links;

      if (newGroupLinks.length > 0) {
        await tx.teamGroup.createMany({
          data: newGroupLinks,
          skipDuplicates: true,
        });
      }

      // Step 8: Collect settings IDs before deletion, then delete source teams
      const settingsIdsToDelete = teamsToDelete.map((t) => t.teamGlobalSettingsId);

      for (const team of teamsToDelete) {
        await tx.team.delete({ where: { id: team.id } });
      }

      // Explicitly delete orphaned TeamGlobalSettings
      await tx.teamGlobalSettings.deleteMany({
        where: { id: { in: settingsIdsToDelete } },
      });

      // Step 9: Clean up orphaned INTERNAL_TEAM OrganisationGroups
      await tx.organisationGroup.deleteMany({
        where: {
          type: OrganisationGroupType.INTERNAL_TEAM,
          teamGroups: { none: {} },
        },
      });

      // Step 10: Return impact counts
      return impact;
    },
    { timeout: 30000 },
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/team/merge-teams.test.ts 2>&1 | tail -15`

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/team/merge-teams.ts packages/lib/server-only/team/merge-teams.test.ts
git commit -m "feat(team-merge): add mergeTeams transaction with org validation and race safety"
```

---

### Task 4: TRPC Routes — Preview and Merge

**Files:**
- Create: `packages/trpc/server/team-router/merge-teams-preview.ts`
- Create: `packages/trpc/server/team-router/merge-teams.ts`
- Modify: `packages/trpc/server/team-router/router.ts`

- [ ] **Step 1: Create the preview route**

Create `packages/trpc/server/team-router/merge-teams-preview.ts`:

```ts
// ABOUTME: TRPC query route for team merge preview — returns impact counts without mutating.
// ABOUTME: Requires MANAGE_ORGANISATION permission.

import { mergeTeamsPreview } from '@documenso/lib/server-only/team/merge-teams';

import { authenticatedProcedure } from '../trpc';
import {
  ZMergeTeamsPreviewRequestSchema,
  ZMergeTeamsPreviewResponseSchema,
} from './merge-teams.types';

export const mergeTeamsPreviewRoute = authenticatedProcedure
  .input(ZMergeTeamsPreviewRequestSchema)
  .output(ZMergeTeamsPreviewResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, sourceTeamIds, destinationTeamId } = input;

    ctx.logger.info({
      input: { organisationId, sourceTeamIds, destinationTeamId },
    });

    return await mergeTeamsPreview({
      userId: ctx.user.id,
      organisationId,
      sourceTeamIds,
      destinationTeamId,
    });
  });
```

- [ ] **Step 2: Create the merge route**

Create `packages/trpc/server/team-router/merge-teams.ts`:

```ts
// ABOUTME: TRPC mutation route for team merge — merges source teams into a destination team.
// ABOUTME: Requires MANAGE_ORGANISATION permission. Destructive and irreversible.

import { mergeTeams } from '@documenso/lib/server-only/team/merge-teams';

import { authenticatedProcedure } from '../trpc';
import { ZMergeTeamsRequestSchema, ZMergeTeamsResponseSchema } from './merge-teams.types';

export const mergeTeamsRoute = authenticatedProcedure
  .input(ZMergeTeamsRequestSchema)
  .output(ZMergeTeamsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, sourceTeamIds, destinationTeamId, newTeamName, newTeamUrl } = input;

    ctx.logger.info({
      input: { organisationId, sourceTeamIds, destinationTeamId },
    });

    return await mergeTeams({
      userId: ctx.user.id,
      organisationId,
      sourceTeamIds,
      destinationTeamId,
      newTeamName,
      newTeamUrl,
    });
  });
```

- [ ] **Step 3: Register routes on the team router**

In `packages/trpc/server/team-router/router.ts`, add imports at the top:

```ts
import { mergeTeamsRoute } from './merge-teams';
import { mergeTeamsPreviewRoute } from './merge-teams-preview';
```

Add to the `teamRouter` object (after `delete: deleteTeamRoute`):

```ts
  merge: mergeTeamsRoute,
  mergePreview: mergeTeamsPreviewRoute,
```

- [ ] **Step 4: Verify types compile**

Run: `cd /Users/HerberR_1/code/documenso && npx -p typescript tsc --noEmit --project packages/trpc/tsconfig.json 2>&1 | head -20`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/trpc/server/team-router/merge-teams.ts packages/trpc/server/team-router/merge-teams-preview.ts packages/trpc/server/team-router/router.ts
git commit -m "feat(team-merge): add TRPC routes for merge and mergePreview"
```

---

### Task 5: UI — Add Checkbox Selection to Teams Table

**Files:**
- Modify: `apps/remix/app/components/tables/organisation-teams-table.tsx`
- Modify: `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.teams.tsx`

- [ ] **Step 1: Add selection props and checkbox column to the table**

In `apps/remix/app/components/tables/organisation-teams-table.tsx`:

Add to imports:

```ts
import { Checkbox } from '@documenso/ui/primitives/checkbox';
```

Change the component signature to accept selection props:

```ts
export type OrganisationTeamsTableProps = {
  selectedTeamIds?: Set<number>;
  onSelectionChange?: (teamIds: Set<number>) => void;
};

export const OrganisationTeamsTable = ({
  selectedTeamIds,
  onSelectionChange,
}: OrganisationTeamsTableProps) => {
```

Add a checkbox column as the first item in the `columns` array (inside `useMemo`):

```ts
    return [
      ...(onSelectionChange
        ? [
            {
              id: 'select',
              header: () => null,
              cell: ({ row }: { row: { original: { id: number } } }) => (
                <Checkbox
                  checked={selectedTeamIds?.has(row.original.id) ?? false}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedTeamIds);
                    if (checked) {
                      next.add(row.original.id);
                    } else {
                      next.delete(row.original.id);
                    }
                    onSelectionChange(next);
                  }}
                />
              ),
            } satisfies DataTableColumnDef<(typeof results)['data'][number]>,
          ]
        : []),
      {
        header: _(msg`Team`),
        // ... rest of existing columns
```

- [ ] **Step 2: Add selection state and merge button to the settings page**

In `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.teams.tsx`:

Add imports:

```ts
import { Trans } from '@lingui/react/macro';
import { Button } from '@documenso/ui/primitives/button';
import { TeamMergeDialog } from '~/components/dialogs/team-merge-dialog';
```

Add state inside the component:

```ts
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<number>>(new Set());
```

Add merge button and dialog between the `<Input>` and `<OrganisationTeamsTable>`:

```tsx
      {selectedTeamIds.size >= 2 && (
        <div className="mb-4 flex items-center gap-2">
          <TeamMergeDialog
            sourceTeamIds={[...selectedTeamIds]}
            onMerged={() => setSelectedTeamIds(new Set())}
          />
          <span className="text-sm text-muted-foreground">
            {selectedTeamIds.size} <Trans>teams selected</Trans>
          </span>
        </div>
      )}

      <OrganisationTeamsTable
        selectedTeamIds={selectedTeamIds}
        onSelectionChange={setSelectedTeamIds}
      />
```

- [ ] **Step 3: Commit**

```bash
git add apps/remix/app/components/tables/organisation-teams-table.tsx apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.teams.tsx
git commit -m "feat(team-merge): add checkbox selection to teams table and merge button"
```

---

### Task 6: UI — Team Merge Dialog

**Files:**
- Create: `apps/remix/app/components/dialogs/team-merge-dialog.tsx`

- [ ] **Step 1: Create the merge dialog component**

Create `apps/remix/app/components/dialogs/team-merge-dialog.tsx`:

```tsx
// ABOUTME: Dialog for merging teams — destination picker, impact preview, confirmation input.
// ABOUTME: Opened when 2+ teams are selected on the org teams settings page.

import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type TeamMergeDialogProps = {
  sourceTeamIds: number[];
  onMerged?: () => void;
};

const CREATE_NEW_VALUE = '__create_new__';

export const TeamMergeDialog = ({ sourceTeamIds, onMerged }: TeamMergeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [destinationValue, setDestinationValue] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamUrl, setNewTeamUrl] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();
  const organisation = useCurrentOrganisation();

  const sourceSet = useMemo(() => new Set(sourceTeamIds), [sourceTeamIds]);

  const availableDestinations = useMemo(
    () => organisation.teams.filter((t) => !sourceSet.has(t.id)),
    [organisation.teams, sourceSet],
  );

  const isCreatingNew = destinationValue === CREATE_NEW_VALUE;
  const destinationTeamId = !isCreatingNew && destinationValue ? parseInt(destinationValue, 10) : undefined;

  const destinationName = isCreatingNew
    ? newTeamName
    : organisation.teams.find((t) => t.id === destinationTeamId)?.name ?? '';

  const confirmationMatch = confirmText === destinationName && destinationName.length > 0;

  const previewQuery = trpc.team.mergePreview.useQuery(
    {
      organisationId: organisation.id,
      sourceTeamIds,
      destinationTeamId,
    },
    {
      enabled: open && sourceTeamIds.length > 0 && (!!destinationTeamId || isCreatingNew),
    },
  );

  const { mutateAsync: mergeTeamsMutation, isPending } = trpc.team.merge.useMutation();

  const onSubmit = async () => {
    try {
      await mergeTeamsMutation({
        organisationId: organisation.id,
        sourceTeamIds,
        destinationTeamId: destinationTeamId,
        newTeamName: isCreatingNew ? newTeamName : undefined,
        newTeamUrl: isCreatingNew ? newTeamUrl : undefined,
      });

      await refreshSession();

      toast({
        title: _(msg`Teams merged`),
        description: _(msg`Teams have been merged successfully.`),
        duration: 5000,
      });

      setOpen(false);
      onMerged?.();
    } catch (err) {
      const error = AppError.parseError(err);

      toast({
        title: _(msg`Failed to merge teams`),
        description: error.message || _(msg`An unknown error occurred.`),
        variant: 'destructive',
        duration: 10000,
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setDestinationValue('');
      setNewTeamName('');
      setNewTeamUrl('');
      setConfirmText('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && setOpen(value)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trans>Merge Teams</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Trans>Merge Teams</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Merge {sourceTeamIds.length} selected teams into a destination team.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col space-y-4" disabled={isPending}>
          <div>
            <Label>
              <Trans>Destination team</Trans>
            </Label>
            <Select value={destinationValue} onValueChange={setDestinationValue}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={_(msg`Select destination...`)} />
              </SelectTrigger>
              <SelectContent>
                {availableDestinations.map((team) => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
                <SelectItem value={CREATE_NEW_VALUE}>
                  <Trans>+ Create new team</Trans>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCreatingNew && (
            <div className="space-y-3">
              <div>
                <Label><Trans>Team name</Trans></Label>
                <Input
                  className="mt-1"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={_(msg`New team name`)}
                />
              </div>
              <div>
                <Label><Trans>Team URL</Trans></Label>
                <Input
                  className="mt-1"
                  value={newTeamUrl}
                  onChange={(e) => setNewTeamUrl(e.target.value)}
                  placeholder={_(msg`new-team-url`)}
                />
              </div>
            </div>
          )}

          {previewQuery.data && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium"><Trans>Impact summary</Trans></p>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground"><Trans>Documents</Trans></span>
                <span>{previewQuery.data.moving.documents}</span>
                <span className="text-muted-foreground"><Trans>Templates</Trans></span>
                <span>{previewQuery.data.moving.templates}</span>
                <span className="text-muted-foreground"><Trans>Folders</Trans></span>
                <span>{previewQuery.data.moving.folders}</span>
                <span className="text-muted-foreground"><Trans>Members</Trans></span>
                <span>{previewQuery.data.moving.members}</span>
              </div>
              {(previewQuery.data.discarding.webhooks > 0 ||
                previewQuery.data.discarding.apiTokens > 0 ||
                previewQuery.data.discarding.teamEmails > 0) && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <p className="col-span-2 font-medium text-destructive"><Trans>Will be discarded</Trans></p>
                  {previewQuery.data.discarding.webhooks > 0 && (
                    <>
                      <span className="text-muted-foreground"><Trans>Webhooks</Trans></span>
                      <span>{previewQuery.data.discarding.webhooks}</span>
                    </>
                  )}
                  {previewQuery.data.discarding.apiTokens > 0 && (
                    <>
                      <span className="text-muted-foreground"><Trans>API tokens</Trans></span>
                      <span>{previewQuery.data.discarding.apiTokens}</span>
                    </>
                  )}
                  {previewQuery.data.discarding.teamEmails > 0 && (
                    <>
                      <span className="text-muted-foreground"><Trans>Team emails</Trans></span>
                      <span>{previewQuery.data.discarding.teamEmails}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <Alert variant="destructive">
            <AlertDescription>
              <Trans>
                This action cannot be undone. All documents, templates, and folders from the
                selected teams will be moved to the destination team. Source team webhooks, API
                tokens, email configurations, and settings will be permanently deleted. Source
                teams will be removed.
              </Trans>
            </AlertDescription>
          </Alert>

          <div>
            <Label>
              <Trans>
                Type <span className="font-semibold text-destructive">{destinationName}</span> to
                confirm
              </Trans>
            </Label>
            <Input
              className="mt-1"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={destinationName}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="destructive"
              loading={isPending}
              disabled={!confirmationMatch || isPending}
              onClick={onSubmit}
            >
              <Trans>Merge Teams</Trans>
            </Button>
          </DialogFooter>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/HerberR_1/code/documenso && npx -p typescript tsc --noEmit --project apps/remix/tsconfig.json 2>&1 | head -20`

Expected: No errors related to team-merge-dialog.tsx

- [ ] **Step 3: Commit**

```bash
git add apps/remix/app/components/dialogs/team-merge-dialog.tsx
git commit -m "feat(team-merge): add TeamMergeDialog component with preview and confirmation"
```

---

### Task 7: Manual QA — Start Dev Server and Test

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/HerberR_1/code/documenso && bun run dev`

- [ ] **Step 2: Navigate to org teams settings**

Open browser to `http://localhost:3000/o/psd401/settings/teams`

Verify:
- Checkbox column appears on each team row
- Selecting 2+ teams shows the "Merge Teams" button with count badge
- Selecting fewer than 2 hides the button

- [ ] **Step 3: Test merge dialog flow**

Click "Merge Teams" button. Verify:
- Dialog opens with destination dropdown
- Dropdown lists teams NOT in selection, plus "Create new team"
- Selecting a destination shows impact preview counts
- Warning banner is visible
- Confirmation input requires exact destination name match
- "Merge Teams" button is disabled until confirmation matches

- [ ] **Step 4: Test merge execution**

Create 2-3 test teams, add a document to one. Merge them. Verify:
- Source teams disappear from the table
- Documents appear under the destination team
- Toast confirms success
- Page refreshes to show updated team list

- [ ] **Step 5: Test edge cases**

- Select a team as both source and destination → should work (destination absorbs others)
- Merge empty teams → should succeed with 0 counts
- "Create new team" flow → verify new team created and populated

---

### Task 8: Final Commit — All Files Together

- [ ] **Step 1: Run type check on full project**

Run: `cd /Users/HerberR_1/code/documenso && npx -p typescript tsc --noEmit 2>&1 | tail -20`

Expected: No errors

- [ ] **Step 2: Run all tests**

Run: `cd /Users/HerberR_1/code/documenso && npx vitest run packages/lib/server-only/team/merge-teams.test.ts 2>&1 | tail -15`

Expected: All tests PASS

- [ ] **Step 3: Verify git status is clean**

Run: `git status`

Expected: All changes committed across Tasks 1-6
