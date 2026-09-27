import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../errors/app-error';

import { assertAssistantCompatibleSigningOrder } from './assert-assistant-compatible-signing-order';

const here = dirname(fileURLToPath(import.meta.url));

describe('assertAssistantCompatibleSigningOrder', () => {
  it('rejects an ASSISTANT recipient on a parallel-signing envelope', () => {
    expect(() =>
      assertAssistantCompatibleSigningOrder({
        role: RecipientRole.ASSISTANT,
        signingOrder: DocumentSigningOrder.PARALLEL,
      }),
    ).toThrowError(AppError);
  });

  it('treats a null or undefined signing order as parallel, the persisted default', () => {
    for (const signingOrder of [null, undefined]) {
      expect(() =>
        assertAssistantCompatibleSigningOrder({ role: RecipientRole.ASSISTANT, signingOrder }),
      ).toThrowError(/sequential signing/);
    }
  });

  it('accepts an ASSISTANT recipient on a sequential-signing envelope', () => {
    expect(() =>
      assertAssistantCompatibleSigningOrder({
        role: RecipientRole.ASSISTANT,
        signingOrder: DocumentSigningOrder.SEQUENTIAL,
      }),
    ).not.toThrow();
  });

  it('leaves every other role unaffected by the signing order', () => {
    for (const role of [RecipientRole.SIGNER, RecipientRole.CC, RecipientRole.VIEWER, RecipientRole.APPROVER]) {
      expect(() =>
        assertAssistantCompatibleSigningOrder({ role, signingOrder: DocumentSigningOrder.PARALLEL }),
      ).not.toThrow();
    }
  });
});

describe('assistant signing-order guard wiring', () => {
  const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

  it('createEnvelopeRecipients checks the candidate role against the envelope order', () => {
    const source = read('../recipient/create-envelope-recipients.ts');

    expect(source).toContain("import { assertAssistantCompatibleSigningOrder }");
    expect(source).toMatch(
      /assertAssistantCompatibleSigningOrder\(\{\s*role: recipient\.role,\s*signingOrder: envelope\.documentMeta\?\.signingOrder,\s*\}\)/,
    );
    expect(source).toMatch(/include:\s*\{\s*recipients:\s*true,\s*documentMeta:\s*true,/);
  });

  it('updateEnvelopeRecipients checks a role change against the envelope order', () => {
    const source = read('../recipient/update-envelope-recipients.ts');

    expect(source).toContain("import { assertAssistantCompatibleSigningOrder }");
    expect(source).toMatch(
      /assertAssistantCompatibleSigningOrder\(\{\s*role: recipient\.role,\s*signingOrder: envelope\.documentMeta\?\.signingOrder,\s*\}\)/,
    );
  });

  it('updateEnvelope refuses flipping an assistant-bearing envelope to parallel', () => {
    const source = read('../envelope/update-envelope.ts');

    expect(source).toContain("import { assertAssistantCompatibleSigningOrder }");
    expect(source).toMatch(
      /recipient\.role === RecipientRole\.ASSISTANT[\s\S]{0,200}assertAssistantCompatibleSigningOrder\(\{\s*role: RecipientRole\.ASSISTANT,\s*signingOrder: meta\.signingOrder,\s*\}\)/,
    );
  });
});
