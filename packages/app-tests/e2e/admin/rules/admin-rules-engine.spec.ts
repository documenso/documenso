import { ADMIN_RULE_MATCH_RETENTION_DAYS } from '@documenso/lib/constants/admin-rules';
import { DEFAULT_ENVELOPE_REMINDER_SETTINGS } from '@documenso/lib/constants/envelope-reminder';
import { AppError } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { adminDeleteRecipient } from '@documenso/lib/server-only/admin/admin-delete-recipient';
import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { rejectDocumentWithToken } from '@documenso/lib/server-only/document/reject-document-with-token';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { createDocumentFromDirectTemplate } from '@documenso/lib/server-only/template/create-document-from-direct-template';
import { disableUser } from '@documenso/lib/server-only/user/disable-user';
import { updateProfile } from '@documenso/lib/server-only/user/update-profile';
import type {
  TAdminRuleAction,
  TAdminRuleCondition,
  TAdminRuleConditionGroup,
  TAdminRuleConditionNode,
  TAdminRuleDefinition,
  TAdminRuleMode,
  TAdminRuleTrigger,
} from '@documenso/lib/types/admin-rules';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedDraftDocument, seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { DocumentSigningOrder, DocumentSource, FieldType, RecipientRole, SendStatus, type User } from '@prisma/client';
import { DateTime } from 'luxon';

import { apiSignin, WEBAPP_ORIGIN_HEADERS } from '../../fixtures/authentication';
import { signSignaturePad } from '../../fixtures/signature';

test.describe.configure({ mode: 'parallel' });

const ruleIdsToCleanup: string[] = [];

test.afterEach(async () => {
  if (ruleIdsToCleanup.length > 0) {
    await prisma.adminRule.deleteMany({
      where: {
        id: {
          in: ruleIdsToCleanup,
        },
      },
    });
    ruleIdsToCleanup.length = 0;
  }
});

type SeedRuleOptions = {
  trigger: TAdminRuleTrigger;
  mode?: TAdminRuleMode;
  stopOnMatch?: boolean;
  definition: TAdminRuleDefinition;
  exemptOrganisationIds?: string[];
};

// Every seeded rule is scoped to the test's own user so parallel tests cannot affect each other.
const seedRule = async ({
  trigger,
  mode = 'ENFORCE',
  stopOnMatch = true,
  definition,
  exemptOrganisationIds = [],
}: SeedRuleOptions) => {
  const lastRule = await prisma.adminRule.findFirst({
    orderBy: {
      priority: 'desc',
    },
    select: {
      priority: true,
    },
  });

  const rule = await prisma.adminRule.create({
    data: {
      id: generateDatabaseId('admin_rule'),
      name: `Engine test ${nanoid()}`,
      trigger,
      mode,
      stopOnMatch,
      priority: (lastRule?.priority ?? -1) + 1,
      definition,
      exemptOrganisationIds,
    },
  });

  ruleIdsToCleanup.push(rule.id);

  return rule;
};

type BuildDefinitionOptions = {
  conditions: Array<Omit<TAdminRuleCondition, 'type'> | TAdminRuleConditionGroup>;
  actions: TAdminRuleAction[];
};

// The top-level conditions must all match. Pass a group to nest conditions.
const buildDefinition = ({ conditions, actions }: BuildDefinitionOptions): TAdminRuleDefinition => ({
  when: {
    type: 'group',
    match: 'all',
    children: conditions.map(
      (condition): TAdminRuleConditionNode => ('type' in condition ? condition : { type: 'condition', ...condition }),
    ),
  },
  actions,
});

const requestMetadata = {
  requestMetadata: {},
  source: 'app' as const,
  auth: 'session' as const,
};

const updateProfileName = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByLabel('Full Name').fill(name);
  await signSignaturePad(page);
  await page.getByRole('button', { name: 'Update profile' }).click();
};

type WaitForRecipientJobOptions = {
  jobId: string;
  recipientId: number;
};

// Jobs run on the app server, so tests wait for the one queued for the recipient to finish.
const waitForRecipientJob = async ({ jobId, recipientId }: WaitForRecipientJobOptions) => {
  await expect
    .poll(
      async () => {
        const job = await prisma.backgroundJob.findFirst({
          where: {
            jobId,
            payload: {
              path: ['recipientId'],
              equals: recipientId,
            },
          },
          select: {
            status: true,
          },
        });

        return job?.status;
      },
      { timeout: 15_000 },
    )
    .toEqual('COMPLETED');
};

type WaitForEnvelopeJobOptions = {
  jobId: string;
  envelopeId: string;
};

// Like `waitForRecipientJob`, for jobs queued for a whole document.
const waitForEnvelopeJob = async ({ jobId, envelopeId }: WaitForEnvelopeJobOptions) => {
  await expect
    .poll(
      async () => {
        const job = await prisma.backgroundJob.findFirst({
          where: {
            jobId,
            payload: {
              path: ['envelopeId'],
              equals: envelopeId,
            },
          },
          select: {
            status: true,
          },
        });

        return job?.status;
      },
      { timeout: 30_000 },
    )
    .toEqual('COMPLETED');
};

const countRuleMatches = async (ruleId: string) =>
  await prisma.adminRuleMatch.count({
    where: {
      ruleId,
    },
  });

type SendTestDocumentOptions = {
  user: User;
  teamId: number;
};

// Sends a new document without emailing anyone, and returns the error when a rule blocks it.
const sendTestDocument = async ({ user, teamId }: SendTestDocumentOptions) => {
  const document = await seedDraftDocument(user, teamId, ['recipient@example.com']);

  // The seeded fields are name fields, and a signer needs a signature field before sending.
  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  return await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId,
    sendEmail: false,
    requestMetadata,
  })
    .then(() => null)
    .catch((err) => AppError.parseError(err));
};

