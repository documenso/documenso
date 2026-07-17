import { prisma } from '@documenso/prisma';
import { EnvelopeType } from '@prisma/client';

export const ADMIN_SEARCH_RESULTS_PER_TYPE = 5;

const MAX_POSTGRES_INT = 2147483647;

const GROUP_ORDER = ['document', 'user', 'organisation', 'team', 'recipient', 'subscription'] as const;

export type AdminGlobalSearchResultType = (typeof GROUP_ORDER)[number];

export type AdminGlobalSearchResult = {
  label: string;
  sublabel?: string;
  path: string;
  value: string;
};

export type AdminGlobalSearchGroup = {
  type: AdminGlobalSearchResultType;
  results: AdminGlobalSearchResult[];
};

export type AdminGlobalSearchOptions = {
  query: string;
};

type PartialResults = Partial<Record<AdminGlobalSearchResultType, AdminGlobalSearchResult[]>>;

export const adminGlobalSearch = async ({ query }: AdminGlobalSearchOptions): Promise<AdminGlobalSearchGroup[]> => {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return [];
  }

  const resultsByType = await resolveSearch(trimmedQuery);

  return GROUP_ORDER.map((type) => ({
    type,
    results: (resultsByType[type] ?? []).map((result) => ({
      ...result,
      // Append the raw query so cmdk's client-side filter never hides
      // server-verified results.
      value: `${result.value} ${trimmedQuery}`,
    })),
  })).filter((group) => group.results.length > 0);
};

const resolveSearch = async (query: string): Promise<PartialResults> => {
  // Recognized ID prefixes resolve to a single exact lookup.
  if (query.startsWith('envelope_')) {
    return { document: await findDocumentsByExactId({ id: query }) };
  }

  if (query.startsWith('document_')) {
    return { document: await findDocumentsByExactId({ secondaryId: query }) };
  }

  if (query.startsWith('org_')) {
    return { organisation: await findOrganisationsByIdOrUrl(query) };
  }

  // Bare numbers are treated as verified ID lookups only. Oversized numbers
  // fall through to text search.
  const numericId = Number(query);

  if (/^\d+$/.test(query) && numericId <= MAX_POSTGRES_INT) {
    const [document, user, team, recipient, subscription] = await Promise.all([
      findDocumentsByExactId({ secondaryId: `document_${numericId}` }),
      findUsersById(numericId),
      findTeamsById(numericId),
      findRecipientsById(numericId),
      findSubscriptionsById(numericId),
    ]);

    return { document, user, team, recipient, subscription };
  }

  // Free text searches all resource types in parallel.
  const [document, user, organisation, team, recipient, subscription] = await Promise.all([
    findDocumentsByText(query),
    findUsersByText(query),
    findOrganisationsByText(query),
    findTeamsByText(query),
    findRecipientsByText(query),
    findSubscriptionsByText(query),
  ]);

  return {
    document,
    user,
    organisation,
    team,
    recipient,
    subscription,
  };
};

const joinSublabel = (parts: Array<string | null | undefined>) =>
  parts.filter((part) => part && part.length > 0).join(' · ') || undefined;

// ─── Documents ────────────────────────────────────────────────────────────────

const documentSelect = {
  id: true,
  title: true,
  secondaryId: true,
  user: { select: { email: true } },
} as const;

type DocumentRow = {
  id: string;
  title: string;
  secondaryId: string;
  user: { email: string };
};

const mapDocument = (envelope: DocumentRow): AdminGlobalSearchResult => ({
  label: envelope.title,
  sublabel: joinSublabel([envelope.secondaryId, envelope.user.email]),
  path: `/admin/documents/${envelope.id}`,
  value: `document ${envelope.id} ${envelope.secondaryId} ${envelope.title} ${envelope.user.email}`,
});

const findDocumentsByExactId = async (where: { id: string } | { secondaryId: string }) => {
  const envelope = await prisma.envelope.findFirst({
    where: { ...where, type: EnvelopeType.DOCUMENT },
    select: documentSelect,
  });

  return envelope ? [mapDocument(envelope)] : [];
};

const findDocumentsByText = async (query: string) => {
  const envelopes = await prisma.envelope.findMany({
    where: {
      type: EnvelopeType.DOCUMENT,
      title: { contains: query, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_SEARCH_RESULTS_PER_TYPE,
    select: documentSelect,
  });

  return envelopes.map(mapDocument);
};

// ─── Users ────────────────────────────────────────────────────────────────────

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const;

type UserRow = { id: number; name: string | null; email: string };

const mapUser = (user: UserRow): AdminGlobalSearchResult => ({
  label: user.name || user.email,
  sublabel: joinSublabel([`#${user.id}`, user.email]),
  path: `/admin/users/${user.id}`,
  value: `user ${user.id} ${user.name ?? ''} ${user.email}`,
});

const findUsersById = async (id: number) => {
  const user = await prisma.user.findFirst({
    where: { id },
    select: userSelect,
  });

  return user ? [mapUser(user)] : [];
};

const findUsersByText = async (query: string) => {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }],
    },
    orderBy: { id: 'desc' },
    take: ADMIN_SEARCH_RESULTS_PER_TYPE,
    select: userSelect,
  });

  return users.map(mapUser);
};

