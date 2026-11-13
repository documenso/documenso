import { hashSync } from '@documenso/lib/server-only/auth/hash';
import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { createTeam } from '@documenso/lib/server-only/team/create-team';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { createTeamMembers } from '@documenso/trpc/server/team-router/create-team-members';
import type { Prisma, User } from '@prisma/client';
import {
  DocumentStatus,
  OrganisationMemberRole,
  OrganisationType,
  ReadStatus,
  SendStatus,
  SigningStatus,
  SubscriptionStatus,
  TeamMemberRole,
} from '@prisma/client';

import { prisma } from '..';
import { seedBlankDocument } from './documents';
import { seedOrganisationMembers } from './organisations';

/**
 * One-off seed script: organisations that stress the admin organisation page.
 *
 * Run via:
 *   npm run with:env -- tsx packages/prisma/seed/admin-organisation-seed.ts
 *
 * Replaces on every run:
 *   - Hartwell & Brandt: 47 of 50 members, 14 of 15 teams, about 400 documents,
 *     document quota near its limit, email quota exceeded
 *   - Marlow Freight: past its member and document limits, emails blocked,
 *     subscription past due
 *   - Tideline Studio: one member, one team, no documents, no usage
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const seedAdminOrganisations = async () => {
  await deleteSeededOrganisations();

  for (const spec of ORGANISATIONS) {
    const organisationId = await seedOrganisation(spec);

    console.log(`[SEEDING]: ${spec.name}`);
    console.log(`  Admin page:  /admin/organisations/${organisationId}`);
    console.log(`  Owner login: ${toEmail(spec.owner, spec)} / password`);
  }
};

const seedOrganisation = async (spec: OrganisationSpec) => {
  const createdAt = new Date(Date.now() - spec.ageInDays * DAY_MS);
  const customerId = `cus_seed_${spec.url}`;

  const owner = await prisma.user.create({
    data: {
      name: spec.owner.name,
      email: toEmail(spec.owner, spec),
      password: hashSync('password'),
      emailVerified: createdAt,
      createdAt,
    },
  });

  const organisation = await createOrganisation({
    name: spec.name,
    url: spec.url,
    type: OrganisationType.ORGANISATION,
    userId: owner.id,
    customerId: spec.subscriptionStatus ? customerId : undefined,
    claim: await prisma.subscriptionClaim.findUniqueOrThrow({ where: { id: spec.claimId } }),
  });

  await prisma.organisation.update({
    where: { id: organisation.id },
    data: {
      createdAt,
      members: { updateMany: { where: { userId: owner.id }, data: { createdAt } } },
      organisationClaim: { update: spec.claim },
      subscription: spec.subscriptionStatus
        ? {
            create: {
              status: spec.subscriptionStatus,
              planId: `sub_seed_${spec.url}`,
              priceId: 'price_seed',
              customerId,
              periodEnd: new Date(Date.now() + 19 * DAY_MS),
            },
          }
        : undefined,
    },
  });

  const memberUsers = await seedOrganisationMembers({
    organisationId: organisation.id,
    members: spec.members.map((member) => ({
      name: member.name ?? undefined,
      email: toEmail(member, spec),
      organisationRole: member.role,
    })),
  });

  // Members join at an even pace between the organisation's creation and today.
  for (const [index, user] of memberUsers.entries()) {
    const joinedAt = new Date(
      createdAt.getTime() + ((index + 1) / (memberUsers.length + 1)) * (Date.now() - createdAt.getTime()),
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { name: spec.members[index].name, createdAt: joinedAt },
    });

    await prisma.organisationMember.updateMany({
      where: { userId: user.id, organisationId: organisation.id },
      data: { createdAt: joinedAt },
    });
  }

  // Organisation admins and managers already sit in every team, so only plain members are attached to teams.
  const plainMembers = await prisma.organisationMember.findMany({
    where: {
      organisationId: organisation.id,
      userId: {
        in: memberUsers
          .filter((_, index) => spec.members[index].role === OrganisationMemberRole.MEMBER)
          .map((user) => user.id),
      },
    },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });

  const teams: SeededTeam[] = [];

  for (const [index, teamSpec] of spec.teams.entries()) {
    await createTeam({
      userId: owner.id,
      teamName: teamSpec.name,
      teamUrl: teamSpec.url,
      organisationId: organisation.id,
      inheritMembers: false,
    });

    const team = await prisma.team.update({
      where: { url: teamSpec.url },
      data: { createdAt: new Date(createdAt.getTime() + index * 9 * DAY_MS) },
    });

    // Each team takes a window of the member list, offset per team, so memberships overlap.
    const teamMembers = Array.from(
      { length: Math.min(teamSpec.memberCount, plainMembers.length) },
      (_, offset) => plainMembers[(index * 5 + offset) % plainMembers.length],
    );

    if (teamMembers.length > 0) {
      await createTeamMembers({
        userId: owner.id,
        teamId: team.id,
        membersToCreate: teamMembers.map((member) => ({
          organisationMemberId: member.id,
          teamRole: TeamMemberRole.MEMBER,
        })),
      });
    }

    teams.push({
      ...teamSpec,
      id: team.id,
      senders: teamMembers.length > 0 ? teamMembers.map((member) => member.user) : [owner],
    });
  }

  await seedDocuments({ spec, organisationId: organisation.id, teams });

  return organisation.id;
};

const seedDocuments = async ({
  spec,
  organisationId,
  teams,
}: {
  spec: OrganisationSpec;
  organisationId: string;
  teams: SeededTeam[];
}) => {
  const now = new Date();
  const teamWeights = teams.map((team) => team.documentShare);

  for (const [monthsAgo, volume] of spec.monthlyDocuments.entries()) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
    const monthEnd =
      monthsAgo === 0 ? now : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1));

    const createdAts = Array.from(
      { length: volume },
      () => new Date(monthStart.getTime() + rand() * (monthEnd.getTime() - monthStart.getTime())),
    ).sort((a, b) => b.getTime() - a.getTime());

    for (const [index, createdAt] of createdAts.entries()) {
      const team = teams[pickWeightedIndex(teamWeights)];

      // The newest documents carry the worst-case titles so they land on the first page of every list.
      const worstCaseTitle = monthsAgo === 0 ? spec.newestTitles[index] : undefined;

      await seedDocument({
        team,
        createdAt,
        title: worstCaseTitle ?? fillTitle(pick(team.titles)),
      });
    }

    await prisma.organisationMonthlyStat.create({
      data: {
        id: generateDatabaseId('org_monthly_stat'),
        organisationId,
        period: monthStart.toISOString().slice(0, 7),
        documentCount: volume,
        emailCount: Math.round(volume * spec.emailsPerDocument),
        apiCount: volume * spec.apiCallsPerDocument,
        emailReports: monthsAgo === 0 ? 2 : 0,
      },
    });
  }
};

const seedDocument = async ({ team, createdAt, title }: { team: SeededTeam; createdAt: Date; title: string }) => {
  const sender = pick(team.senders);
  const status = pickStatus((Date.now() - createdAt.getTime()) / DAY_MS);

  const isSent = status !== DocumentStatus.DRAFT;
  const isCompleted = status === DocumentStatus.COMPLETED;

  const completedAt = isCompleted
    ? new Date(Math.min(Date.now(), createdAt.getTime() + (0.2 + rand() * 6) * DAY_MS))
    : null;

  const envelope = await seedBlankDocument(sender, team.id, {
    createDocumentOptions: {
      title,
      status,
      createdAt,
      updatedAt: completedAt ?? createdAt,
      completedAt,
    },
  });

  await prisma.envelopeItem.updateMany({
    where: { envelopeId: envelope.id },
    data: { title },
  });

  const recipients = [...pickSome(RECIPIENTS, 1 + Math.floor(rand() * 3))];

  // Some documents are countersigned in-house, which gives members a signed document count.
  if (rand() < 0.2) {
    const cosigner = pick(team.senders);

    recipients.push({ name: cosigner.name ?? '', email: cosigner.email });
  }

  await prisma.recipient.createMany({
    data: recipients.map((recipient, index): Prisma.RecipientCreateManyInput => {
      const hasSigned = isCompleted || (status === DocumentStatus.PENDING && index > 0);
      const hasRejected = status === DocumentStatus.REJECTED && index === 0;

      return {
        envelopeId: envelope.id,
        name: recipient.name,
        email: recipient.email,
        token: nanoid(),
        sendStatus: isSent ? SendStatus.SENT : SendStatus.NOT_SENT,
        readStatus: isSent ? ReadStatus.OPENED : ReadStatus.NOT_OPENED,
        signingStatus: hasSigned
          ? SigningStatus.SIGNED
          : hasRejected
            ? SigningStatus.REJECTED
            : SigningStatus.NOT_SIGNED,
        signedAt: hasSigned ? (completedAt ?? createdAt) : null,
        rejectionReason: hasRejected ? 'The rate in clause 4 does not match the agreed quote.' : null,
      };
    }),
  });
};

const deleteSeededOrganisations = async () => {
  const organisations = await prisma.organisation.findMany({
    where: { url: { in: ORGANISATIONS.map((spec) => spec.url) } },
    include: {
      teams: {
        include: { envelopes: { select: { id: true, documentMetaId: true } } },
      },
    },
  });

  const teams = organisations.flatMap((organisation) => organisation.teams);
  const envelopes = teams.flatMap((team) => team.envelopes);

  // Document data, document meta and the settings rows do not cascade from the organisation.
  await prisma.documentData.deleteMany({
    where: { envelopeItem: { envelopeId: { in: envelopes.map((envelope) => envelope.id) } } },
  });

  await prisma.organisation.deleteMany({
    where: { id: { in: organisations.map((organisation) => organisation.id) } },
  });

  await prisma.documentMeta.deleteMany({
    where: { id: { in: envelopes.map((envelope) => envelope.documentMetaId) } },
  });

  await prisma.teamGlobalSettings.deleteMany({
    where: { id: { in: teams.map((team) => team.teamGlobalSettingsId) } },
  });

  await prisma.organisationClaim.deleteMany({
    where: { id: { in: organisations.map((organisation) => organisation.organisationClaimId) } },
  });

  await prisma.organisationGlobalSettings.deleteMany({
    where: { id: { in: organisations.map((organisation) => organisation.organisationGlobalSettingsId) } },
  });

  await prisma.organisationAuthenticationPortal.deleteMany({
    where: { id: { in: organisations.map((organisation) => organisation.organisationAuthenticationPortalId) } },
  });

  await prisma.user.deleteMany({
    where: { OR: ORGANISATIONS.map((spec) => ({ email: { endsWith: `@${spec.emailDomain}` } })) },
  });
};

const pickStatus = (ageInDays: number): DocumentStatus => {
  const roll = rand();

  // Recent documents are mostly still in flight. Older ones have settled, apart from a few stuck ones.
  if (ageInDays < 14) {
    if (roll < 0.34) {
      return DocumentStatus.COMPLETED;
    }

    if (roll < 0.74) {
      return DocumentStatus.PENDING;
    }

    return roll < 0.96 ? DocumentStatus.DRAFT : DocumentStatus.REJECTED;
  }

  if (roll < 0.8) {
    return DocumentStatus.COMPLETED;
  }

  if (roll < 0.89) {
    return DocumentStatus.PENDING;
  }

  if (roll < 0.93) {
    return DocumentStatus.DRAFT;
  }

  return roll < 0.98 ? DocumentStatus.REJECTED : DocumentStatus.CANCELLED;
};

const fillTitle = (template: string) =>
  template
    .replace('{party}', () => pick(COUNTERPARTIES))
    .replace('{vessel}', () => pick(VESSELS))
    .replace('{person}', () => pick(RECIPIENTS).name)
    .replace('{n}', () => String(1000 + Math.floor(rand() * 9000)));

const toEmail = (member: MemberSpec, spec: OrganisationSpec) => {
  const localPart =
    member.localPart ??
    (member.name ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.');

  return `${localPart}@${spec.emailDomain}`;
};

// A fixed-seed generator (mulberry32) keeps every run identical.
let randomState = 20261111;

const rand = () => {
  randomState = (randomState + 0x6d2b79f5) | 0;

  let t = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];

const pickSome = <T>(items: readonly T[], count: number): T[] => {
  const start = Math.floor(rand() * items.length);

  return Array.from({ length: count }, (_, offset) => items[(start + offset) % items.length]);
};

const pickWeightedIndex = (weights: number[]) => {
  let roll = rand() * weights.reduce((sum, weight) => sum + weight, 0);

  return weights.findIndex((weight) => {
    roll -= weight;

    return roll < 0;
  });
};

const newMember = (
  name: string,
  role: OrganisationMemberRole = OrganisationMemberRole.MEMBER,
  localPart?: string,
): MemberSpec => ({ name, role, localPart });

const COUNTERPARTIES = [
  'Kessler Shipyards GmbH',
  'Aldgate Marine Underwriters',
  'Pacific Rim Bunkering Pte. Ltd.',
  'Oyelaran & Sons Stevedoring',
  'Nordhavn Container Terminals A/S',
  'Santos Dry Bulk Ltda.',
  'Whitcombe Fuel Services',
  'Meridian Freight Systems',
];

const VESSELS = ['MV Northern Light', 'MV Clara Brandt', 'MT Hartwell Spirit', 'MV Baltic Heron', 'MV Tamarind'];

const RECIPIENTS = [
  { name: 'Ingrid Solheim', email: 'ingrid.solheim@nordhavn-terminals.example' },
  { name: 'Tomás Figueroa', email: 'tomas.figueroa@santosdrybulk.example' },
  { name: 'Adaeze Oyelaran', email: 'adaeze@oyelaran-stevedoring.example' },
  { name: 'Lukas Kessler', email: 'l.kessler@kessler-shipyards.example' },
  { name: 'Mei-Ling Tan', email: 'meiling.tan@pacificrim-bunkering.example' },
  { name: 'Graham Whitcombe', email: 'graham@whitcombefuel.example' },
  { name: 'Sofia Lindqvist', email: 'sofia.lindqvist@aldgate-marine.example' },
  { name: 'Rahul Deshpande', email: 'rahul.deshpande@meridianfreight.example' },
];

const HARTWELL_MEMBERS: MemberSpec[] = [
  newMember('Dmitri Vasilenko', OrganisationMemberRole.ADMIN),
  newMember('Chloé Marchetti', OrganisationMemberRole.ADMIN),
  newMember('Oluwaseun Adebayo', OrganisationMemberRole.MANAGER),
  newMember('Hannah Brandt', OrganisationMemberRole.MANAGER),
  newMember('Kenji Watanabe', OrganisationMemberRole.MANAGER),
  newMember('Fatima Al-Sayed', OrganisationMemberRole.MANAGER),
  newMember('Rosalind Achterberg', OrganisationMemberRole.MANAGER),
  newMember('Q'),
  newMember(
    'Maximilian Alexander Ferdinand von Hohenzollern-Sigmaringen',
    OrganisationMemberRole.MEMBER,
    'maximilian.alexander.von.hohenzollern-sigmaringen',
  ),
  newMember('王芳', OrganisationMemberRole.MEMBER, 'wang.fang'),
  newMember('محمد الفارسي', OrganisationMemberRole.MEMBER, 'm.alfarsi'),
  { name: null, role: OrganisationMemberRole.MEMBER, localPart: 'accounts-payable' },
  ...[
    'Anneke de Vries',
    'Babajide Okafor',
    'Carmen Ruiz',
    'Declan Murphy',
    'Elif Demirtaş',
    'Freya Johansson',
    'Gustavo Pereira',
    'Hyun-woo Park',
    'Isabella Conti',
    'Jarrah Thompson',
    'Katarzyna Nowak',
    'Liam Fitzgerald',
    'Mariam Haddad',
    'Nikolai Petrov',
    'Ottilie Baumann',
    'Pablo Méndez',
    'Quentin Lefèvre',
    'Rania Khoury',
    'Sione Tuilagi',
    'Thandiwe Nkosi',
    'Ulrich Steiner',
    'Valentina Greco',
    'Wiremu Parata',
    'Xiomara Delgado',
    'Yusuf Demir',
    'Zofia Kowalczyk',
    'Arjun Malhotra',
    'Beatriz Carvalho',
    'Cormac Ó Briain',
    'Daphne Papadakis',
    'Emeka Nwosu',
    'Fenella Hargreaves',
    'Giorgos Antoniou',
    'Hemi Walker',
  ].map((name) => newMember(name)),
];

const ORGANISATIONS: OrganisationSpec[] = [
  {
    name: 'Hartwell & Brandt Maritime Logistics Group',
    url: 'hartwell-brandt',
    emailDomain: 'hartwell-brandt.example',
    ageInDays: 610,
    claimId: INTERNAL_CLAIM_ID.TEAM,
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    claim: {
      memberCount: 50,
      teamCount: 15,
      documentQuota: 75,
      emailQuota: 200,
      apiQuota: null,
      documentRateLimits: [{ window: '1h', max: 40 }],
      emailRateLimits: [
        { window: '1h', max: 120 },
        { window: '1d', max: 600 },
      ],
      apiRateLimits: [{ window: '1m', max: 100 }],
    },
    owner: newMember('Priya Raghunathan-Okonkwo'),
    members: HARTWELL_MEMBERS,
    // Newest month first. The current month ends at 64 of 75 documents and 218 of 200 emails.
    monthlyDocuments: [64, 61, 52, 47, 41, 38, 33, 24, 26, 21],
    emailsPerDocument: 3.4,
    apiCallsPerDocument: 23,
    newestTitles: [
      'Charter Party Agreement (Amended and Restated) between Hartwell & Brandt Maritime Logistics Group and Nordhavn Container Terminals A/S for the Rotterdam, Antwerp and Hamburg feeder rotation, voyages 2026-114 through 2026-131 inclusive',
      'FINAL_FINAL_v7_signed_copy_(2)_DO_NOT_USE_crew_contract_template.pdf',
      'x',
      '傭船契約書 — 東京丸',
    ],
    teams: [
      {
        name: 'Legal & Compliance',
        url: 'hb-legal',
        memberCount: 7,
        documentShare: 22,
        titles: [
          'Mutual NDA — {party}',
          'Master Services Agreement — {party}',
          'Data Processing Addendum — {party}',
          'Settlement Agreement, claim {n}',
          'Board Resolution {n}',
        ],
      },
      {
        name: 'Chartering — EMEA',
        url: 'hb-chartering-emea',
        memberCount: 6,
        documentShare: 18,
        titles: [
          'Charter Party Agreement — {vessel}',
          'Fixture Recap — {vessel}, voyage {n}',
          'Letter of Indemnity — {vessel}',
          'Bill of Lading Amendment No. {n} — {party}',
        ],
      },
      {
        name: 'Human Resources',
        url: 'hb-hr',
        memberCount: 4,
        documentShare: 13,
        titles: ['Offer Letter — {person}', 'Employment Contract — {person}', 'Relocation Agreement — {person}'],
      },
      {
        name: 'Procurement',
        url: 'hb-procurement',
        memberCount: 5,
        documentShare: 10,
        titles: ['Purchase Order {n} — {party}', 'Supplier Framework Agreement — {party}'],
      },
      {
        name: 'Port Operations (Rotterdam, Antwerp & Hamburg Joint Venture)',
        url: 'hb-port-ops-rah',
        memberCount: 8,
        documentShare: 9,
        titles: [
          'Port Agency Appointment — {vessel}',
          'Berth Booking Confirmation {n}',
          'Statement of Facts — {vessel}',
        ],
      },
      {
        name: 'Finance',
        url: 'hb-finance',
        memberCount: 4,
        documentShare: 8,
        titles: ['Credit Facility Drawdown Notice {n}', 'Audit Representation Letter', 'Guarantee — {party}'],
      },
      {
        name: 'Crew Management',
        url: 'hb-crew',
        memberCount: 5,
        documentShare: 7,
        titles: ['Crew Employment Contract — {person}', 'Seafarer Medical Consent — {person}'],
      },
      {
        name: 'Sales — Americas',
        url: 'hb-sales-americas',
        memberCount: 3,
        documentShare: 5,
        titles: ['Freight Quote {n} — {party}', 'Service Order — {party}'],
      },
      {
        name: 'Insurance & Claims',
        url: 'hb-insurance',
        memberCount: 3,
        documentShare: 4,
        titles: ['Marine Insurance Claim Form — {vessel}', 'Release and Discharge, claim {n}'],
      },
      {
        name: 'Customs Brokerage',
        url: 'hb-customs',
        memberCount: 2,
        documentShare: 2,
        titles: ['Customs Power of Attorney — {party}'],
      },
      {
        name: 'Vendor Onboarding',
        url: 'hb-vendors',
        memberCount: 2,
        documentShare: 1.5,
        titles: ['Vendor Onboarding Form — {party}'],
      },
      {
        name: 'Executive Office',
        url: 'hb-exec',
        memberCount: 1,
        documentShare: 0.5,
        titles: ['Shareholder Consent {n}'],
      },
      { name: 'IT', url: 'hb-it', memberCount: 3, documentShare: 0, titles: [] },
      { name: 'Q4 Audit Task Force', url: 'hb-q4-audit', memberCount: 0, documentShare: 0, titles: [] },
    ],
  },
  {
    name: 'Marlow Freight Forwarding Ltd',
    url: 'marlow-freight',
    emailDomain: 'marlowfreight.example',
    ageInDays: 140,
    claimId: INTERNAL_CLAIM_ID.TEAM,
    subscriptionStatus: SubscriptionStatus.PAST_DUE,
    claim: {
      memberCount: 5,
      teamCount: 3,
      documentQuota: 30,
      emailQuota: 0,
      apiQuota: 1000,
    },
    owner: newMember('Edmund Marlow'),
    members: [
      newMember('Saoirse Kelly', OrganisationMemberRole.ADMIN),
      newMember('Tunde Bakare', OrganisationMemberRole.MANAGER),
      newMember('Wen Zhao'),
      newMember('Agnieszka Wójcik'),
      newMember('Ravi Subramanian'),
    ],
    // Newest month first. The current month ends at 38 of 30 documents.
    monthlyDocuments: [38, 12, 14, 9],
    emailsPerDocument: 0,
    apiCallsPerDocument: 8,
    newestTitles: [],
    teams: [
      {
        name: 'Forwarding',
        url: 'marlow-forwarding',
        memberCount: 3,
        documentShare: 6,
        titles: ['Forwarding Instruction {n} — {party}', 'Cargo Release Authorisation — {vessel}'],
      },
      {
        name: 'Accounts',
        url: 'marlow-accounts',
        memberCount: 1,
        documentShare: 2,
        titles: ['Credit Application — {party}'],
      },
      { name: 'Warehouse', url: 'marlow-warehouse', memberCount: 2, documentShare: 1, titles: ['Bailment Notice {n}'] },
    ],
  },
  {
    name: 'Tideline Studio',
    url: 'tideline-studio',
    emailDomain: 'tideline.example',
    ageInDays: 3,
    claimId: INTERNAL_CLAIM_ID.FREE,
    claim: {},
    owner: newMember('Noor Castellanos'),
    members: [],
    monthlyDocuments: [],
    emailsPerDocument: 0,
    apiCallsPerDocument: 0,
    newestTitles: [],
    teams: [{ name: 'Tideline Studio', url: 'tideline-team', memberCount: 0, documentShare: 1, titles: [] }],
  },
];

type MemberSpec = {
  name: string | null;
  role: OrganisationMemberRole;
  /** The part of the email before the @, for names that do not reduce to ASCII. */
  localPart?: string;
};

type TeamSpec = {
  name: string;
  url: string;
  /** Plain members attached on top of the organisation admins and managers. */
  memberCount: number;
  /** Relative weight of the organisation's documents that land in this team. */
  documentShare: number;
  titles: string[];
};

type SeededTeam = TeamSpec & {
  id: number;
  senders: User[];
};

type OrganisationSpec = {
  name: string;
  url: string;
  emailDomain: string;
  ageInDays: number;
  claimId: INTERNAL_CLAIM_ID;
  claim: Prisma.OrganisationClaimUpdateInput;
  subscriptionStatus?: SubscriptionStatus;
  owner: MemberSpec;
  members: MemberSpec[];
  teams: TeamSpec[];
  /** Documents created per calendar month, newest month first. */
  monthlyDocuments: number[];
  emailsPerDocument: number;
  apiCallsPerDocument: number;
  /** Titles for the newest documents of the current month. */
  newestTitles: string[];
};

const main = async () => {
  try {
    await seedAdminOrganisations();
  } catch (err) {
    console.error('[SEEDING]: Failed to seed admin organisations.');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

if (require.main === module) {
  void main();
}
