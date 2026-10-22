import type { TAdminRuleContext } from '@documenso/lib/types/admin-rules';
import type { ApiRequestMetadata, RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import type { AdminRuleFieldLoaders } from '@documenso/lib/utils/admin-rules';
import { prisma } from '@documenso/prisma';
import type { Recipient } from '@prisma/client';
import { DocumentSource, DocumentStatus, EnvelopeType } from '@prisma/client';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';
import type {
  AdminRuleEvent,
  AdminRuleEventEnvelope,
  AdminRuleEventOrganisation,
  AdminRuleEventUser,
  AdminRuleSubject,
} from './admin-rule-event';

export type BuildAdminRuleContextOptions = {
  event: AdminRuleEvent;
  requestMetadata?: RequestMetadata;
  requestSource?: ApiRequestMetadata['source'];
  now: Date;
};

/**
 * Turns an event into the flat object rules are evaluated against. It only reads the records the hook
 * point already loaded and runs no queries: fields that need one come from `getAdminRuleFieldLoaders`.
 */
export const buildAdminRuleContext = ({
  event,
  requestMetadata,
  requestSource,
  now,
}: BuildAdminRuleContextOptions): TAdminRuleContext => {
  const requestContext = buildRequestContext(requestMetadata, requestSource);

  return match(event)
    .with({ trigger: 'DOCUMENT_SENT' }, ({ envelope, sender }) => ({
      ...buildSenderContext({ sender, organisation: envelope.team.organisation, now }),
      ...buildEnvelopeContext(envelope, requestSource),
      'team.id': envelope.team.id,
      'team.url': envelope.team.url,
      ...requestContext,
    }))
    .with({ trigger: 'EMAIL_SENT' }, ({ envelope, sender, emailType, recipients }) => ({
      ...buildSenderContext({ sender, organisation: envelope.team.organisation, now }),
      'email.type': emailType,
      'email.subject': envelope.documentMeta?.subject ?? '',
      'email.body': envelope.documentMeta?.message ?? '',
      'email.recipient_count': recipients.length,
      'email.recipient_domains': uniqueEmailDomains(recipients),
      'email.has_custom_subject': Boolean(envelope.documentMeta?.subject),
      'email.has_custom_message': Boolean(envelope.documentMeta?.message),
      ...buildEnvelopeContext(envelope, requestSource),
    }))
    .with({ trigger: 'USER_NAME_CHANGED' }, ({ user, newName }) => ({
      ...buildUserContext({ prefix: 'user', user, now }),
      'user.old_name': user.name ?? '',
      'user.new_name': newName,
      ...requestContext,
    }))
    .with({ trigger: 'USER_SIGNED_UP' }, ({ user, signupMethod }) => ({
      'user.email': user.email,
      'user.email_domain': getEmailDomain(user.email),
      'user.name': user.name ?? '',
      'user.signup_method': signupMethod,
      ...requestContext,
    }))
    .exhaustive();
};

export type GetAdminRuleFieldLoadersOptions = {
  event: AdminRuleEvent;
  now: Date;
};

/**
 * The event's fields that need a query. The engine only loads one when the fields from
 * `buildAdminRuleContext` can't settle a rule.
 */
export const getAdminRuleFieldLoaders = ({ event, now }: GetAdminRuleFieldLoadersOptions): AdminRuleFieldLoaders =>
  match(event)
    .with({ trigger: 'DOCUMENT_SENT' }, { trigger: 'EMAIL_SENT' }, ({ sender }) => ({
      'sender.documents_sent_last_24h': async () =>
        await countDocumentsSentByUser(sender.id, DateTime.fromJSDate(now).minus({ hours: 24 }).toJSDate()),
      'sender.documents_sent_last_7d': async () =>
        await countDocumentsSentByUser(sender.id, DateTime.fromJSDate(now).minus({ days: 7 }).toJSDate()),
    }))
    .with({ trigger: 'USER_NAME_CHANGED' }, { trigger: 'USER_SIGNED_UP' }, () => ({}))
    .exhaustive();

/**
 * Who actions should attach to, derived from the event.
 */
export const getAdminRuleEventSubject = (event: AdminRuleEvent): AdminRuleSubject =>
  match(event)
    .with({ trigger: 'DOCUMENT_SENT' }, { trigger: 'EMAIL_SENT' }, ({ envelope, sender }) => ({
      userId: sender.id,
      organisationId: envelope.team.organisation.id,
      envelopeId: envelope.id,
    }))
    // User-level events belong to a person, not an organisation: a user can be a member of many.
    .with({ trigger: 'USER_NAME_CHANGED' }, { trigger: 'USER_SIGNED_UP' }, ({ user }) => ({
      userId: user.id,
      organisationId: null,
      envelopeId: null,
    }))
    .exhaustive();

export const getEmailDomain = (email: string) => email.toLowerCase().split('@').pop() ?? '';

const uniqueEmailDomains = (recipients: Pick<Recipient, 'email'>[]) =>
  Array.from(new Set(recipients.map((recipient) => getEmailDomain(recipient.email))));

type BuildUserContextOptions = {
  prefix: 'user' | 'sender';
  user: AdminRuleEventUser;
  now: Date;
};

const buildUserContext = ({ prefix, user, now }: BuildUserContextOptions): TAdminRuleContext => ({
  [`${prefix}.id`]: user.id,
  [`${prefix}.email`]: user.email,
  [`${prefix}.email_domain`]: getEmailDomain(user.email),
  [`${prefix}.name`]: user.name ?? '',
  [`${prefix}.account_age_days`]: Math.floor(
    DateTime.fromJSDate(now).diff(DateTime.fromJSDate(user.createdAt), 'days').days,
  ),
  [`${prefix}.two_factor_enabled`]: user.twoFactorEnabled,
});

const buildRequestContext = (
  requestMetadata: RequestMetadata | undefined,
  source: ApiRequestMetadata['source'] | undefined,
): TAdminRuleContext => ({
  'request.ip': requestMetadata?.ipAddress ?? '',
  'request.user_agent': requestMetadata?.userAgent ?? '',
  ...(source ? { 'request.source': source } : {}),
});

/**
 * Envelopes don't record when they were sent, so this counts the user's documents created since
 * `since` that have left draft, including those created through the user's direct links.
 */
const countDocumentsSentByUser = async (userId: number, since: Date) =>
  await prisma.envelope.count({
    where: {
      userId,
      type: EnvelopeType.DOCUMENT,
      status: {
        not: DocumentStatus.DRAFT,
      },
      createdAt: {
        gte: since,
      },
    },
  });

type BuildSenderContextOptions = {
  sender: AdminRuleEventUser;
  organisation: AdminRuleEventOrganisation;
  now: Date;
};

const buildSenderContext = ({ sender, organisation, now }: BuildSenderContextOptions): TAdminRuleContext => {
  const plan = organisation.organisationClaim.originalSubscriptionClaimId;

  return {
    ...buildUserContext({ prefix: 'sender', user: sender, now }),
    // Left out when the organisation has no plan, so no plan rule matches it.
    ...(plan ? { 'sender.plan': plan } : {}),
  };
};

const buildEnvelopeContext = (
  envelope: AdminRuleEventEnvelope,
  requestSource: ApiRequestMetadata['source'] | undefined,
): TAdminRuleContext => {
  const source = mapEnvelopeSource(envelope.source, requestSource);

  return {
    'envelope.id': envelope.id,
    'envelope.title': envelope.title,
    'envelope.recipient_count': envelope.recipients.length,
    'envelope.recipient_domains': uniqueEmailDomains(envelope.recipients),
    ...(source ? { 'envelope.source': source } : {}),
  };
};

/**
 * `null` when it can't be known: emails sent by background jobs have no request to take it from.
 */
const mapEnvelopeSource = (source: DocumentSource, requestSource: ApiRequestMetadata['source'] | undefined) => {
  if (source === DocumentSource.TEMPLATE_DIRECT_LINK) {
    return 'direct_link';
  }

  if (source === DocumentSource.TEMPLATE) {
    return 'template';
  }

  if (!requestSource) {
    return null;
  }

  return requestSource === 'app' ? 'app' : 'api';
};
