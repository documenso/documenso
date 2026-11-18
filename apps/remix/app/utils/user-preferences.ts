import { z } from 'zod';

export const ZFolderSortSchema = z.enum(['created-desc', 'created-asc', 'name-asc', 'name-desc']);

export type TFolderSortValue = z.infer<typeof ZFolderSortSchema>;

/**
 * Stored in the `user-preferences` cookie and exposed through `useUserPreferences`.
 *
 * Every field must be optional, since updates only send the fields that changed.
 */
export const ZUserPreferencesSchema = z.object({
  folderSort: ZFolderSortSchema.optional(),
});

export type TUserPreferences = z.infer<typeof ZUserPreferencesSchema>;

/**
 * Reads the stored cookie. An invalid field (e.g. a removed sort option) discards
 * every preference, not just that field.
 */
export const parseUserPreferences = (value: unknown): TUserPreferences => {
  const result = ZUserPreferencesSchema.safeParse(value);

  return result.success ? result.data : {};
};
