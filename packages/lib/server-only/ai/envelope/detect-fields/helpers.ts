import type { DetectedField } from './schema';
import type { NormalizedField, RecipientContext } from './types';

/**
 * Build a message providing recipient context to the AI.
 */
export const buildRecipientContextMessage = (recipients: RecipientContext[]) => {
  if (recipients.length === 0) {
    return 'No recipients have been specified for this document. Leave recipientKey empty for all fields.';
  }

  const recipientList = recipients.map((r) => `- ${formatRecipientKey(r)}`).join('\n');

  return `The following recipients will sign/fill this document. Use their recipientKey when assigning fields:

${recipientList}

When you detect a field that should be filled by a specific recipient (based on nearby labels like "Tenant Signature", "Landlord", "Buyer", etc.), set the recipientKey to match one of the above. If no recipient can be determined, leave recipientKey empty.`;
};

/**
 * Format recipient key as id|name|email for AI context.
 */
export const formatRecipientKey = (recipient: RecipientContext) => {
  return `${recipient.id}|${recipient.name}|${recipient.email}`;
};

/**
 * Parse recipientKey (format: id|name|email) and find matching recipient.
 *
 * Matching logic:
 * 1. Match on id === id
 * 2. OR match on email && name === email && name
 * 3. If no match or empty key, use first recipient
 * 4. If no recipients, return null (caller creates blank recipient)
 */
export const resolveRecipientFromKey = (recipientKey: string, recipients: RecipientContext[]) => {
  if (recipients.length === 0) {
    return null;
  }

  // Empty key defaults to first recipient
  if (!recipientKey) {
    return recipients[0];
  }

  // Parse the key format: id|name|email
  const [idStr, name, email] = recipientKey.split('|');

  const id = Number(idStr);

  // Try to match by ID first
  if (!Number.isNaN(id)) {
    const matchById = recipients.find((r) => r.id === id);

    if (matchById) {
      return matchById;
    }
  }

  // Try to match by email AND name
  if (email && name) {
    const matchByEmailAndName = recipients.find((r) => r.email === email && r.name === name);

    if (matchByEmailAndName) {
      return matchByEmailAndName;
    }
  }

  // No match found, default to first recipient
  return recipients[0];
};

/**
 * Convert AI's 0-1000 bounding box to our 0-100 percentage format.
 */
export const normalizeDetectedField = (field: DetectedField): NormalizedField => {
  const { box2d } = field;

  const [yMin, xMin, yMax, xMax] = box2d;

  return {
    type: field.type,
    recipientKey: field.recipientKey,
    positionX: xMin / 10,
    positionY: yMin / 10,
    width: (xMax - xMin) / 10,
    height: (yMax - yMin) / 10,
    confidence: field.confidence,
  };
};
