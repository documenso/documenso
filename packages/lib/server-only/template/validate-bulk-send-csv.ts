import { parse } from 'csv-parse/sync';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { zEmail } from '../../utils/zod';

const ZRecipientRowSchema = z.object({
  name: z.string().optional(),
  email: z.union([
    zEmail('Value must be a valid email or empty string'),
    z.string().max(0, { message: 'Value must be a valid email or empty string' }),
  ]),
});

export type TBulkSendCsvRow = Record<string, string | undefined>;

export type TBulkSendCsvRowError = {
  /**
   * The 1-indexed row number the error occurred on, excluding the header row.
   */
  row: number;

  /**
   * The column the error occurred in, such as `recipient_1_email`.
   */
  column: string;

  message: string;
};

export type TBulkSendCsvError =
  | { type: 'PARSE_ERROR' }
  | { type: 'EMPTY' }
  | { type: 'ROW_LIMIT_EXCEEDED'; rowCount: number; maxRows: number }
  | { type: 'MISSING_COLUMNS'; missingColumns: string[] }
  | { type: 'INVALID_RECIPIENTS'; rowErrors: TBulkSendCsvRowError[] };

export type TValidateBulkSendCsvResult =
  | { success: true; data: TBulkSendCsvRow[] }
  | { success: false; error: TBulkSendCsvError };

export type ValidateBulkSendCsvOptions = {
  csvContent: string;

  /**
   * The number of recipients configured on the template, used to derive the
   * required `recipient_N_email` columns.
   */
  recipientCount: number;

  maxRows?: number;
};

/**
 * Validate the CSV provided for a template bulk send.
 *
 * Returns a discriminated union so callers can surface structured error
 * details, such as which rows contain invalid recipients.
 */
export const validateBulkSendCsv = ({
  csvContent,
  recipientCount,
  maxRows = 100,
}: ValidateBulkSendCsvOptions): TValidateBulkSendCsvResult => {
  let rows: TBulkSendCsvRow[];

  try {
    rows = parse(csvContent, { columns: true, skip_empty_lines: true });
  } catch {
    return { success: false, error: { type: 'PARSE_ERROR' } };
  }

  if (rows.length === 0) {
    return { success: false, error: { type: 'EMPTY' } };
  }

  if (rows.length > maxRows) {
    return { success: false, error: { type: 'ROW_LIMIT_EXCEEDED', rowCount: rows.length, maxRows } };
  }

  const csvHeaders = Object.keys(rows[0]);

  const requiredHeaders = Array.from({ length: recipientCount }, (_, index) => `recipient_${index + 1}_email`);

  const missingColumns = requiredHeaders.filter((header) => !csvHeaders.includes(header));

  if (missingColumns.length > 0) {
    return { success: false, error: { type: 'MISSING_COLUMNS', missingColumns } };
  }

  const rowErrors: TBulkSendCsvRowError[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    for (let recipientIndex = 0; recipientIndex < recipientCount; recipientIndex += 1) {
      const nameKey = `recipient_${recipientIndex + 1}_name`;
      const emailKey = `recipient_${recipientIndex + 1}_email`;

      const parsed = ZRecipientRowSchema.safeParse({
        name: row[nameKey],
        email: row[emailKey],
      });

      if (!parsed.success) {
        rowErrors.push({
          row: rowIndex + 1,
          column: emailKey,
          message: parsed.error.issues?.[0]?.message ?? 'Invalid value',
        });
      }
    }
  }

  if (rowErrors.length > 0) {
    return { success: false, error: { type: 'INVALID_RECIPIENTS', rowErrors } };
  }

  return { success: true, data: rows };
};

/**
 * Format a bulk send CSV validation error into a readable string for logging
 * and internal error messages.
 */
export const formatBulkSendCsvError = (error: TBulkSendCsvError): string =>
  match(error)
    .with({ type: 'PARSE_ERROR' }, () => 'The CSV could not be parsed')
    .with({ type: 'EMPTY' }, () => 'The CSV contains no rows')
    .with(
      { type: 'ROW_LIMIT_EXCEEDED' },
      ({ rowCount, maxRows }) => `The CSV contains ${rowCount} rows, a maximum of ${maxRows} rows is allowed`,
    )
    .with(
      { type: 'MISSING_COLUMNS' },
      ({ missingColumns }) => `The CSV is missing required columns: ${missingColumns.join(', ')}`,
    )
    .with(
      { type: 'INVALID_RECIPIENTS' },
      ({ rowErrors }) =>
        `The CSV contains invalid recipient data: ${rowErrors
          .map((rowError) => `Row ${rowError.row}: ${rowError.column} - ${rowError.message}`)
          .join('; ')}`,
    )
    .exhaustive();
