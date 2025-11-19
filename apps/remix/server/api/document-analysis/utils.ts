import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { logger } from '@documenso/lib/utils/logger';

/**
 * Process an array of items in parallel and handle failures gracefully.
 * Returns successful results and reports failed items.
 */
export async function processPageBatch<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput, index: number) => Promise<TOutput>,
  context: {
    itemName: string; // e.g., "page", "recipient"
    getItemIdentifier: (item: TInput, index: number) => number | string; // e.g., pageNumber
    errorMessage: string; // User-facing error message
  },
): Promise<{
  results: TOutput[];
  failedItems: Array<number | string>;
}> {
  const settledResults = await Promise.allSettled(
    items.map(async (item, index) => processor(item, index)),
  );

  const results: TOutput[] = [];
  const failedItems: Array<number | string> = [];

  for (const [index, result] of settledResults.entries()) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      const identifier = context.getItemIdentifier(items[index]!, index);
      logger.error(`Failed to process ${context.itemName} ${identifier}:`, {
        error: result.reason,
        identifier,
      });
      failedItems.push(identifier);
    }
  }

  if (failedItems.length > 0) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `Failed to process ${context.itemName}s: ${failedItems.join(', ')}`,
      userMessage: context.errorMessage,
    });
  }

  return { results, failedItems: [] };
}

/**
 * Safely execute an LLM generation with proper error handling and logging.
 */
export async function safeGenerateObject<T>(
  generatorFn: () => Promise<{ object: T }>,
  context: {
    operation: string; // e.g., "detect form fields", "analyze recipients"
    pageNumber?: number;
  },
): Promise<T> {
  try {
    const result = await generatorFn();
    return result.object;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const pageContext = context.pageNumber ? ` on page ${context.pageNumber}` : '';

    logger.error(`Failed to ${context.operation}${pageContext}:`, {
      error: errorMessage,
      pageNumber: context.pageNumber,
    });

    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: `AI generation failed for ${context.operation}: ${errorMessage}`,
      userMessage: `Unable to ${context.operation}. Please try again.`,
    });
  }
}

/**
 * Sort recipients by role priority and signing order for consistent field assignment.
 */
export function sortRecipientsForDetection<
  T extends { role: string; signingOrder: number | null; id: number },
>(recipients: T[]): T[] {
  const ROLE_PRIORITY: Record<string, number> = {
    SIGNER: 0,
    APPROVER: 1,
    CC: 2,
  };

  return recipients.slice().sort((a, b) => {
    // 1. Sort by role priority
    const roleComparison = (ROLE_PRIORITY[a.role] ?? 3) - (ROLE_PRIORITY[b.role] ?? 3);
    if (roleComparison !== 0) {
      return roleComparison;
    }

    // 2. Sort by signing order (null values last)
    const aOrder = a.signingOrder ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.signingOrder ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    // 3. Sort by ID as final tiebreaker
    return a.id - b.id;
  });
}

/**
 * Build a recipient directory string for LLM context.
 */
export function buildRecipientDirectory(
  recipients: Array<{
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    signingOrder: number | null;
  }>,
): string {
  return recipients
    .map((recipient, index) => {
      const name = recipient.name?.trim() || `Recipient ${index + 1}`;
      const details = [`name: "${name}"`, `role: ${recipient.role}`];

      if (recipient.email) {
        details.push(`email: ${recipient.email}`);
      }

      if (typeof recipient.signingOrder === 'number') {
        details.push(`signingOrder: ${recipient.signingOrder}`);
      }

      return `ID ${recipient.id} → ${details.join(', ')}`;
    })
    .join('\n');
}

/**
 * Validate and correct recipient IDs to ensure they match available recipients.
 */
export function validateRecipientId(
  fieldRecipientId: number,
  availableRecipientIds: Set<number>,
  fallbackRecipientId: number,
  context?: { fieldLabel?: string },
): number {
  if (availableRecipientIds.has(fieldRecipientId)) {
    return fieldRecipientId;
  }

  logger.error('AI returned invalid recipientId for detected field', {
    invalidRecipientId: fieldRecipientId,
    fieldLabel: context?.fieldLabel,
    availableRecipientIds: Array.from(availableRecipientIds),
  });

  throw new AppError(AppErrorCode.INVALID_REQUEST, {
    message: `AI assigned field "${context?.fieldLabel || 'Unknown'}" to invalid recipient ID ${fieldRecipientId}`,
    userMessage:
      'We detected fields assigned to a recipient that does not exist. Please try again.',
  });
}
