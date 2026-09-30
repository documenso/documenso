import { DocumentDistributionMethod, DocumentSource, RecipientRole } from '@prisma/client';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_DOCUMENT_EMAIL_SETTINGS } from '../../../types/document-email';
import type { JobRunIO } from '../../client/_internal/job';
import { run } from './send-document-completed-emails.handler';

const mocks = vi.hoisted(() => ({
  findEnvelope: vi.fn(),
  createAuditLog: vi.fn(),
  findEnvelopeItems: vi.fn(),
  getEmailContext: vi.fn(),
  getFile: vi.fn(),
  sendMail: vi.fn(),
  checkLimits: vi.fn(),
}));

vi.mock('@documenso/prisma', () => ({
  prisma: {
    envelope: { findUnique: mocks.findEnvelope },
    envelopeItem: { findMany: mocks.findEnvelopeItems },
    documentAuditLog: { create: mocks.createAuditLog },
  },
}));
vi.mock('@documenso/email/templates/document-completed', () => ({
  DocumentCompletedEmailTemplate: () => null,
}));
vi.mock('../../../client-only/providers/i18n-server', () => ({
  getI18nInstance: async () => ({ _: () => 'Signing Complete!' }),
}));
vi.mock('../../../constants/app', () => ({ NEXT_PUBLIC_WEBAPP_URL: () => 'http://localhost:3000' }));
vi.mock('../../../server-only/email/get-email-context', () => ({ getEmailContext: mocks.getEmailContext }));
vi.mock('../../../server-only/rate-limit/assert-organisation-rates-and-limits', () => ({
  assertOrganisationRatesAndLimits: mocks.checkLimits,
}));
vi.mock('../../../universal/upload/get-file.server', () => ({ getFileServerSide: mocks.getFile }));
vi.mock('../../../utils/document-audit-logs', () => ({ createDocumentAuditLogData: (data: unknown) => data }));
vi.mock('../../../utils/teams', () => ({ formatDocumentsPath: () => '/t/test-team/documents' }));
vi.mock('../../../utils/render-email-with-i18n', () => ({
  renderEmailWithI18N: async (template: ReactElement<{ downloadLink: string }>) => template.props.downloadLink,
}));

const createEnvelope = (distributionMethod: DocumentDistributionMethod = DocumentDistributionMethod.EMAIL) => ({
  id: 'envelope_test',
  secondaryId: 'document_1',
  teamId: 1,
  internalVersion: 2,
  title: 'Confidential document',
  source: DocumentSource.DOCUMENT,
  team: { id: 1, url: 'test-team' },
  user: { id: 1, name: 'Owner', email: 'owner@example.com', disabled: false },
  documentMeta: {
    distributionMethod,
    emailSettings: { ...DEFAULT_DOCUMENT_EMAIL_SETTINGS },
  },
  envelopeItems: [
    { title: 'First document', documentData: { id: 'file_1', type: 'S3', data: 'file_1' } },
    { title: 'Second document', documentData: { id: 'file_2', type: 'BYTES', data: 'file_2' } },
  ],
  recipients: [
    { id: 2, name: 'Signer', email: 'signer@example.com', role: RecipientRole.SIGNER, token: 'signer-token' },
    { id: 3, name: 'CC', email: 'cc@example.com', role: RecipientRole.CC, token: 'cc-token' },
  ],
});

let envelope = createEnvelope();
const io = { logger: { warn: vi.fn() } } as unknown as JobRunIO;
const runJob = () => run({ payload: { envelopeId: envelope.id }, io });

beforeEach(() => {
  vi.clearAllMocks();
  envelope = createEnvelope();
  mocks.findEnvelope.mockImplementation(async () => envelope);
  mocks.findEnvelopeItems.mockImplementation(async () => envelope.envelopeItems);
  mocks.getFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mocks.getEmailContext.mockResolvedValue({
    branding: {},
    emailLanguage: 'en',
    senderEmail: 'sender@example.com',
    replyToEmail: 'reply@example.com',
    organisationId: 'org_test',
    claims: {},
    emailsDisabled: false,
    emailTransport: { sendMail: mocks.sendMail },
  });
});

