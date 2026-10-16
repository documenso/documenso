import { describe, expect, it } from 'vitest';

import type { TBulkSendCsvError, TValidateBulkSendCsvResult } from './validate-bulk-send-csv';
import { validateBulkSendCsv } from './validate-bulk-send-csv';

const buildCsv = (headers: string[], rows: string[][]) =>
  [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

const expectFailure = (result: TValidateBulkSendCsvResult): TBulkSendCsvError => {
  if (result.success) {
    throw new Error('Expected validation to fail, but it passed');
  }

  return result.error;
};

describe('validateBulkSendCsv', () => {
  describe('valid CSVs', () => {
    it('returns the parsed rows for a valid CSV', () => {
      const csvContent = buildCsv(
        ['recipient_1_email', 'recipient_1_name'],
        [
          ['alice@example.com', 'Alice'],
          ['bob@example.com', 'Bob'],
        ],
      );

      const result = validateBulkSendCsv({ csvContent, recipientCount: 1 });

      expect(result).toEqual({
        success: true,
        data: [
          { recipient_1_email: 'alice@example.com', recipient_1_name: 'Alice' },
          { recipient_1_email: 'bob@example.com', recipient_1_name: 'Bob' },
        ],
      });
    });

    it('allows an empty string email so template defaults can be used', () => {
      const csvContent = buildCsv(['recipient_1_email', 'recipient_1_name'], [['', 'Alice']]);

      const result = validateBulkSendCsv({ csvContent, recipientCount: 1 });

      expect(result.success).toBe(true);
    });

    it('allows the optional name column to be omitted entirely', () => {
      const csvContent = buildCsv(['recipient_1_email'], [['alice@example.com']]);

      const result = validateBulkSendCsv({ csvContent, recipientCount: 1 });

      expect(result.success).toBe(true);
    });

    it('allows unknown extra columns', () => {
      const csvContent = buildCsv(['recipient_1_email', 'unrelated_column'], [['alice@example.com', 'anything']]);

      const result = validateBulkSendCsv({ csvContent, recipientCount: 1 });

      expect(result.success).toBe(true);
    });

    it('validates columns for every configured recipient', () => {
      const csvContent = buildCsv(
        ['recipient_1_email', 'recipient_2_email'],
        [['alice@example.com', 'bob@example.com']],
      );

      const result = validateBulkSendCsv({ csvContent, recipientCount: 2 });

      expect(result.success).toBe(true);
    });

    it('allows exactly the maximum number of rows', () => {
      const csvContent = buildCsv(
        ['recipient_1_email'],
        Array.from({ length: 100 }, (_, index) => [`user${index}@example.com`]),
      );

      const result = validateBulkSendCsv({ csvContent, recipientCount: 1 });

      expect(result.success).toBe(true);
    });
  });

  describe('PARSE_ERROR', () => {
    it('rejects a CSV that cannot be parsed', () => {
      const csvContent = 'recipient_1_email\n"unclosed quote';

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1 }));

      expect(error).toEqual({ type: 'PARSE_ERROR' });
    });

    it('rejects a CSV with inconsistent column counts', () => {
      const csvContent = buildCsv(
        ['recipient_1_email', 'recipient_1_name'],
        [['alice@example.com', 'Alice', 'unexpected-extra-value']],
      );

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1 }));

      expect(error).toEqual({ type: 'PARSE_ERROR' });
    });
  });

  describe('EMPTY', () => {
    it('rejects an empty file', () => {
      const error = expectFailure(validateBulkSendCsv({ csvContent: '', recipientCount: 1 }));

      expect(error).toEqual({ type: 'EMPTY' });
    });

    it('rejects a CSV containing only a header row', () => {
      const csvContent = buildCsv(['recipient_1_email', 'recipient_1_name'], []);

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1 }));

      expect(error).toEqual({ type: 'EMPTY' });
    });
  });

  describe('ROW_LIMIT_EXCEEDED', () => {
    it('rejects a CSV exceeding the default limit of 100 rows', () => {
      const csvContent = buildCsv(
        ['recipient_1_email'],
        Array.from({ length: 101 }, (_, index) => [`user${index}@example.com`]),
      );

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1 }));

      expect(error).toEqual({ type: 'ROW_LIMIT_EXCEEDED', rowCount: 101, maxRows: 100 });
    });

    it('respects a custom maxRows option', () => {
      const csvContent = buildCsv(['recipient_1_email'], [['alice@example.com'], ['bob@example.com']]);

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1, maxRows: 1 }));

      expect(error).toEqual({ type: 'ROW_LIMIT_EXCEEDED', rowCount: 2, maxRows: 1 });
    });
  });

  describe('MISSING_COLUMNS', () => {
    it('rejects a CSV missing a required email column', () => {
      const csvContent = buildCsv(['recipient_1_name'], [['Alice']]);

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1 }));

      expect(error).toEqual({ type: 'MISSING_COLUMNS', missingColumns: ['recipient_1_email'] });
    });

    it('reports every missing column', () => {
      const csvContent = buildCsv(['recipient_1_email'], [['alice@example.com']]);

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 3 }));

      expect(error).toEqual({
        type: 'MISSING_COLUMNS',
        missingColumns: ['recipient_2_email', 'recipient_3_email'],
      });
    });
  });

  describe('INVALID_RECIPIENTS', () => {
    it('rejects a CSV containing an invalid email', () => {
      const csvContent = buildCsv(['recipient_1_email'], [['not-an-email']]);

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1 }));

      expect(error).toMatchObject({
        type: 'INVALID_RECIPIENTS',
        rowErrors: [{ row: 1, column: 'recipient_1_email' }],
      });
    });

    it('references the offending row and column', () => {
      const csvContent = buildCsv(['recipient_1_email'], [['alice@example.com'], ['not-an-email']]);

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 1 }));

      expect(error).toMatchObject({
        type: 'INVALID_RECIPIENTS',
        rowErrors: [{ row: 2, column: 'recipient_1_email' }],
      });
    });

    it('aggregates errors across multiple rows and recipients', () => {
      const csvContent = buildCsv(
        ['recipient_1_email', 'recipient_2_email'],
        [
          ['not-an-email', 'bob@example.com'],
          ['alice@example.com', 'also-not-an-email'],
        ],
      );

      const error = expectFailure(validateBulkSendCsv({ csvContent, recipientCount: 2 }));

      expect(error).toMatchObject({
        type: 'INVALID_RECIPIENTS',
        rowErrors: [
          { row: 1, column: 'recipient_1_email' },
          { row: 2, column: 'recipient_2_email' },
        ],
      });
    });
  });
});
