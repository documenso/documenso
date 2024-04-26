import type { getCompletedFieldsForToken } from '../server-only/field/get-completed-fields-for-token';

export type CompletedField = Awaited<ReturnType<typeof getCompletedFieldsForToken>>[number];