type SeedSequentialDocumentOptions = {
  user: User;
  teamId: number;
};

// A pending document with two signers in order, where only the first has been sent it.
const seedSequentialDocument = async ({ user, teamId }: SeedSequentialDocumentOptions) => {
  const document = await seedPendingDocument(user, teamId, ['first@example.com', 'second@example.com']);
  const [first, second] = [...document.recipients].sort((a, b) => a.id - b.id);

  await prisma.documentMeta.update({
    where: {
      id: document.documentMetaId,
    },
    data: {
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
    },
  });

  await prisma.recipient.update({
    where: {
      id: first.id,
    },
    data: {
      signingOrder: 1,
    },
  });

  // The second step hasn't started yet.
  await prisma.recipient.update({
    where: {
      id: second.id,
    },
    data: {
      signingOrder: 2,
      sendStatus: SendStatus.NOT_SENT,
    },
  });

  return { document, first, second };
};

type SeedDisableEmailsRuleOptions = {
  user: User;
  emailType: string;
};

// Turns off the sender's organisation emails when one type of email is about to go out, without a block.
const seedDisableEmailsRule = async ({ user, emailType }: SeedDisableEmailsRuleOptions) =>
  await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: emailType },
      ],
      actions: [{ type: 'disable_emails', params: {} }],
    }),
  });

type CountSentEmailsOptions = {
  envelopeId: string;
  recipientId?: number;
};

// Each email sent for a document gets an audit log entry.
const countSentEmails = async ({ envelopeId, recipientId }: CountSentEmailsOptions) =>
  await prisma.documentAuditLog.count({
    where: {
      envelopeId,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      ...(recipientId !== undefined && {
        data: {
          path: ['recipientId'],
          equals: recipientId,
        },
      }),
    },
  });

type ResendDocumentInAppOptions = {
  page: Page;
  teamId: number;
  envelopeId: string;
  recipientIds: number[];
};

// Resends through the app: `resendDocument` renders emails with translated messages, which can't be
// loaded in this test process.
const resendDocumentInApp = async ({ page, teamId, envelopeId, recipientIds }: ResendDocumentInAppOptions) =>
  await page.request.post('/api/trpc/envelope.redistribute', {
    headers: {
      ...WEBAPP_ORIGIN_HEADERS,
      'x-team-id': String(teamId),
    },
    data: {
      json: {
        envelopeId,
        recipients: recipientIds,
      },
    },
  });

type SubmitDirectLinkOptions = {
  template: Awaited<ReturnType<typeof seedDirectTemplate>>;
  nextSigner?: {
    email: string;
    name: string;
  };
};

// A logged-out visitor filling in the direct link, as the public route does it.
const submitDirectLink = async ({ template, nextSigner }: SubmitDirectLinkOptions) => {
  const directLinkToken = template.directLink?.token ?? '';
  const signatureField = template.fields.find((field) => field.type === FieldType.SIGNATURE);

  if (!signatureField) {
    throw new Error('The seeded direct template has no signature field');
  }

  // The flow rejects a stale template version.
  const { updatedAt } = await prisma.envelope.findFirstOrThrow({
    where: {
      id: template.id,
    },
  });

  await createDocumentFromDirectTemplate({
    directRecipientName: 'Visitor',
    directRecipientEmail: 'visitor@example.com',
    directTemplateToken: directLinkToken,
    templateUpdatedAt: updatedAt,
    signedFieldValues: [
      {
        token: directLinkToken,
        fieldId: signatureField.id,
        value: 'Visitor',
        isBase64: false,
      },
    ],
    nextSigner,
    requestMetadata,
  });
};