describe('completion email document attachments', () => {
  it('keeps email content, links, audit logs, and CC metering when PDFs are disabled', async () => {
    envelope.documentMeta.emailSettings.attachDocument = false;
    // Loading a PDF would fail: link-only email must still succeed.
    mocks.getFile.mockRejectedValue(new Error('PDF storage unavailable'));

    await runJob();

    expect(mocks.findEnvelopeItems).not.toHaveBeenCalled();
    expect(mocks.getFile).not.toHaveBeenCalled();
    expect(mocks.sendMail).toHaveBeenCalledTimes(3);
    const emails = mocks.sendMail.mock.calls.map(([email]) => email);
    expect(emails.map((email) => email.to[0].address)).toEqual([
      'owner@example.com',
      'signer@example.com',
      'cc@example.com',
    ]);
    for (const email of emails) {
      expect(email).toMatchObject({ attachments: [], subject: 'Signing Complete!' });
      expect(email.html).toBe(email.text);
    }
    expect(emails[0].html).toBe('http://localhost:3000/t/test-team/documents/envelope_test');
    expect(emails[1].html).toBe('http://localhost:3000/sign/signer-token/complete');
    expect(emails[2].html).toBe('http://localhost:3000/sign/cc-token/complete');
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(3);
    expect(mocks.checkLimits).toHaveBeenCalledOnce();
  });

  it.each([true, undefined])('attaches all PDFs by default and when enabled (%s)', async (attachDocument) => {
    mocks.findEnvelope.mockResolvedValue({
      ...envelope,
      documentMeta: { ...envelope.documentMeta, emailSettings: { attachDocument } },
    });

    await runJob();

    expect(mocks.getFile).toHaveBeenCalledTimes(2);
    expect(mocks.sendMail).toHaveBeenCalledTimes(3);
    for (const [email] of mocks.sendMail.mock.calls) {
      expect(email.attachments).toEqual([
        { filename: 'First document.pdf', content: Buffer.from([1, 2, 3]), contentType: 'application/pdf' },
        { filename: 'Second document.pdf', content: Buffer.from([1, 2, 3]), contentType: 'application/pdf' },
      ]);
    }
  });

  it('retains legacy single-document filenames', async () => {
    envelope.internalVersion = 1;
    envelope.envelopeItems = [envelope.envelopeItems[0]];
    await runJob();
    expect(mocks.sendMail.mock.calls[0][0].attachments[0].filename).toBe('Confidential document.pdf');
  });

  it('sends link-only owner emails when recipient emails are disabled', async () => {
    envelope.documentMeta.emailSettings.attachDocument = false;
    envelope.documentMeta.emailSettings.documentCompleted = false;
    await runJob();
    expect(mocks.findEnvelopeItems).not.toHaveBeenCalled();
    expect(mocks.getFile).not.toHaveBeenCalled();
    expect(mocks.sendMail).toHaveBeenCalledOnce();
    expect(mocks.sendMail.mock.calls[0][0].to[0].address).toBe('owner@example.com');
  });

  it('sends link-only recipient emails when owner emails are disabled', async () => {
    envelope.documentMeta.emailSettings.attachDocument = false;
    envelope.documentMeta.emailSettings.ownerDocumentCompleted = false;
    await runJob();
    expect(mocks.findEnvelopeItems).not.toHaveBeenCalled();
    expect(mocks.getFile).not.toHaveBeenCalled();
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });

  it('sends a single link-only completion email when the owner is also a recipient', async () => {
    envelope.documentMeta.emailSettings.attachDocument = false;
    envelope.recipients[0].email = envelope.user.email;
    await runJob();
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({
      to: [{ address: 'owner@example.com' }],
      attachments: [],
      html: 'http://localhost:3000/t/test-team/documents/envelope_test',
    });
  });

  it('preserves owner-only link emails when distribution is NONE', async () => {
    envelope.documentMeta.distributionMethod = DocumentDistributionMethod.NONE;
    envelope.documentMeta.emailSettings.attachDocument = false;
    await runJob();
    expect(mocks.findEnvelopeItems).not.toHaveBeenCalled();
    expect(mocks.getFile).not.toHaveBeenCalled();
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });

  it('does not load PDFs or send mail when both completion emails are disabled', async () => {
    envelope.documentMeta.emailSettings.documentCompleted = false;
    envelope.documentMeta.emailSettings.ownerDocumentCompleted = false;
    await runJob();
    expect(mocks.findEnvelopeItems).not.toHaveBeenCalled();
    expect(mocks.getFile).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
