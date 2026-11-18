import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { addUserToOrganisation } from '@documenso/lib/server-only/organisation/accept-organisation-invitation';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { createTeamMembers } from '@documenso/trpc/server/team-router/create-team-members';
import { nanoid } from 'nanoid';

import { prisma } from '..';
import type { User } from '../client';
import {
  DocumentStatus,
  DocumentVisibility,
  EnvelopeType,
  OrganisationGroupType,
  OrganisationMemberRole,
  ReadStatus,
  SendStatus,
  SigningStatus,
  TeamMemberRole,
} from '../client';
import { seedBlankDocument } from './documents';
import { seedBlankTemplate } from './templates';

/**
 * One-off seed script: creates three teams with analytics-friendly data inside
 * the organisation owned by `admin@documenso.com` (created by `initial-seed.ts`).
 *
 * Run via:
 *   npm run with:env -- tsx packages/prisma/seed/analytics-seed.ts
 *
 * Produces (idempotent: an existing team with the same URL is deleted and recreated):
 *   - analytics-quiet   "Quiet Team"   2 members, 3 documents, no templates
 *   - analytics-steady  "Steady Team"  4 members, ~25 documents over 90 days, 2 templates
 *   - analytics-busy    "Busy Team"    8 members, ~180 documents over 12 months, 5 templates
 *
 * Definitions used by the analytics dashboard:
 *   - "sent"                  = a DOCUMENT_SENT audit log (one per non-DRAFT document)
 *   - "created"               = Envelope.createdAt
 *   - "created from template" = Envelope.templateId (numeric template id)
 *   - "members"               = organisation members attached to the team's role groups
 */

const ADMIN_EMAIL = 'admin@documenso.com';
const ADMIN_PASSWORD = 'password';
const MEMBER_EMAIL_DOMAIN = 'test.documenso.com';
const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL ?? 'http://localhost:49000';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const NOW = new Date();

// ---------------------------------------------------------------------------
// Deterministic pseudo random (LCG) so re-runs produce the same shape.
// ---------------------------------------------------------------------------

let seedState = 20260922;

const resetRandom = (seed: number) => {
  seedState = seed;
};

const rand = () => {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
};

const randInt = (minInclusive: number, maxInclusive: number) =>
  minInclusive + Math.floor(rand() * (maxInclusive - minInclusive + 1));

const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

const pickWeightedIndex = (weights: number[]): number => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = rand() * total;

  for (let i = 0; i < weights.length; i += 1) {
    cursor -= weights[i];

    if (cursor <= 0) {
      return i;
    }
  }

  return weights.length - 1;
};

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

const notInFuture = (date: Date) => (date.getTime() > NOW.getTime() ? new Date(NOW.getTime() - MINUTE_MS) : date);

/**
 * A timestamp `daysAgo` days back, at a random working hour (09:00-17:59 local).
 */
const atDaysAgo = (daysAgo: number) => {
  const date = new Date(NOW.getTime() - daysAgo * DAY_MS);
  date.setHours(randInt(9, 17), randInt(0, 59), randInt(0, 59), 0);

  return notInFuture(date);
};

const isWeekend = (daysAgo: number) => {
  const day = new Date(NOW.getTime() - daysAgo * DAY_MS).getDay();

  return day === 0 || day === 6;
};

// ---------------------------------------------------------------------------
// Static content
// ---------------------------------------------------------------------------

const DOCUMENT_TITLES = [
  'Master Services Agreement - Northwind',
  'NDA - Contoso Partnership',
  'Employment Offer - J. Alvarez',
  'SOW #14 - Platform Migration',
  'Vendor Agreement - Acme Logistics',
  'Lease Renewal - 12 Harbour St',
  'Consulting Agreement - Q3',
  'Data Processing Addendum - Fabrikam',
  'Contractor Agreement - M. Chen',
  'Purchase Order 2026-0917',
  'Reseller Agreement - Globex',
  'Board Resolution - September',
  'Equity Grant - S. Patel',
  'Sponsorship Agreement - DevConf',
  'Freelance Contract - Design Sprint',
  'Insurance Certificate - Fleet',
  'IP Assignment - Project Atlas',
  'Subscription Renewal - Initech',
  'Change Order #3 - Warehouse Fitout',
  'Referral Agreement - Umbrella Corp',
];

