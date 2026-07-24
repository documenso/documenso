import { prisma } from '@documenso/prisma';
import { DocumentDistributionMethod } from '@prisma/client';

import { deriveEffectiveReminderSettings, type TEnvelopeReminderSettings } from '../../constants/envelope-reminder';

/**
 * Resolve the *effective* reminder settings for an envelope by walking the
 * Document -> Team -> Organisation cascade.
 *
 * This is the single source of truth used by every reminder scheduling path
 * (first send, settings-change recompute, auto-reminder follow-ups). Callers
 * must NOT read `documentMeta.reminderSettings` directly and treat `null` as
 * disabled — `null` on a document means "inherit", not "off".
 *
 * Rules enforced here:
 *   - An explicit document-level value always wins (enabled or disabled).
 *   - When the document inherits, the team override (if any) applies, then the
 *     organisation default.
 *   - A disabled config (`{ sendAfter: { disabled: true }, ... }`) is a real
 *     override and is returned as-is.
 *   - Manually distributed envelopes (`DocumentDistributionMethod.NONE`) never
 *     get email reminders, regardless of the cascade result.
 *   - If no level is configured, reminders are disabled (returns `null`).
 */
export const resolveEnvelopeReminderSettings = async (
  envelopeId: string,
): Promise<TEnvelopeReminderSettings | null> => {
  const envelope = await prisma.envelope.findFirst({
    where: { id: envelopeId },
    select: {
      documentMeta: {
        select: {
          reminderSettings: true,
          distributionMethod: true,
        },
      },
      team: {
        select: {
          teamGlobalSettings: {
            select: {
              reminderSettings: true,
            },
          },
          organisation: {
            select: {
              organisationGlobalSettings: {
                select: {
                  reminderSettings: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!envelope?.documentMeta) {
    return null;
  }

  // Manually distributed documents (link sharing) never send email reminders.
  if (envelope.documentMeta.distributionMethod === DocumentDistributionMethod.NONE) {
    return null;
  }

  return deriveEffectiveReminderSettings({
    documentReminderSettings: envelope.documentMeta.reminderSettings,
    teamReminderSettings: envelope.team?.teamGlobalSettings?.reminderSettings,
    organisationReminderSettings: envelope.team?.organisation?.organisationGlobalSettings?.reminderSettings,
  });
};
