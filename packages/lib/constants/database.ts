/**
 * The maximum value of a Postgres `INT4` (32-bit signed integer) column, which
 * is what Prisma `Int` ID columns are stored as. Filtering an `Int` column by
 * a larger value makes Prisma throw a conversion error at runtime.
 */
export const MAX_POSTGRES_INT = 2147483647;