const RECIPIENT_NAMES = [
  'Ava Thompson',
  'Liam Okafor',
  'Sofia Martinez',
  'Noah Kimura',
  'Isabella Rossi',
  'Ethan Brooks',
  'Mia Johansson',
  'Lucas Ferreira',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberSpec = {
  name: string;
  role: TeamMemberRole;
};

type TemplateSpec = {
  title: string;
  usage: number;
};

type DocumentSpec = {
  daysAgo: number;
  status: DocumentStatus;
  senderIndex: number;
  visibility: DocumentVisibility;
  templateIndex?: number;
};

type TeamSpec = {
  url: string;
  name: string;
  members: MemberSpec[];
  templates: TemplateSpec[];
  buildDocuments: () => DocumentSpec[];
};

type SeededTeamSummary = {
  url: string;
  name: string;
  memberCount: number;
  templateCount: number;
  documentsByStatus: Record<string, number>;
  documentsByVisibility: Record<string, number>;
  documentsFromTemplates: number;
};

// ---------------------------------------------------------------------------
// Document spec builders
// ---------------------------------------------------------------------------

/**
 * Builds an exact status pool from ratios, then shuffles it so the statuses are
 * spread across the timeline rather than clustered.
 */
const buildStatusPool = (total: number, ratios: Partial<Record<DocumentStatus, number>>): DocumentStatus[] => {
  const entries = Object.entries(ratios) as [DocumentStatus, number][];
  const pool: DocumentStatus[] = [];

  for (const [status, ratio] of entries) {
    const count = Math.round(total * ratio);

    for (let i = 0; i < count; i += 1) {
      pool.push(status);
    }
  }

  // Round-off correction so the pool has exactly `total` entries.
  while (pool.length < total) {
    pool.push(DocumentStatus.COMPLETED);
  }

  while (pool.length > total) {
    pool.pop();
  }

  return shuffle(pool);
};

/**
 * Assigns template indexes to documents that are not drafts. Templates are
 * assigned in usage order so the ranking in the dashboard is stable.
 */
const assignTemplates = (specs: DocumentSpec[], templates: TemplateSpec[]) => {
  const candidates = shuffle(
    specs.map((_spec, index) => index).filter((index) => specs[index].status !== DocumentStatus.DRAFT),
  );

  let cursor = 0;

  templates.forEach((template, templateIndex) => {
    for (let i = 0; i < template.usage; i += 1) {
      const specIndex = candidates[cursor];

      if (specIndex === undefined) {
        throw new Error(`Not enough documents to satisfy template usage for "${template.title}"`);
      }

      specs[specIndex].templateIndex = templateIndex;
      cursor += 1;
    }
  });
};

/**
 * Assigns restricted visibilities to documents sent by the admin (sender index 0),
 * so managers cannot see them through the "owner" escape hatch.
 */
const assignVisibilities = (
  specs: DocumentSpec[],
  counts: { admin: number; managerAndAbove: number },
  adminSenderIndex: number,
) => {
  const candidates = shuffle(specs.map((_spec, index) => index));
  let assigned = { admin: 0, managerAndAbove: 0 };

  for (const specIndex of candidates) {
    if (assigned.admin >= counts.admin && assigned.managerAndAbove >= counts.managerAndAbove) {
      break;
    }

    const spec = specs[specIndex];

    if (assigned.admin < counts.admin) {
      spec.visibility = DocumentVisibility.ADMIN;
      spec.senderIndex = adminSenderIndex;
      assigned = { ...assigned, admin: assigned.admin + 1 };
      continue;
    }

    spec.visibility = DocumentVisibility.MANAGER_AND_ABOVE;
    spec.senderIndex = adminSenderIndex;
    assigned = { ...assigned, managerAndAbove: assigned.managerAndAbove + 1 };
  }
};

const buildQuietDocuments = (): DocumentSpec[] => [
  { daysAgo: 20, status: DocumentStatus.DRAFT, senderIndex: 0, visibility: DocumentVisibility.EVERYONE },
  { daysAgo: 45, status: DocumentStatus.DRAFT, senderIndex: 1, visibility: DocumentVisibility.EVERYONE },
  { daysAgo: 8, status: DocumentStatus.PENDING, senderIndex: 0, visibility: DocumentVisibility.EVERYONE },
];

const STEADY_TEMPLATES: TemplateSpec[] = [
  { title: 'Mutual NDA', usage: 4 },
  { title: 'Contractor Agreement', usage: 2 },
];

const buildSteadyDocuments = (): DocumentSpec[] => {
  // ~10 in the last 30 days, ~8 in days 30-59, ~7 in days 60-89 => 25 total.
  const dayBuckets: [number, number, number][] = [
    [0, 29, 10],
    [30, 59, 8],
    [60, 89, 7],
  ];

  const daysAgoList: number[] = [];

  for (const [from, to, count] of dayBuckets) {
    for (let i = 0; i < count; i += 1) {
      daysAgoList.push(randInt(from, to));
    }
  }

  const statuses = buildStatusPool(daysAgoList.length, {
    [DocumentStatus.COMPLETED]: 0.6,
    [DocumentStatus.PENDING]: 0.2,
    [DocumentStatus.DRAFT]: 0.1,
    [DocumentStatus.REJECTED]: 0.05,
    [DocumentStatus.CANCELLED]: 0.05,
  });

  // Senders: admin (0), manager (1) and one member (2).
  const specs: DocumentSpec[] = daysAgoList.map((daysAgo, index) => ({
    daysAgo,
    status: statuses[index],
    senderIndex: index % 3,
    visibility: DocumentVisibility.EVERYONE,
  }));

  assignTemplates(specs, STEADY_TEMPLATES);
  assignVisibilities(specs, { admin: 2, managerAndAbove: 2 }, 0);

  return specs;
};

const BUSY_TEMPLATES: TemplateSpec[] = [
  { title: 'Mutual NDA', usage: 40 },
  { title: 'Sales Order Form', usage: 25 },
  { title: 'Contractor Agreement', usage: 15 },
  { title: 'Offer Letter', usage: 8 },
  { title: 'Board Consent', usage: 3 },
];

const BUSY_DOCUMENT_COUNT = 180;
const BUSY_WINDOW_DAYS = 365;

const buildBusyDocuments = (): DocumentSpec[] => {
  // Weight each day so recent weekdays are far more likely than old weekend days.
  const weights = Array.from({ length: BUSY_WINDOW_DAYS }, (_, daysAgo) => {
    const recency = 1 - daysAgo / BUSY_WINDOW_DAYS;
    const trend = 0.3 + 1.7 * recency;
    const weekdayFactor = isWeekend(daysAgo) ? 0.2 : 1;

    return trend * weekdayFactor;
  });

  const daysAgoList = Array.from({ length: BUSY_DOCUMENT_COUNT }, () => pickWeightedIndex(weights));

  const statuses = buildStatusPool(daysAgoList.length, {
    [DocumentStatus.COMPLETED]: 0.7,
    [DocumentStatus.PENDING]: 0.15,
    [DocumentStatus.DRAFT]: 0.08,
    [DocumentStatus.REJECTED]: 0.04,
    [DocumentStatus.CANCELLED]: 0.03,
  });

  // Six senders out of eight members, with uneven volume.
  const senderWeights = [3, 5, 4, 2, 3, 1];

  const specs: DocumentSpec[] = daysAgoList.map((daysAgo, index) => ({
    daysAgo,
    status: statuses[index],
    senderIndex: pickWeightedIndex(senderWeights),
    visibility: DocumentVisibility.EVERYONE,
  }));

  assignTemplates(specs, BUSY_TEMPLATES);
  assignVisibilities(specs, { admin: 6, managerAndAbove: 0 }, 0);

  return specs;
};

// ---------------------------------------------------------------------------
// Team specs
// ---------------------------------------------------------------------------

const TEAM_SPECS: TeamSpec[] = [
  {
    url: 'analytics-quiet',
    name: 'Quiet Team',
    members: [{ name: 'Harper Quinn', role: TeamMemberRole.MEMBER }],
    templates: [],
    buildDocuments: buildQuietDocuments,
  },
  {
    url: 'analytics-steady',
    name: 'Steady Team',
    members: [
      { name: 'Marcus Lindqvist', role: TeamMemberRole.MANAGER },
      { name: 'Elena Rossi', role: TeamMemberRole.MEMBER },
      { name: 'Priya Natarajan', role: TeamMemberRole.MEMBER },
    ],
    templates: STEADY_TEMPLATES,
    buildDocuments: buildSteadyDocuments,
  },
  {
    url: 'analytics-busy',
    name: 'Busy Team',
    members: [
      { name: 'Jonas Weber', role: TeamMemberRole.ADMIN },
      { name: 'Amara Okonkwo', role: TeamMemberRole.MANAGER },
      { name: 'Diego Alvarez', role: TeamMemberRole.MEMBER },
      { name: 'Hana Sato', role: TeamMemberRole.MEMBER },
      { name: 'Oliver Bennett', role: TeamMemberRole.MEMBER },
      { name: 'Chloe Dubois', role: TeamMemberRole.MEMBER },
      { name: 'Ravi Menon', role: TeamMemberRole.MEMBER },
    ],
    templates: BUSY_TEMPLATES,
    buildDocuments: buildBusyDocuments,
  },
];

// ---------------------------------------------------------------------------
// Seeding helpers
// ---------------------------------------------------------------------------

const toEmailSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '.');

