import type { DataContent, Prisma } from '@prisma/client';

import { generateDatabaseId } from '../../universal/id';

/**
 * Build the create input for a copy of a data content.
 *
 * The copy references the same stored file as the source. Stored files are
 * never deleted, only their records, so sharing them between records is safe
 * and mirrors how document data is duplicated.
 */
export const buildDataContentCloneInput = (
  source: Pick<DataContent, 'type' | 'data' | 'metadata'>,
): Prisma.DataContentCreateManyInput => ({
  id: generateDatabaseId('data'),
  type: source.type,
  data: source.data,
  metadata: source.metadata,
});