test('[ADMIN][RULES][ENGINE]: an enforced rule blocks a name change and records the match', async ({ page }) => {
  const { user } = await seedUser();

  const rule = await seedRule({
    trigger: 'USER_NAME_CHANGED',
    definition: buildDefinition({
      conditions: [
        { field: 'user.email', operator: 'equals', value: user.email },
        { field: 'user.new_name', operator: 'contains', value: 'SUSPICIOUS' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await apiSignin({ page, email: user.email, redirectPath: '/settings/profile' });

  await updateProfileName(page, 'SUSPICIOUS NAME');

  await expect(page.getByText('Profile update blocked', { exact: true })).toBeVisible();

  const unchangedUser = await prisma.user.findFirstOrThrow({
    where: {
      id: user.id,
    },
  });
  expect(unchangedUser.name).toEqual(user.name);

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actorUserId).toEqual(user.id);
  expect(match.mode).toEqual('ENFORCE');
  expect(match.eventSnapshot['user.new_name']).toEqual('SUSPICIOUS NAME');
  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);
});

test('[ADMIN][RULES][ENGINE]: a monitor rule records the match without blocking', async ({ page }) => {
  const { user } = await seedUser();

  const rule = await seedRule({
    trigger: 'USER_NAME_CHANGED',
    mode: 'MONITOR',
    definition: buildDefinition({
      conditions: [{ field: 'user.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await apiSignin({ page, email: user.email, redirectPath: '/settings/profile' });

  await updateProfileName(page, 'Monitored Name');

  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible();

  const updatedUser = await prisma.user.findFirstOrThrow({
    where: {
      id: user.id,
    },
  });
  expect(updatedUser.name).toEqual('Monitored Name');

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.mode).toEqual('MONITOR');
  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'would_run' }]);
});

test('[ADMIN][RULES][ENGINE]: flag_account_for_review flags the user', async ({ page }) => {
  const { user } = await seedUser();

  const rule = await seedRule({
    trigger: 'USER_NAME_CHANGED',
    definition: buildDefinition({
      conditions: [{ field: 'user.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'flag_account_for_review', params: { reason: 'Flagged by test' } }],
    }),
  });

  await apiSignin({ page, email: user.email, redirectPath: '/settings/profile' });

  await updateProfileName(page, 'Flagged Name');

  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible();

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'flag_account_for_review', status: 'ran' }]);

  // Exactly one tag, linked back to the rule that created it.
  const tags = await prisma.adminTag.findMany({
    where: {
      userId: user.id,
    },
  });

  expect(tags).toHaveLength(1);
  expect(tags[0]).toMatchObject({
    type: 'flagged_for_review',
    description: 'Flagged by test',
    adminRuleId: rule.id,
  });
});

test('[ADMIN][RULES][ENGINE]: an admin can remove a tag from a user', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user } = await seedUser();

  const tag = await prisma.adminTag.create({
    data: {
      id: generateDatabaseId('admin_tag'),
      type: 'flagged_for_review',
      description: 'Needs a look',
      userId: user.id,
      createdByUserId: adminUser.id,
    },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/users/${user.id}` });

  await expect(page.getByText('Flagged for review')).toBeVisible();
  await expect(page.getByText('Needs a look')).toBeVisible();
  await expect(page.getByText(`by ${adminUser.email}`)).toBeVisible();

  // Removing asks for confirmation first, and cancelling keeps the tag.
  const dialog = page.getByRole('dialog');

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(dialog.getByText('Needs a look')).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: 'Remove' }).click();
  await dialog.getByRole('button', { name: 'Remove tag' }).click();

  await expect(page.getByText('Tag removed', { exact: true })).toBeVisible();

  await expect
    .poll(async () =>
      prisma.adminTag.findFirst({
        where: {
          id: tag.id,
        },
      }),
    )
    .toBeNull();
});

test('[ADMIN][RULES][ENGINE]: a sign-up rule runs against the new account', async ({ request }) => {
  const email = seedTestEmail();

  const rule = await seedRule({
    trigger: 'USER_SIGNED_UP',
    definition: buildDefinition({
      conditions: [{ field: 'user.email', operator: 'equals', value: email }],
      actions: [{ type: 'flag_account_for_review', params: { reason: 'New account' } }],
    }),
  });

  // The endpoint the sign-up form posts to.
  const response = await request.post('/api/auth/email-password/signup', {
    headers: WEBAPP_ORIGIN_HEADERS,
    data: {
      name: 'New User',
      email,
      password: 'Password123#',
    },
  });

  expect(response.status()).toBe(201);

  const user = await prisma.user.findFirstOrThrow({
    where: {
      email,
    },
  });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actorUserId).toEqual(user.id);
  expect(match.eventSnapshot['user.signup_method']).toEqual('PASSWORD');
  expect(match.actionsRun).toEqual([{ type: 'flag_account_for_review', status: 'ran' }]);

  const tag = await prisma.adminTag.findFirstOrThrow({
    where: {
      userId: user.id,
    },
  });

  expect(tag).toMatchObject({
    type: 'flagged_for_review',
    description: 'New account',
    adminRuleId: rule.id,
  });
});

test('[ADMIN][RULES][ENGINE]: a DOCUMENT_SENT rule blocks sending', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  // Signers need a signature field before a document can be sent.
  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'envelope.recipient_domains', operator: 'contains', value: 'example.com' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const error = await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    requestMetadata,
  }).catch((err) => AppError.parseError(err));

  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: document.id,
    },
  });
  expect(envelope.status).toEqual('DRAFT');

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });
  expect(match.envelopeId).toEqual(document.id);
  expect(match.organisationId).toEqual(team.organisationId);
  expect(match.eventSnapshot['envelope.recipient_count']).toEqual(1);
});

test('[ADMIN][RULES][ENGINE]: nested condition groups are evaluated like a boolean expression', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  // sender.email equals <user> AND (envelope.title contains "never-matches" OR recipient domains contain example.com)
  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        {
          type: 'group',
          match: 'any',
          children: [
            { type: 'condition', field: 'envelope.title', operator: 'contains', value: 'never-matches' },
            { type: 'condition', field: 'envelope.recipient_domains', operator: 'contains', value: 'example.com' },
          ],
        },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const error = await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    requestMetadata,
  }).catch((err) => AppError.parseError(err));

  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);
});

test('[ADMIN][RULES][ENGINE]: stopOnMatch prevents lower priority rules from running', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  const senderCondition = { field: 'sender.email', operator: 'equals', value: user.email } as const;

  const logRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'log_only', params: {} }] }),
  });

  const blockRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'block_event', params: {} }] }),
  });

  await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    sendEmail: false,
    requestMetadata,
  });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: document.id,
    },
  });
  expect(envelope.status).toEqual('PENDING');

  const logRuleMatchCount = await prisma.adminRuleMatch.count({
    where: {
      ruleId: logRule.id,
    },
  });

  const blockRuleMatchCount = await prisma.adminRuleMatch.count({
    where: {
      ruleId: blockRule.id,
    },
  });

  expect(logRuleMatchCount).toEqual(1);
  expect(blockRuleMatchCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: rules that share a priority run oldest first', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  const senderCondition = { field: 'sender.email', operator: 'equals', value: user.email } as const;

  const blockRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'block_event', params: {} }] }),
  });

  const logRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'log_only', params: {} }] }),
  });

  // Gives the log rule the block rule's priority and an older creation time. It was created second,
  // so without a tiebreak the database would usually return it second.
  await prisma.adminRule.update({
    where: {
      id: logRule.id,
    },
    data: {
      priority: blockRule.priority,
      createdAt: new Date(blockRule.createdAt.getTime() - 60_000),
    },
  });

  await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    sendEmail: false,
    requestMetadata,
  });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: document.id,
    },
  });
  expect(envelope.status).toEqual('PENDING');

  const logRuleMatchCount = await prisma.adminRuleMatch.count({
    where: {
      ruleId: logRule.id,
    },
  });

  const blockRuleMatchCount = await prisma.adminRuleMatch.count({
    where: {
      ruleId: blockRule.id,
    },
  });

  expect(logRuleMatchCount).toEqual(1);
  expect(blockRuleMatchCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a disabled rule never runs', async () => {
  const { user, team } = await seedUser();

  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    mode: 'DISABLED',
    definition: buildDefinition({
      conditions: [{ field: 'sender.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const error = await sendTestDocument({ user, teamId: team.id });

  expect(error).toBeNull();
  expect(await countRuleMatches(rule.id)).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: with stopOnMatch off, lower priority rules run too', async () => {
  const { user, team } = await seedUser();

  const senderCondition = { field: 'sender.email', operator: 'equals', value: user.email } as const;

  const logRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    stopOnMatch: false,
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'log_only', params: {} }] }),
  });

  const blockRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'block_event', params: {} }] }),
  });

  const error = await sendTestDocument({ user, teamId: team.id });

  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });
  expect(await countRuleMatches(logRule.id)).toEqual(1);
  expect(await countRuleMatches(blockRule.id)).toEqual(1);
});

test('[ADMIN][RULES][ENGINE]: a block stops lower priority rules even with stopOnMatch off', async () => {
  const { user, team } = await seedUser();

  const senderCondition = { field: 'sender.email', operator: 'equals', value: user.email } as const;

  const blockRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    stopOnMatch: false,
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'block_event', params: {} }] }),
  });

  const logRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'log_only', params: {} }] }),
  });

  const error = await sendTestDocument({ user, teamId: team.id });

  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });
  expect(await countRuleMatches(blockRule.id)).toEqual(1);
  expect(await countRuleMatches(logRule.id)).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a monitor rule never stops lower priority rules', async () => {
  const { user, team } = await seedUser();

  const senderCondition = { field: 'sender.email', operator: 'equals', value: user.email } as const;

  // Monitor rules only observe, even when set to stop on match.
  const monitorRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    mode: 'MONITOR',
    stopOnMatch: true,
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'block_event', params: {} }] }),
  });

  const logRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'log_only', params: {} }] }),
  });

  const error = await sendTestDocument({ user, teamId: team.id });

  expect(error).toBeNull();
  expect(await countRuleMatches(monitorRule.id)).toEqual(1);
  expect(await countRuleMatches(logRule.id)).toEqual(1);
});

test('[ADMIN][RULES][ENGINE]: a saved rule that no longer parses is skipped', async () => {
  const { user, team } = await seedUser();

  const senderCondition = { field: 'sender.email', operator: 'equals', value: user.email } as const;

  // An empty group fails the definition schema, as a rule saved before a schema change might. If
  // the rule ran anyway, the empty group would match and the send would be blocked.
  const brokenRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [senderCondition, { type: 'group', match: 'all', children: [] }],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const logRule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({ conditions: [senderCondition], actions: [{ type: 'log_only', params: {} }] }),
  });

  const error = await sendTestDocument({ user, teamId: team.id });

  expect(error).toBeNull();
  expect(await countRuleMatches(brokenRule.id)).toEqual(0);
  expect(await countRuleMatches(logRule.id)).toEqual(1);
});

test('[ADMIN][RULES][ENGINE]: a failed action is recorded, and the other actions still run', async () => {
  const { user } = await seedUser();

  // A name change belongs to no organisation, so turning off organisation emails fails. The editor
  // doesn't offer the action on this trigger, but a failing action must not break the event.
  const rule = await seedRule({
    trigger: 'USER_NAME_CHANGED',
    definition: buildDefinition({
      conditions: [{ field: 'user.email', operator: 'equals', value: user.email }],
      actions: [
        { type: 'disable_emails', params: {} },
        { type: 'flag_account_for_review', params: { reason: 'Changed their name' } },
      ],
    }),
  });

  await updateProfile({
    userId: user.id,
    name: 'Renamed User',
    signature: '',
    requestMetadata,
  });

  const updatedUser = await prisma.user.findFirstOrThrow({
    where: {
      id: user.id,
    },
  });

  expect(updatedUser.name).toEqual('Renamed User');

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([
    { type: 'disable_emails', status: 'failed', error: expect.any(String) },
    { type: 'flag_account_for_review', status: 'ran' },
  ]);

  const tagCount = await prisma.adminTag.count({
    where: {
      userId: user.id,
      adminRuleId: rule.id,
    },
  });

  expect(tagCount).toEqual(1);
});

test('[ADMIN][RULES][ENGINE]: an exempt organisation skips the rule entirely', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    exemptOrganisationIds: [team.organisationId],
    definition: buildDefinition({
      conditions: [{ field: 'sender.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    sendEmail: false,
    requestMetadata,
  });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: document.id,
    },
  });
  expect(envelope.status).toEqual('PENDING');

  // Exempt rules are never evaluated, so no match is recorded either.
  const matchCount = await prisma.adminRuleMatch.count({
    where: {
      ruleId: rule.id,
    },
  });

  expect(matchCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: disable_user disables the sender, and without a block the send goes through', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [{ field: 'sender.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'disable_user', params: {} }],
    }),
  });

  await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    sendEmail: false,
    requestMetadata,
  });

  const updatedUser = await prisma.user.findFirstOrThrow({
    where: {
      id: user.id,
    },
  });
  expect(updatedUser.disabled).toBe(true);

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: document.id,
    },
  });
  expect(envelope.status).toEqual('PENDING');

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });
  expect(match.actionsRun).toEqual([{ type: 'disable_user', status: 'ran' }]);
});

test('[ADMIN][RULES][ENGINE]: disable_emails turns off email for the organisation, including the send that triggered it', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [{ field: 'sender.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'disable_emails', params: {} }],
    }),
  });

  await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    requestMetadata,
  });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'disable_emails', status: 'ran' }]);

  const organisation = await prisma.organisation.findFirstOrThrow({
    where: {
      id: team.organisationId,
    },
    select: {
      organisationClaim: {
        select: {
          flags: true,
        },
      },
    },
  });

  expect(organisation.organisationClaim.flags).toMatchObject({ disableEmails: true });

  // The flag is set before the send queues its signing email, so that email isn't sent either.
  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      envelopeId: document.id,
    },
  });

  await waitForRecipientJob({ jobId: 'send.signing.requested.email', recipientId: recipient.id });

  const sentEmailCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
    },
  });

  expect(sentEmailCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a blocked resend leaves the signing link and the reminder cycle untouched', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  // A resend that goes through renews the link (setting expiresAt) and restarts the reminder cycle.
  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      reminderCount: 2,
    },
  });

  await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'reminder' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await apiSignin({ page, email: user.email });

  const response = await resendDocumentInApp({
    page,
    teamId: team.id,
    envelopeId: document.id,
    recipientIds: [recipient.id],
  });

  expect(response.status()).toBe(403);

  const { error } = await response.json();

  expect(error.json.data.code).toEqual('ADMIN_RULE_BLOCKED');

  const updatedRecipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id: recipient.id,
    },
  });

  expect(updatedRecipient.expiresAt).toBeNull();
  expect(updatedRecipient.reminderCount).toEqual(2);
});

test('[ADMIN][RULES][ENGINE]: a rule that turns off emails also stops the resend that triggered it', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      reminderCount: 2,
    },
  });

  const rule = await seedDisableEmailsRule({ user, emailType: 'reminder' });

  await apiSignin({ page, email: user.email });

  const response = await resendDocumentInApp({
    page,
    teamId: team.id,
    envelopeId: document.id,
    recipientIds: [recipient.id],
  });

  expect(response.status()).toBe(200);

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'disable_emails', status: 'ran' }]);

  // The resend goes through, restarting the reminder cycle, but sends no email.
  const updatedRecipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id: recipient.id,
    },
  });

  expect(updatedRecipient.reminderCount).toEqual(0);
  expect(await countSentEmails({ envelopeId: document.id })).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a resend to recipients without an email address is not checked', async ({ page }) => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      email: '',
    },
  });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'reminder' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await apiSignin({ page, email: user.email });

  const response = await resendDocumentInApp({
    page,
    teamId: team.id,
    envelopeId: document.id,
    recipientIds: [recipient.id],
  });

  expect(response.status()).toBe(200);
  expect(await countRuleMatches(rule.id)).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: the signing emails of a sent document are checked again when their jobs send them', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['first@example.com', 'second@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  // A monitor rule records every evaluation that matches, without blocking the emails.
  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    mode: 'MONITOR',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'signing_request' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    requestMetadata,
  });

  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId: document.id,
    },
  });

  await Promise.all(
    recipients.map(async (recipient) =>
      waitForRecipientJob({ jobId: 'send.signing.requested.email', recipientId: recipient.id }),
    ),
  );

  const matches = await prisma.adminRuleMatch.findMany({
    where: {
      ruleId: rule.id,
    },
  });

  // Once by `sendDocument` for both emails, then again by each email's job.
  const recipientCounts = matches.map((match) => match.eventSnapshot['email.recipient_count']);

  expect(recipientCounts.sort()).toEqual([1, 1, 2]);
});

test('[ADMIN][RULES][ENGINE]: signing requests to recipients without an email address are not checked', async () => {
  const { user, team } = await seedUser();

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  await prisma.recipient.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      email: '',
    },
  });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'signing_request' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const error = await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    requestMetadata,
  })
    .then(() => null)
    .catch((err) => AppError.parseError(err));

  expect(error).toBeNull();

  // There's nothing to email, so the job marks the recipient as sent without checking either.
  const recipient = await prisma.recipient.findFirstOrThrow({
    where: {
      envelopeId: document.id,
    },
  });

  await waitForRecipientJob({ jobId: 'send.signing.requested.email', recipientId: recipient.id });

  const updatedRecipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id: recipient.id,
    },
  });

  expect(updatedRecipient.sendStatus).toEqual(SendStatus.SENT);
  expect(await countRuleMatches(rule.id)).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a blocked signing request for the next sequential step is not sent', async () => {
  const { user, team } = await seedUser();

  const { document, first, second } = await seedSequentialDocument({ user, teamId: team.id });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'signing_request' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: document.id },
  });

  // The rules run in the signing email job, on the app server.
  await waitForRecipientJob({ jobId: 'send.signing.requested.email', recipientId: second.id });

  // The first signature still completes, but the second recipient gets no email and isn't marked as sent.
  const recipients = await prisma.recipient.findMany({
    where: {
      envelopeId: document.id,
    },
    orderBy: {
      id: 'asc',
    },
  });

  expect(recipients.map(({ signingStatus, sendStatus }) => ({ signingStatus, sendStatus }))).toEqual([
    { signingStatus: 'SIGNED', sendStatus: 'SENT' },
    { signingStatus: 'NOT_SIGNED', sendStatus: 'NOT_SENT' },
  ]);

  const sentEmailCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      data: {
        path: ['recipientId'],
        equals: second.id,
      },
    },
  });

  expect(sentEmailCount).toEqual(0);

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);
  expect(match.eventSnapshot['email.recipient_count']).toEqual(1);
});

test('[ADMIN][RULES][ENGINE]: a blocked signing request after an admin removes the current signer is not sent', async () => {
  const { user, team } = await seedUser();

  const { document, first, second } = await seedSequentialDocument({ user, teamId: team.id });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'signing_request' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  // Removing the first signer moves the document on to the second.
  await adminDeleteRecipient({
    recipientId: first.id,
    reason: 'Removed by an E2E test',
    requestMetadata,
  });

  await waitForRecipientJob({ jobId: 'send.signing.requested.email', recipientId: second.id });

  const updatedSecond = await prisma.recipient.findFirstOrThrow({
    where: {
      id: second.id,
    },
  });

  expect(updatedSecond.sendStatus).toEqual(SendStatus.NOT_SENT);

  const sentEmailCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      data: {
        path: ['recipientId'],
        equals: second.id,
      },
    },
  });

  expect(sentEmailCount).toEqual(0);

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);
});

test('[ADMIN][RULES][ENGINE]: a rule that turns off emails also stops the signing request that triggered it', async () => {
  const { user, team } = await seedUser();

  const { document, first, second } = await seedSequentialDocument({ user, teamId: team.id });

  const rule = await seedDisableEmailsRule({ user, emailType: 'signing_request' });

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: document.id },
  });

  await waitForRecipientJob({ jobId: 'send.signing.requested.email', recipientId: second.id });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'disable_emails', status: 'ran' }]);

  // As if the organisation's emails were already off: no email, and the recipient isn't marked as sent.
  const updatedSecond = await prisma.recipient.findFirstOrThrow({
    where: {
      id: second.id,
    },
  });

  expect(updatedSecond.sendStatus).toEqual(SendStatus.NOT_SENT);
  expect(await countSentEmails({ envelopeId: document.id, recipientId: second.id })).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a next signer without an email address is not checked, and is marked as sent', async () => {
  const { user, team } = await seedUser();

  const { document, first, second } = await seedSequentialDocument({ user, teamId: team.id });

  await prisma.recipient.update({
    where: {
      id: second.id,
    },
    data: {
      email: '',
    },
  });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'signing_request' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await completeDocumentWithToken({
    token: first.token,
    id: { type: 'envelopeId', id: document.id },
  });

  await waitForRecipientJob({ jobId: 'send.signing.requested.email', recipientId: second.id });

  const updatedSecond = await prisma.recipient.findFirstOrThrow({
    where: {
      id: second.id,
    },
  });

  expect(updatedSecond.sendStatus).toEqual(SendStatus.SENT);
  expect(await countRuleMatches(rule.id)).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: blocked completion emails are not sent', async () => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'completed' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await completeDocumentWithToken({
    token: recipient.token,
    id: { type: 'envelopeId', id: document.id },
  });

  // Sealing the document starts the completion emails job, which runs the rules on the app server.
  await waitForEnvelopeJob({ jobId: 'send.document.completed.emails', envelopeId: document.id });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);

  // The owner and the recipient would each have been emailed.
  expect(match.eventSnapshot['email.recipient_count']).toEqual(2);

  const sentEmailCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      data: {
        path: ['emailType'],
        equals: 'DOCUMENT_COMPLETED',
      },
    },
  });

  expect(sentEmailCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a rule that turns off emails also stops the completion emails that triggered it', async () => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  const rule = await seedDisableEmailsRule({ user, emailType: 'completed' });

  await completeDocumentWithToken({
    token: recipient.token,
    id: { type: 'envelopeId', id: document.id },
  });

  await waitForEnvelopeJob({ jobId: 'send.document.completed.emails', envelopeId: document.id });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'disable_emails', status: 'ran' }]);

  const sentEmailCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      data: {
        path: ['emailType'],
        equals: 'DOCUMENT_COMPLETED',
      },
    },
  });

  expect(sentEmailCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: blocked rejection emails are not sent', async () => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  // The job marks the recipient as sent only after emailing them, which shows whether it got that far.
  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      sendStatus: SendStatus.NOT_SENT,
    },
  });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'rejected' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  await rejectDocumentWithToken({
    token: recipient.token,
    id: { type: 'envelopeId', id: document.id },
    reason: 'Not for me',
  });

  await waitForRecipientJob({ jobId: 'send.signing.rejected.emails', recipientId: recipient.id });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);

  // The recipient's confirmation and the owner's notice.
  expect(match.eventSnapshot['email.recipient_count']).toEqual(2);

  const updatedRecipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id: recipient.id,
    },
  });

  expect(updatedRecipient.sendStatus).toEqual(SendStatus.NOT_SENT);
});

test("[ADMIN][RULES][ENGINE]: a rule that turns off emails stops the rejection confirmation, but not the owner's notice", async () => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  const rule = await seedDisableEmailsRule({ user, emailType: 'rejected' });

  await rejectDocumentWithToken({
    token: recipient.token,
    id: { type: 'envelopeId', id: document.id },
    reason: 'Not for me',
  });

  await waitForRecipientJob({ jobId: 'send.signing.rejected.emails', recipientId: recipient.id });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'disable_emails', status: 'ran' }]);

  // The job sends each email in its own task. The owner's notice uses Documenso's own email, so it
  // still goes out.
  const tasks = await prisma.backgroundJobTask.findMany({
    where: {
      backgroundJob: {
        jobId: 'send.signing.rejected.emails',
        payload: {
          path: ['recipientId'],
          equals: recipient.id,
        },
      },
    },
    select: {
      name: true,
    },
  });

  const taskNames = tasks.map((task) => task.name);

  expect(taskNames).toContain('send-owner-notification-email');
  expect(taskNames).not.toContain('send-rejection-confirmation-email');
});

test('[ADMIN][RULES][ENGINE]: a blocked automatic reminder is not sent, and no more are scheduled', async () => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  // With reminders on, a reminder that goes through schedules the next one.
  await prisma.documentMeta.update({
    where: {
      id: document.documentMetaId,
    },
    data: {
      reminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    },
  });

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      sentAt: new Date(),
    },
  });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.type', operator: 'is', value: 'reminder' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  // Run the reminder job on the app server, as the reminder sweep does, and wait for it to finish.
  await jobs.triggerJob({
    name: 'internal.process-signing-reminder',
    payload: {
      recipientId: recipient.id,
    },
  });

  await waitForRecipientJob({ jobId: 'internal.process-signing-reminder', recipientId: recipient.id });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);

  // A background job has no request, so the document's source is left out rather than guessed.
  expect(match.eventSnapshot).not.toHaveProperty(['envelope.source']);

  const sentEmailCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
    },
  });

  expect(sentEmailCount).toEqual(0);

  // The block ends the recipient's automatic reminders.
  const updatedRecipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id: recipient.id,
    },
  });

  expect(updatedRecipient.nextReminderAt).toBeNull();
});

test('[ADMIN][RULES][ENGINE]: a rule that turns off emails also stops the automatic reminder that triggered it', async () => {
  const { user, team } = await seedUser();

  const document = await seedPendingDocument(user, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  // With reminders on, a reminder that goes through schedules the next one.
  await prisma.documentMeta.update({
    where: {
      id: document.documentMetaId,
    },
    data: {
      reminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    },
  });

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      sentAt: new Date(),
    },
  });

  const rule = await seedDisableEmailsRule({ user, emailType: 'reminder' });

  await jobs.triggerJob({
    name: 'internal.process-signing-reminder',
    payload: {
      recipientId: recipient.id,
    },
  });

  await waitForRecipientJob({ jobId: 'internal.process-signing-reminder', recipientId: recipient.id });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'disable_emails', status: 'ran' }]);
  expect(await countSentEmails({ envelopeId: document.id })).toEqual(0);

  const updatedRecipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id: recipient.id,
    },
  });

  expect(updatedRecipient.nextReminderAt).toBeNull();
});

test('[ADMIN][RULES][ENGINE]: reminders stop for documents owned by a disabled team member', async () => {
  const { team } = await seedUser();

  // Disabling an organisation owner turns off the whole organisation's emails, so the owner here is a member.
  const member = await seedTeamMember({ teamId: team.id });

  const document = await seedPendingDocument(member, team.id, ['recipient@example.com']);
  const [recipient] = document.recipients;

  // With reminders on, a reminder that goes through schedules the next one.
  await prisma.documentMeta.update({
    where: {
      id: document.documentMetaId,
    },
    data: {
      reminderSettings: DEFAULT_ENVELOPE_REMINDER_SETTINGS,
    },
  });

  await prisma.recipient.update({
    where: {
      id: recipient.id,
    },
    data: {
      sentAt: new Date(),
    },
  });

  await disableUser({ id: member.id });

  await jobs.triggerJob({
    name: 'internal.process-signing-reminder',
    payload: {
      recipientId: recipient.id,
    },
  });

  await waitForRecipientJob({ jobId: 'internal.process-signing-reminder', recipientId: recipient.id });

  const sentEmailCount = await prisma.documentAuditLog.count({
    where: {
      envelopeId: document.id,
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
    },
  });

  expect(sentEmailCount).toEqual(0);

  const updatedRecipient = await prisma.recipient.findFirstOrThrow({
    where: {
      id: recipient.id,
    },
  });

  expect(updatedRecipient.nextReminderAt).toBeNull();
});

test('[ADMIN][RULES][ENGINE]: a block stops a direct-link submission before anything is created', async () => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
  });

  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'envelope.source', operator: 'is', value: 'direct_link' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const error = await submitDirectLink({ template }).catch((err) => AppError.parseError(err));

  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  expect(match.actionsRun).toEqual([{ type: 'block_event', status: 'ran' }]);

  const documentCount = await prisma.envelope.count({
    where: {
      userId: user.id,
      source: DocumentSource.TEMPLATE_DIRECT_LINK,
    },
  });

  expect(documentCount).toEqual(0);
});

test("[ADMIN][RULES][ENGINE]: a blocked direct-link submission uses none of the owner's document quota", async () => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
  });

  await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [{ field: 'sender.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  // Tests skip the organisation's quota, so count it for this submission.
  const bypassRateLimits = process.env.DANGEROUS_BYPASS_RATE_LIMITS;

  process.env.DANGEROUS_BYPASS_RATE_LIMITS = 'false';

  const error = await submitDirectLink({ template })
    .then(() => null)
    .catch((err) => AppError.parseError(err))
    .finally(() => {
      process.env.DANGEROUS_BYPASS_RATE_LIMITS = bypassRateLimits ?? '';
    });

  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });

  const monthlyStat = await prisma.organisationMonthlyStat.findFirst({
    where: {
      organisationId: team.organisationId,
    },
  });

  expect(monthlyStat?.documentCount ?? 0).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: a direct-link submission is checked once, against the document it creates', async () => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
  });

  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    mode: 'MONITOR',
    definition: buildDefinition({
      conditions: [{ field: 'sender.email', operator: 'equals', value: user.email }],
      actions: [{ type: 'log_only', params: {} }],
    }),
  });

  await submitDirectLink({ template });

  const document = await prisma.envelope.findFirstOrThrow({
    where: {
      userId: user.id,
      source: DocumentSource.TEMPLATE_DIRECT_LINK,
    },
  });

  const matches = await prisma.adminRuleMatch.findMany({
    where: {
      ruleId: rule.id,
    },
  });

  // Checked before the document was created, and not again when it was sent.
  expect(matches.map((match) => match.envelopeId)).toEqual([document.id]);
});

test('[ADMIN][RULES][ENGINE]: a direct-link submission checks the signing request to a dictated next signer', async () => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
  });

  await prisma.documentMeta.update({
    where: {
      id: template.documentMetaId,
    },
    data: {
      signingOrder: DocumentSigningOrder.SEQUENTIAL,
      allowDictateNextSigner: true,
    },
  });

  // A second step for the visitor to dictate. Signers need a signature field.
  const nextRecipient = await prisma.recipient.create({
    data: {
      envelopeId: template.id,
      email: 'next@original.example',
      name: 'Next Signer',
      token: nanoid(),
      role: RecipientRole.SIGNER,
      signingOrder: 2,
    },
  });

  const envelopeItem = await prisma.envelopeItem.findFirstOrThrow({
    where: {
      envelopeId: template.id,
    },
  });

  await prisma.field.create({
    data: {
      envelopeId: template.id,
      envelopeItemId: envelopeItem.id,
      recipientId: nextRecipient.id,
      type: FieldType.SIGNATURE,
      page: 1,
      positionX: 5,
      positionY: 30,
      width: 20,
      height: 5,
      customText: '',
      inserted: false,
    },
  });

  const rule = await seedRule({
    trigger: 'EMAIL_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'email.recipient_domains', operator: 'contains', value: 'dictated.example' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const error = await submitDirectLink({
    template,
    nextSigner: {
      email: 'next@dictated.example',
      name: 'Dictated Signer',
    },
  }).catch((err) => AppError.parseError(err));

  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });

  // The visitor has signed, so only the dictated signer is emailed, in place of the template's recipient.
  expect(match.eventSnapshot['email.recipient_domains']).toEqual(['dictated.example']);
  expect(match.eventSnapshot['envelope.recipient_domains']).not.toContain('original.example');

  const documentCount = await prisma.envelope.count({
    where: {
      userId: user.id,
      source: DocumentSource.TEMPLATE_DIRECT_LINK,
    },
  });

  expect(documentCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: direct links of a disabled owner create no document', async () => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
  });

  await disableUser({ id: user.id });

  const error = await submitDirectLink({ template }).catch((err) => AppError.parseError(err));

  expect(error).toMatchObject({ code: 'ACCOUNT_DISABLED' });

  const documentCount = await prisma.envelope.count({
    where: {
      userId: user.id,
      source: DocumentSource.TEMPLATE_DIRECT_LINK,
    },
  });

  expect(documentCount).toEqual(0);
});

test('[ADMIN][RULES][ENGINE]: direct-link submissions count as documents the owner sent', async () => {
  const { user, team } = await seedUser();

  const template = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
  });

  await submitDirectLink({ template });
  await submitDirectLink({ template });

  const document = await seedDraftDocument(user, team.id, ['recipient@example.com']);

  await prisma.field.updateMany({
    where: {
      envelopeId: document.id,
    },
    data: {
      type: FieldType.SIGNATURE,
    },
  });

  // The two submissions put the owner over the limit.
  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    definition: buildDefinition({
      conditions: [
        { field: 'sender.email', operator: 'equals', value: user.email },
        { field: 'sender.documents_sent_last_24h', operator: 'greater_than', value: '1' },
      ],
      actions: [{ type: 'block_event', params: {} }],
    }),
  });

  const error = await sendDocument({
    id: { type: 'envelopeId', id: document.id },
    userId: user.id,
    teamId: team.id,
    sendEmail: false,
    requestMetadata,
  }).catch((err) => AppError.parseError(err));

  expect(error).toMatchObject({ code: 'ADMIN_RULE_BLOCKED' });

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: document.id,
    },
  });
  expect(envelope.status).toEqual('DRAFT');

  const match = await prisma.adminRuleMatch.findFirstOrThrow({
    where: {
      ruleId: rule.id,
    },
  });
  expect(match.eventSnapshot['sender.documents_sent_last_24h']).toEqual(2);
});

test('[ADMIN][RULES][ENGINE]: the cleanup job deletes matches older than the retention period', async () => {
  // Disabled and scoped to an address nobody uses, so it never runs: the matches only need a rule.
  const rule = await seedRule({
    trigger: 'DOCUMENT_SENT',
    mode: 'DISABLED',
    definition: buildDefinition({
      conditions: [{ field: 'sender.email', operator: 'equals', value: seedTestEmail() }],
      actions: [{ type: 'log_only', params: {} }],
    }),
  });

  const seedMatch = async (daysAgo: number) =>
    await prisma.adminRuleMatch.create({
      data: {
        id: generateDatabaseId('admin_rule_match'),
        createdAt: DateTime.now().minus({ days: daysAgo }).toJSDate(),
        ruleId: rule.id,
        mode: 'MONITOR',
        trigger: 'DOCUMENT_SENT',
        eventSnapshot: {},
        actionsRun: [],
      },
    });

  const expiredMatch = await seedMatch(ADMIN_RULE_MATCH_RETENTION_DAYS + 1);
  const recentMatch = await seedMatch(ADMIN_RULE_MATCH_RETENTION_DAYS - 1);

  // The job runs on the app server, as the daily schedule would run it.
  await jobs.triggerJob({
    name: 'internal.cleanup-admin-rule-matches',
    payload: {},
  });

  await expect
    .poll(
      async () =>
        await prisma.adminRuleMatch.findFirst({
          where: {
            id: expiredMatch.id,
          },
        }),
      { timeout: 15_000 },
    )
    .toBeNull();

  const keptMatch = await prisma.adminRuleMatch.findFirst({
    where: {
      id: recentMatch.id,
    },
  });

  expect(keptMatch).not.toBeNull();
});
