import * as React from 'react';

// Polyfill React on global for jsx transform in email rendering under vitest
(globalThis as { React?: unknown }).React = React;

import DocumentCancelTemplate from '@documenso/email/templates/document-cancel';
import { prisma } from '@documenso/prisma';
import { ReadStatus, RecipientRole, SendStatus, SigningStatus } from '@prisma/client';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as getEmailContextModule from '../../../server-only/email/get-email-context';
import * as assertRatesModule from '../../../server-only/rate-limit/assert-organisation-rates-and-limits';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import { run } from './send-document-cancelled-emails.handler';

describe('DocumentCancelTemplate rendering', () => {
  it('renders cancellation reason when provided in English', async () => {
    const template = createElement(DocumentCancelTemplate, {
      documentName: 'Contract.pdf',
      inviterName: 'Alice',
      cancellationReason: 'Terms were rejected by the client',
    });

    const text = await renderEmailWithI18N(template, { lang: 'en', plainText: true });

    expect(text).toContain('Reason for cancellation: Terms were rejected by the client');
  });

  it('does not render cancellation reason section or default fallback when reason is undefined', async () => {
    const template = createElement(DocumentCancelTemplate, {
      documentName: 'Contract.pdf',
      inviterName: 'Alice',
      cancellationReason: undefined,
    });

    const text = await renderEmailWithI18N(template, { lang: 'en', plainText: true });

    expect(text).not.toContain('Reason for cancellation');
    expect(text).not.toContain('The document has been cancelled.');
  });

  it('does not render cancellation reason section or default fallback when reason is empty string', async () => {
    const template = createElement(DocumentCancelTemplate, {
      documentName: 'Contract.pdf',
      inviterName: 'Alice',
      cancellationReason: '',
    });

    const text = await renderEmailWithI18N(template, { lang: 'en', plainText: true });

    expect(text).not.toContain('Reason for cancellation');
    expect(text).not.toContain('The document has been cancelled.');
  });

  it('renders localized cancellation reason in German when provided', async () => {
    const template = createElement(DocumentCancelTemplate, {
      documentName: 'Vertrag.pdf',
      inviterName: 'Hans',
      cancellationReason: 'Vertrag ist veraltet',
    });

    const text = await renderEmailWithI18N(template, { lang: 'de', plainText: true });

    expect(text).toContain('Stornierungsgrund: Vertrag ist veraltet');
    expect(text).not.toContain('The document has been cancelled.');
  });

  it('does not render untranslated English reason in German when reason is undefined', async () => {
    const template = createElement(DocumentCancelTemplate, {
      documentName: 'Vertrag.pdf',
      inviterName: 'Hans',
      cancellationReason: undefined,
    });

    const text = await renderEmailWithI18N(template, { lang: 'de', plainText: true });

    expect(text).not.toContain('Stornierungsgrund');
    expect(text).not.toContain('Reason for cancellation');
    expect(text).not.toContain('The document has been cancelled.');
  });
});

describe('send-document-cancelled-emails.handler run()', () => {
  const mockSendMail = vi.fn();

  const mockEnvelope = {
    id: 'envelope_123',
    title: 'Test Agreement',
    teamId: 1,
    user: {
      id: 1,
      email: 'owner@example.com',
      name: 'Owner Name',
      disabled: false,
    },
    documentMeta: {
      emailSettings: {
        documentDeleted: true,
      },
    },
    recipients: [
      {
        id: 1,
        role: RecipientRole.SIGNER,
        sendStatus: SendStatus.SENT,
        readStatus: ReadStatus.NOT_OPENED,
        signingStatus: SigningStatus.NOT_SIGNED,
        name: 'Signer Person',
        email: 'signer@example.com',
      },
    ],
    team: null,
  };

  const createEmailContext = (lang: string) =>
    ({
      branding: undefined,
      emailLanguage: lang,
      senderEmail: 'test@documenso.com',
      replyToEmail: 'reply@documenso.com',
      organisationId: 'org_1',
      claims: { recipientCount: 0 },
      emailsDisabled: false,
      emailTransport: { sendMail: mockSendMail },
    }) as unknown as Awaited<ReturnType<typeof getEmailContextModule.getEmailContext>>;

  const mockIO: JobRunIO = {
    runTask: async (_name, fn) => fn(),
    triggerJob: vi.fn(),
    wait: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(prisma.envelope, 'findFirstOrThrow').mockResolvedValue(
      mockEnvelope as unknown as Awaited<ReturnType<typeof prisma.envelope.findFirstOrThrow>>,
    );
    vi.spyOn(assertRatesModule, 'assertOrganisationRatesAndLimits').mockResolvedValue(undefined);
  });

  it('does not include fallback sentence or reason block when cancellationReason is undefined', async () => {
    vi.spyOn(getEmailContextModule, 'getEmailContext').mockResolvedValue(createEmailContext('en'));

    await run({
      payload: {
        documentId: 123,
        cancellationReason: undefined,
      },
      io: mockIO,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];

    expect(sent.text).not.toContain('Reason for cancellation');
    expect(sent.text).not.toContain('The document has been cancelled.');
    expect(sent.html).not.toContain('Reason for cancellation');
    expect(sent.html).not.toContain('The document has been cancelled.');
  });

  it('does not include fallback sentence or reason block when cancellationReason is empty string', async () => {
    vi.spyOn(getEmailContextModule, 'getEmailContext').mockResolvedValue(createEmailContext('en'));

    await run({
      payload: {
        documentId: 123,
        cancellationReason: '',
      },
      io: mockIO,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];

    expect(sent.text).not.toContain('Reason for cancellation');
    expect(sent.text).not.toContain('The document has been cancelled.');
  });

  it('does not include fallback sentence or reason block when cancellationReason is whitespace only', async () => {
    vi.spyOn(getEmailContextModule, 'getEmailContext').mockResolvedValue(createEmailContext('en'));

    await run({
      payload: {
        documentId: 123,
        cancellationReason: '   ',
      },
      io: mockIO,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];

    expect(sent.text).not.toContain('Reason for cancellation');
    expect(sent.text).not.toContain('The document has been cancelled.');
  });

  it('displays user-provided cancellation reason correctly', async () => {
    vi.spyOn(getEmailContextModule, 'getEmailContext').mockResolvedValue(createEmailContext('en'));

    await run({
      payload: {
        documentId: 123,
        cancellationReason: 'Mistake in contract terms',
      },
      io: mockIO,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];

    expect(sent.text).toContain('Reason for cancellation: Mistake in contract terms');
    expect(sent.text).not.toContain('The document has been cancelled.');
  });

  it('does not include untranslated English text in non-English cancellation emails when no reason is given', async () => {
    vi.spyOn(getEmailContextModule, 'getEmailContext').mockResolvedValue(createEmailContext('de'));

    await run({
      payload: {
        documentId: 123,
        cancellationReason: undefined,
      },
      io: mockIO,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];

    expect(sent.text).not.toContain('Stornierungsgrund');
    expect(sent.text).not.toContain('Reason for cancellation');
    expect(sent.text).not.toContain('The document has been cancelled.');
  });

  it('includes properly translated reason section in non-English emails when reason is provided', async () => {
    vi.spyOn(getEmailContextModule, 'getEmailContext').mockResolvedValue(createEmailContext('de'));

    await run({
      payload: {
        documentId: 123,
        cancellationReason: 'Vertrag ist veraltet',
      },
      io: mockIO,
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];

    expect(sent.text).toContain('Stornierungsgrund: Vertrag ist veraltet');
    expect(sent.text).not.toContain('The document has been cancelled.');
  });
});
