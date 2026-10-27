import { prisma } from '@documenso/prisma';
import type { Prisma } from '@prisma/client';
import { EmailSuppressionScope } from '@prisma/client';

export type EmailSuppressionSender = {
  organisationId: string;
  teamId?: number;

  /**
   * The user the email is sent on behalf of. For envelope emails this is the envelope owner.
   */
  userId?: number;

  /**
   * The sending user's own address is never suppressed, so they still receive
   * emails about documents they send to themselves.
   */
  userEmail?: string;
};

export type IsEmailSuppressedOptions = {
  email: string;
  sender: EmailSuppressionSender;
};

/**
 * Only use this for emails a sender triggers to someone else, such as signing requests,
 * reminders and invites. Account and security emails (password resets, email
 * verification, 2FA codes) must always be sent.
 */
export const isEmailSuppressed = async ({ email, sender }: IsEmailSuppressedOptions) => {
  const suppressedEmails = await findSuppressedEmails({ emails: [email], sender });

  return suppressedEmails.size > 0;
};

export type ExcludeSuppressedRecipientsOptions<T extends { email: string }> = {
  recipients: T[];
  sender: EmailSuppressionSender;
};

/**
 * Batched version of `isEmailSuppressed`, returning the recipients that can still be emailed.
 */
export const excludeSuppressedRecipients = async <T extends { email: string }>({
  recipients,
  sender,
}: ExcludeSuppressedRecipientsOptions<T>) => {
  const suppressedEmails = await findSuppressedEmails({
    emails: recipients.map((recipient) => recipient.email),
    sender,
  });

  return recipients.filter((recipient) => !suppressedEmails.has(normaliseEmail(recipient.email)));
};

type FindSuppressedEmailsOptions = {
  emails: string[];
  sender: EmailSuppressionSender;
};

const findSuppressedEmails = async ({ emails, sender }: FindSuppressedEmailsOptions) => {
  const sendingUserEmail = sender.userEmail ? normaliseEmail(sender.userEmail) : null;

  const candidateEmails = [...new Set(emails.map(normaliseEmail))].filter((email) => email !== sendingUserEmail);

  if (candidateEmails.length === 0) {
    return new Set<string>();
  }

  // Scopes are only added when the sender is known. Passing `teamId: undefined` to
  // Prisma would drop the filter and match every team's suppressions.
  const matchingScopes: Prisma.EmailSuppressionWhereInput[] = [
    { scope: EmailSuppressionScope.GLOBAL },
    { scope: EmailSuppressionScope.ORGANISATION, organisationId: sender.organisationId },
  ];

  if (sender.teamId !== undefined) {
    matchingScopes.push({ scope: EmailSuppressionScope.TEAM, teamId: sender.teamId });
  }

  if (sender.userId !== undefined) {
    matchingScopes.push({ scope: EmailSuppressionScope.USER, userId: sender.userId });
  }

  const suppressions = await prisma.emailSuppression.findMany({
    where: {
      email: {
        in: candidateEmails,
      },
      OR: matchingScopes,
    },
    select: {
      email: true,
    },
  });

  return new Set(suppressions.map((suppression) => suppression.email));
};

const normaliseEmail = (email: string) => email.trim().toLowerCase();
