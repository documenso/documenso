import { DocumentDistributionMethod, DocumentSource, RecipientRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@documenso/email/mailer', () => ({
  mailer: {
    sendMail: (...args: unknown[]) => sendMailMock(...args),
  },
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelope: {
      findUnique: vi.fn(),
    },
    documentAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../../../server-only/email/get-email-context', () => ({
  getEmailContext: vi.fn().mockResolvedValue({
    branding: {},
    emailLanguage: 'en',
    senderEmail: 'Documenso <noreply@documenso.com>',
    replyToEmail: 'noreply@documenso.com',
  }),
}));

vi.mock('../../../universal/upload/get-file.server', () => ({
  getFileServerSide: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
}));

vi.mock('../../../client-only/providers/i18n-server', () => ({
  getI18nInstance: vi.fn().mockResolvedValue({
    _: (message: string | { id?: string }) =>
      typeof message === 'string' ? message : (message?.id ?? 'Signing Complete!'),
  }),
}));

vi.mock('../../../utils/render-email-with-i18n', () => ({
  renderEmailWithI18N: vi.fn().mockResolvedValue('<html>test</html>'),
}));

vi.mock('@lingui/core/macro', () => ({
  msg: (strings: TemplateStringsArray) => strings[0] ?? '',
}));

import { prisma } from '@documenso/prisma';

import { run } from './send-document-completed-emails.handler';

const owner = {
  id: 1,
  email: 'example@documenso.com',
  name: 'Example User',
};

const signer = {
  id: 10,
  email: 'signer@test.documenso.com',
  name: 'Test Signer',
  role: RecipientRole.SIGNER,
  token: 'signer-token',
};

const ccRecipient = {
  id: 11,
  email: 'cc@test.documenso.com',
  name: 'Test CC',
  role: RecipientRole.CC,
  token: 'cc-token',
};

const buildEnvelope = (documentMeta: Record<string, unknown>) => ({
  id: 'envelope_test_2887',
  title: 'Neel_Manro_Resume.pdf',
  internalVersion: 1,
  source: DocumentSource.DOCUMENT,
  teamId: 1,
  userId: owner.id,
  documentMeta,
  recipients: [signer, ccRecipient],
  user: owner,
  team: { id: 1, url: 'personal_team' },
  envelopeItems: [
    {
      title: 'Neel_Manro_Resume.pdf',
      documentData: {
        type: 'BYTES_64',
        id: 'docdata_1',
        data: '',
      },
    },
  ],
});

const getSentAddresses = () =>
  sendMailMock.mock.calls.map((call) => {
    const mailOptions = call[0] as { to: { address: string } | { address: string }[] };
    const recipients = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];

    return recipients.map((recipient) => recipient.address);
  });

const hasPdfAttachment = (callIndex: number) => {
  const mailOptions = sendMailMock.mock.calls[callIndex]?.[0] as {
    attachments?: { contentType?: string }[];
  };

  return mailOptions.attachments?.some((attachment) => attachment.contentType === 'application/pdf') ?? false;
};

describe('send-document-completed-emails.handler', () => {
  beforeEach(() => {
    sendMailMock.mockClear();
    vi.mocked(prisma.envelope.findUnique).mockReset();
    vi.mocked(prisma.documentAuditLog.create).mockClear();
  });

  it('emails signer and CC when document completed emails are enabled', async () => {
    vi.mocked(prisma.envelope.findUnique).mockResolvedValue(
      buildEnvelope({
        distributionMethod: DocumentDistributionMethod.EMAIL,
        emailSettings: {
          documentCompleted: true,
          ownerDocumentCompleted: true,
        },
      }) as never,
    );

    await run({
      payload: { envelopeId: 'envelope_test_2887' },
      io: {} as never,
    });

    const allAddresses = getSentAddresses().flat();

    expect(allAddresses).toContain('signer@test.documenso.com');
    expect(allAddresses).toContain('cc@test.documenso.com');
    expect(sendMailMock).toHaveBeenCalled();
    expect(hasPdfAttachment(0)).toBe(true);
  });

  it('emails CC (not signer) when distribution is NONE but owner completion emails are enabled', async () => {
    vi.mocked(prisma.envelope.findUnique).mockResolvedValue(
      buildEnvelope({
        distributionMethod: DocumentDistributionMethod.NONE,
        emailSettings: {
          documentCompleted: true,
          ownerDocumentCompleted: true,
        },
      }) as never,
    );

    await run({
      payload: { envelopeId: 'envelope_test_2887' },
      io: {} as never,
    });

    const allAddresses = getSentAddresses().flat();

    expect(allAddresses).toContain('example@documenso.com');
    expect(allAddresses).toContain('cc@test.documenso.com');
    expect(allAddresses).not.toContain('signer@test.documenso.com');
  });

  it('emails owner separately when owner is not a recipient and recipient emails are off', async () => {
    vi.mocked(prisma.envelope.findUnique).mockResolvedValue(
      buildEnvelope({
        distributionMethod: DocumentDistributionMethod.EMAIL,
        emailSettings: {
          documentCompleted: false,
          ownerDocumentCompleted: true,
        },
      }) as never,
    );

    await run({
      payload: { envelopeId: 'envelope_test_2887' },
      io: {} as never,
    });

    const allAddresses = getSentAddresses().flat();

    expect(allAddresses).toContain('example@documenso.com');
    expect(allAddresses).toContain('cc@test.documenso.com');
    expect(allAddresses).not.toContain('signer@test.documenso.com');
  });
});