// ─── Organisations ────────────────────────────────────────────────────────────

const organisationSelect = {
  id: true,
  name: true,
  owner: { select: { email: true } },
} as const;

type OrganisationRow = { id: string; name: string; owner: { email: string } };

const mapOrganisation = (organisation: OrganisationRow): AdminGlobalSearchResult => ({
  label: organisation.name,
  sublabel: joinSublabel([organisation.id, organisation.owner.email]),
  path: `/admin/organisations/${organisation.id}`,
  value: `organisation ${organisation.id} ${organisation.name} ${organisation.owner.email}`,
});

const findOrganisationsByIdOrUrl = async (query: string) => {
  const organisations = await prisma.organisation.findMany({
    where: {
      OR: [{ id: query }, { url: query }],
    },
    take: ADMIN_SEARCH_RESULTS_PER_TYPE,
    select: organisationSelect,
  });

  return organisations.map(mapOrganisation);
};

const findOrganisationsByText = async (query: string) => {
  const organisations = await prisma.organisation.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { url: { contains: query, mode: 'insensitive' } },
        { customerId: { contains: query, mode: 'insensitive' } },
        { owner: { email: { contains: query, mode: 'insensitive' } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_SEARCH_RESULTS_PER_TYPE,
    select: organisationSelect,
  });

  return organisations.map(mapOrganisation);
};

// ─── Teams ────────────────────────────────────────────────────────────────────

const teamSelect = {
  id: true,
  name: true,
  url: true,
  organisation: { select: { name: true } },
} as const;

type TeamRow = { id: number; name: string; url: string; organisation: { name: string } };

const mapTeam = (team: TeamRow): AdminGlobalSearchResult => ({
  label: team.name,
  sublabel: joinSublabel([`#${team.id}`, `/${team.url}`, team.organisation.name]),
  path: `/admin/teams/${team.id}`,
  value: `team ${team.id} ${team.name} ${team.url} ${team.organisation.name}`,
});

const findTeamsById = async (id: number) => {
  const team = await prisma.team.findFirst({
    where: { id },
    select: teamSelect,
  });

  return team ? [mapTeam(team)] : [];
};

const findTeamsByText = async (query: string) => {
  const teams = await prisma.team.findMany({
    where: {
      OR: [{ name: { contains: query, mode: 'insensitive' } }, { url: { contains: query, mode: 'insensitive' } }],
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_SEARCH_RESULTS_PER_TYPE,
    select: teamSelect,
  });

  return teams.map(mapTeam);
};

// ─── Recipients ───────────────────────────────────────────────────────────────

const recipientSelect = {
  id: true,
  name: true,
  email: true,
  envelope: { select: { id: true, title: true } },
} as const;

type RecipientRow = {
  id: number;
  name: string;
  email: string;
  envelope: { id: string; title: string };
};

const mapRecipient = (recipient: RecipientRow): AdminGlobalSearchResult => ({
  label: recipient.email,
  sublabel: joinSublabel([recipient.name, `on "${recipient.envelope.title}"`]),
  path: `/admin/documents/${recipient.envelope.id}`,
  value: `recipient ${recipient.id} ${recipient.name} ${recipient.email} ${recipient.envelope.title}`,
});

const findRecipientsById = async (id: number) => {
  const recipient = await prisma.recipient.findFirst({
    where: {
      id,
      envelope: { type: EnvelopeType.DOCUMENT },
    },
    select: recipientSelect,
  });

  return recipient ? [mapRecipient(recipient)] : [];
};

const findRecipientsByText = async (query: string) => {
  const recipients = await prisma.recipient.findMany({
    where: {
      envelope: { type: EnvelopeType.DOCUMENT },
      OR: [{ email: { contains: query, mode: 'insensitive' } }, { name: { contains: query, mode: 'insensitive' } }],
    },
    orderBy: { id: 'desc' },
    take: ADMIN_SEARCH_RESULTS_PER_TYPE,
    select: recipientSelect,
  });

  return recipients.map(mapRecipient);
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

const subscriptionSelect = {
  id: true,
  status: true,
  planId: true,
  customerId: true,
  organisationId: true,
} as const;

type SubscriptionRow = {
  id: number;
  status: string;
  planId: string;
  customerId: string;
  organisationId: string;
};

const mapSubscription = (subscription: SubscriptionRow): AdminGlobalSearchResult => ({
  label: `Subscription #${subscription.id}`,
  sublabel: joinSublabel([subscription.status, subscription.planId]),
  path: `/admin/organisations/${subscription.organisationId}`,
  value: `subscription ${subscription.id} ${subscription.planId} ${subscription.customerId}`,
});

const findSubscriptionsById = async (id: number) => {
  const subscription = await prisma.subscription.findFirst({
    where: { id },
    select: subscriptionSelect,
  });

  return subscription ? [mapSubscription(subscription)] : [];
};

const findSubscriptionsByText = async (query: string) => {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      OR: [
        { planId: { contains: query, mode: 'insensitive' } },
        { customerId: { contains: query, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_SEARCH_RESULTS_PER_TYPE,
    select: subscriptionSelect,
  });

  return subscriptions.map(mapSubscription);
};
