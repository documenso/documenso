import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The rejection handlers must write `Envelope.status = REJECTED` inside the
 * SAME `$transaction` that flips the recipient — previously only the async
 * seal job wrote it, so a 200 from the reject endpoint left the envelope
 * PENDING and the PENDING-keyed guards kept letting other recipients act
 * (#3287).
 *
 * These are source-contract tests: the transaction composition is what the
 * fix is, and it is directly inspectable in the handler source (the module
 * needs a generated prisma client to import, which unit CI doesn't have).
 */
describe('rejection writes the envelope status in the same transaction (#3287)', () => {
  const read = (p: string) =>
    readFileSync(resolve(__dirname, p), 'utf-8');

  it('the behalf-of path includes an envelope.update to REJECTED in the transaction', () => {
    const src = read('./reject-document-on-behalf-of.ts');
    const tx = src.slice(src.indexOf('$transaction'), src.indexOf(']);', src.indexOf('$transaction')));
    expect(tx).toContain('prisma.envelope.update');
    expect(tx).toContain('status: DocumentStatus.REJECTED');
    // The envelope flip precedes the recipient flip (same transaction; order
    // is not semantic but keeps the diff readable).
    expect(tx.indexOf('prisma.envelope.update')).toBeLessThan(tx.indexOf('prisma.recipient.update'));
  });

  it('the recipient-token path includes the same flip', () => {
    const src = read('./reject-document-with-token.ts');
    const tx = src.slice(src.indexOf('$transaction'), src.indexOf(']);', src.indexOf('$transaction')));
    expect(tx).toContain('prisma.envelope.update');
    expect(tx).toContain('status: DocumentStatus.REJECTED');
  });

  it('the seal job remains the stamped-PDF producer (idempotent status write)', () => {
    const src = read('../../jobs/definitions/internal/seal-document.handler.ts');
    expect(src).toContain('finalEnvelopeStatus');
    expect(src).toContain('DocumentStatus.REJECTED');
  });
});