const getAdminUserAndOrganisation = async () => {
  const admin = await prisma.user.findFirst({
    where: {
      email: ADMIN_EMAIL,
    },
  });

  if (!admin) {
    throw new Error(`User ${ADMIN_EMAIL} not found. Run the initial seed first (npm run prisma:seed).`);
  }

  const organisation = await prisma.organisation.findFirst({
    where: {
      ownerUserId: admin.id,
    },
    include: {
      groups: true,
    },
  });

  if (!organisation) {
    throw new Error(`No organisation owned by ${ADMIN_EMAIL} was found.`);
  }

  return { admin, organisation };
};

/**
 * Deletes an existing team with the given URL (and its documents) so the seed can
 * recreate it from scratch. Mirrors the cleanup done by `deleteTeam`.
 */
const deleteExistingTeam = async (teamUrl: string, organisationId: string) => {
  const existingTeam = await prisma.team.findUnique({
    where: {
      url: teamUrl,
    },
    include: {
      teamGroups: {
        select: {
          organisationGroupId: true,
        },
      },
    },
  });

  if (!existingTeam) {
    return false;
  }

  if (existingTeam.organisationId !== organisationId) {
    throw new Error(`Team "${teamUrl}" exists but belongs to a different organisation. Aborting.`);
  }

  // Captured before the delete cascades the team groups away, so only the groups
  // that belonged to this team are considered for cleanup.
  const organisationGroupIds = existingTeam.teamGroups.map((teamGroup) => teamGroup.organisationGroupId);

  // Audit logs are only SetNull on envelope delete, so purge them explicitly.
  await prisma.documentAuditLog.deleteMany({
    where: {
      envelope: {
        teamId: existingTeam.id,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.team.delete({
      where: {
        id: existingTeam.id,
      },
    });

    await tx.organisationGroup.deleteMany({
      where: {
        id: {
          in: organisationGroupIds,
        },
        type: OrganisationGroupType.INTERNAL_TEAM,
        teamGroups: {
          none: {},
        },
      },
    });
  });

  return true;
};

/**
 * Finds or creates a user and makes sure they are an organisation member.
 * Returns the user and their organisation member id.
 */
const ensureOrganisationMember = async ({
  name,
  email,
  organisationId,
}: {
  name: string;
  email: string;
  organisationId: string;
}) => {
  let user = await prisma.user.findFirst({
    where: {
      email,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashSync(ADMIN_PASSWORD),
        emailVerified: new Date(),
      },
    });
  }

  let organisationMember = await prisma.organisationMember.findFirst({
    where: {
      userId: user.id,
      organisationId,
    },
  });

  if (!organisationMember) {
    const organisationGroups = await prisma.organisationGroup.findMany({
      where: {
        organisationId,
        type: OrganisationGroupType.INTERNAL_ORGANISATION,
      },
    });

    await addUserToOrganisation({
      userId: user.id,
      organisationId,
      organisationGroups,
      organisationMemberRole: OrganisationMemberRole.MEMBER,
      bypassEmail: true,
    });

    organisationMember = await prisma.organisationMember.findFirstOrThrow({
      where: {
        userId: user.id,
        organisationId,
      },
    });
  }

  return { user, organisationMemberId: organisationMember.id };
};

const seedDocument = async ({
  spec,
  index,
  teamId,
  senders,
  templateSecondaryIds,
}: {
  spec: DocumentSpec;
  index: number;
  teamId: number;
  senders: User[];
  templateSecondaryIds: string[];
}) => {
  const sender = senders[spec.senderIndex];

  if (!sender) {
    throw new Error(`Sender index ${spec.senderIndex} is out of range`);
  }

  const createdAt = atDaysAgo(spec.daysAgo);

  const baseTitle = DOCUMENT_TITLES[index % DOCUMENT_TITLES.length];
  const title =
    index >= DOCUMENT_TITLES.length ? `${baseTitle} (${Math.floor(index / DOCUMENT_TITLES.length) + 1})` : baseTitle;

  const isSent = spec.status !== DocumentStatus.DRAFT;
  const isCompleted = spec.status === DocumentStatus.COMPLETED;

  // Sent a few minutes to a couple of hours after creation.
  const sentAt = notInFuture(new Date(createdAt.getTime() + randInt(5, 180) * MINUTE_MS));

  // Completed 0.5-5 days after being sent.
  const completedAt = notInFuture(new Date(sentAt.getTime() + randInt(12, 120) * HOUR_MS));

  const templateSecondaryId = spec.templateIndex !== undefined ? templateSecondaryIds[spec.templateIndex] : undefined;

  const envelope = await seedBlankDocument(sender, teamId, {
    createDocumentOptions: {
      title,
      status: spec.status,
      visibility: spec.visibility,
      createdAt,
      updatedAt: isCompleted ? completedAt : isSent ? sentAt : createdAt,
      ...(isCompleted ? { completedAt } : {}),
      ...(templateSecondaryId ? { templateId: mapSecondaryIdToTemplateId(templateSecondaryId) } : {}),
    },
  });

  const recipientName = pick(RECIPIENT_NAMES);

  await prisma.recipient.create({
    data: {
      envelopeId: envelope.id,
      name: recipientName,
      email: `${toEmailSlug(recipientName)}@example.com`,
      token: nanoid(),
      sendStatus: isSent ? SendStatus.SENT : SendStatus.NOT_SENT,
      readStatus: isSent ? ReadStatus.OPENED : ReadStatus.NOT_OPENED,
      signingStatus: isCompleted ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
      signedAt: isCompleted ? completedAt : null,
    },
  });

  if (isSent) {
    await prisma.documentAuditLog.create({
      data: {
        envelopeId: envelope.id,
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
        createdAt: sentAt,
        userId: sender.id,
        email: sender.email,
        name: sender.name,
        data: {},
      },
    });
  }

  return envelope;
};

const seedAnalyticsTeam = async ({
  spec,
  admin,
  organisationId,
}: {
  spec: TeamSpec;
  admin: User;
  organisationId: string;
}): Promise<SeededTeamSummary> => {
  console.log('');
  console.log(`[SEEDING]: ${spec.name} (${spec.url})`);

  const wasDeleted = await deleteExistingTeam(spec.url, organisationId);

  if (wasDeleted) {
    console.log(`  Existing team "${spec.url}" deleted, recreating.`);
  } else {
    console.log(`  No existing team "${spec.url}", creating.`);
  }

  // inheritMembers: false attaches only the org admin/manager groups, so the admin
  // is a team ADMIN and every other member is attached explicitly below.
  await createTeam({
    userId: admin.id,
    teamName: spec.name,
    teamUrl: spec.url,
    organisationId,
    inheritMembers: false,
  });

  const team = await prisma.team.findUniqueOrThrow({
    where: {
      url: spec.url,
    },
  });

  const members: User[] = [];
  const membersToCreate: { organisationMemberId: string; teamRole: TeamMemberRole }[] = [];

  for (const memberSpec of spec.members) {
    const email = `${spec.url}-${toEmailSlug(memberSpec.name)}@${MEMBER_EMAIL_DOMAIN}`;

    const { user, organisationMemberId } = await ensureOrganisationMember({
      name: memberSpec.name,
      email,
      organisationId,
    });

    members.push(user);
    membersToCreate.push({ organisationMemberId, teamRole: memberSpec.role });
  }

  await createTeamMembers({
    userId: admin.id,
    teamId: team.id,
    membersToCreate,
  });

  console.log(`  Members attached: ${members.length + 1} (incl. admin)`);

  const templateSecondaryIds: string[] = [];

  for (const templateSpec of spec.templates) {
    const template = await seedBlankTemplate(admin, team.id, {
      createTemplateOptions: {
        title: templateSpec.title,
        createdAt: atDaysAgo(BUSY_WINDOW_DAYS + 10),
      },
    });

    templateSecondaryIds.push(template.secondaryId);
  }

  console.log(`  Templates created: ${templateSecondaryIds.length}`);

  const senders: User[] = [admin, ...members];
  const documentSpecs = spec.buildDocuments();

  let index = 0;

  for (const documentSpec of documentSpecs) {
    await seedDocument({ spec: documentSpec, index, teamId: team.id, senders, templateSecondaryIds });
    index += 1;
  }

  console.log(`  Documents created: ${documentSpecs.length}`);

  const documentsByStatus = documentSpecs.reduce<Record<string, number>>((acc, documentSpec) => {
    acc[documentSpec.status] = (acc[documentSpec.status] ?? 0) + 1;
    return acc;
  }, {});

  const documentsByVisibility = documentSpecs.reduce<Record<string, number>>((acc, documentSpec) => {
    acc[documentSpec.visibility] = (acc[documentSpec.visibility] ?? 0) + 1;
    return acc;
  }, {});

  const documentsFromTemplates = documentSpecs.filter(
    (documentSpec) => documentSpec.templateIndex !== undefined,
  ).length;

  return {
    url: team.url,
    name: team.name,
    memberCount: members.length + 1,
    templateCount: templateSecondaryIds.length,
    documentsByStatus,
    documentsByVisibility,
    documentsFromTemplates,
  };
};

/**
 * Re-queries the database so the printed summary reflects what was actually stored
 * rather than what the specs intended.
 */
const verifyTeam = async (teamUrl: string) => {
  const team = await prisma.team.findUniqueOrThrow({
    where: {
      url: teamUrl,
    },
  });

  const memberCount = await prisma.organisationMember.count({
    where: {
      organisationGroupMembers: {
        some: {
          group: {
            teamGroups: {
              some: {
                teamId: team.id,
              },
            },
          },
        },
      },
    },
  });

  const statusGroups = await prisma.envelope.groupBy({
    by: ['status'],
    where: {
      teamId: team.id,
      type: EnvelopeType.DOCUMENT,
    },
    _count: {
      _all: true,
    },
  });

  const templateCount = await prisma.envelope.count({
    where: {
      teamId: team.id,
      type: EnvelopeType.TEMPLATE,
    },
  });

  const sentLogCount = await prisma.documentAuditLog.count({
    where: {
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
      envelope: {
        teamId: team.id,
        type: EnvelopeType.DOCUMENT,
      },
    },
  });

  const fromTemplateCount = await prisma.envelope.count({
    where: {
      teamId: team.id,
      type: EnvelopeType.DOCUMENT,
      templateId: {
        not: null,
      },
    },
  });

  const last30Days = await prisma.envelope.count({
    where: {
      teamId: team.id,
      type: EnvelopeType.DOCUMENT,
      createdAt: {
        gte: new Date(NOW.getTime() - 30 * DAY_MS),
      },
    },
  });

  const last90Days = await prisma.envelope.count({
    where: {
      teamId: team.id,
      type: EnvelopeType.DOCUMENT,
      createdAt: {
        gte: new Date(NOW.getTime() - 90 * DAY_MS),
      },
    },
  });

  const byStatus = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all]));

  return {
    teamUrl,
    memberCount,
    templateCount,
    byStatus,
    totalDocuments: statusGroups.reduce((sum, group) => sum + group._count._all, 0),
    sentLogCount,
    fromTemplateCount,
    last30Days,
    last90Days,
  };
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const seedAnalytics = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The analytics seed deletes and recreates teams and must not run in production.');
  }

  const { admin, organisation } = await getAdminUserAndOrganisation();

  console.log(`[SEEDING]: Using organisation "${organisation.name}" (${organisation.url}) owned by ${admin.email}`);

  const summaries: SeededTeamSummary[] = [];

  for (const [index, spec] of TEAM_SPECS.entries()) {
    // Reset the generator per team so each team's shape is independent of the others.
    resetRandom(20260922 + index * 1000);

    summaries.push(await seedAnalyticsTeam({ spec, admin, organisationId: organisation.id }));
  }

  console.log('');
  console.log('[SEEDING]: Verification (queried from database)');

  for (const summary of summaries) {
    const verified = await verifyTeam(summary.url);

    console.log('');
    console.log(`  ${summary.name} - ${WEBAPP_URL}/t/${summary.url}/analytics`);
    console.log(`    Members:            ${verified.memberCount}`);
    console.log(`    Templates:          ${verified.templateCount}`);
    console.log(`    Documents:          ${verified.totalDocuments} ${JSON.stringify(verified.byStatus)}`);
    console.log(`    Visibility:         ${JSON.stringify(summary.documentsByVisibility)}`);
    console.log(`    DOCUMENT_SENT logs: ${verified.sentLogCount}`);
    console.log(`    From templates:     ${verified.fromTemplateCount}`);
    console.log(`    Created last 30d:   ${verified.last30Days}`);
    console.log(`    Created last 90d:   ${verified.last90Days}`);
  }

  console.log('');
  console.log('[SEEDING]: Done.');
  console.log(`  Admin email:    ${ADMIN_EMAIL}`);
  console.log(`  Admin password: ${ADMIN_PASSWORD}`);

  for (const summary of summaries) {
    console.log(`  ${WEBAPP_URL}/t/${summary.url}/analytics`);
  }
};

const main = async () => {
  try {
    await seedAnalytics();
  } catch (err) {
    console.error('[SEEDING]: Failed to seed analytics teams.');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  void main();
}
