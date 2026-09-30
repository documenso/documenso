import { describe, expect, it } from 'vitest';
import { ZCreateDocumentMutationSchema, ZGenerateDocumentFromTemplateMutationSchema } from '../../api/v1/schema';
import { ZCreateDocumentPayloadSchema } from '../../trpc/server/document-router/create-document.types';
import { ZCreateEnvelopePayloadSchema } from '../../trpc/server/envelope-router/create-envelope.types';
import { ZUpdateEnvelopeRequestSchema } from '../../trpc/server/envelope-router/update-envelope.types';
import { ZUseEnvelopePayloadSchema } from '../../trpc/server/envelope-router/use-envelope.types';
import { ZUpdateOrganisationSettingsRequestSchema } from '../../trpc/server/organisation-router/update-organisation-settings.types';
import { ZUpdateTeamSettingsRequestSchema } from '../../trpc/server/team-router/update-team-settings.types';
import {
  ZCreateDocumentFromTemplateRequestSchema,
  ZCreateTemplateV2RequestSchema,
} from '../../trpc/server/template-router/schema';

const requestCases = [
  {
    name: 'v1 document creation',
    schema: ZCreateDocumentMutationSchema,
    body: { title: 'Document', recipients: [] },
    field: 'meta',
  },
  {
    name: 'v1 template use',
    schema: ZGenerateDocumentFromTemplateMutationSchema,
    body: { recipients: [] },
    field: 'meta',
  },
  { name: 'document creation', schema: ZCreateDocumentPayloadSchema, body: { title: 'Document' }, field: 'meta' },
  {
    name: 'envelope creation',
    schema: ZCreateEnvelopePayloadSchema,
    body: { title: 'Document', type: 'DOCUMENT' },
    field: 'meta',
  },
  {
    name: 'envelope update',
    schema: ZUpdateEnvelopeRequestSchema,
    body: { envelopeId: 'envelope_test' },
    field: 'meta',
  },
  {
    name: 'envelope template use',
    schema: ZUseEnvelopePayloadSchema,
    body: { envelopeId: 'envelope_test' },
    field: 'override',
  },
  { name: 'template creation', schema: ZCreateTemplateV2RequestSchema, body: { title: 'Template' }, field: 'meta' },
  {
    name: 'document from template',
    schema: ZCreateDocumentFromTemplateRequestSchema,
    body: { templateId: 1, recipients: [] },
    field: 'override',
  },
] as const;

describe.each(requestCases)('$name email settings API', ({ schema, body, field }) => {
  it.each([true, false])('accepts and retains attachDocument=%s', (attachDocument) => {
    const request = { ...body, [field]: { emailSettings: { attachDocument } } };
    const result = schema.parse(request);
    expect(result).toMatchObject({ [field]: { emailSettings: { attachDocument } } });
  });

  it('rejects non-boolean attachment controls instead of enabling attachments', () => {
    const request = { ...body, [field]: { emailSettings: { attachDocument: 'false' } } };
    expect(schema.safeParse(request).success).toBe(false);
  });
});

describe('default email settings API', () => {
  it.each([true, false])('retains organisation and team attachment defaults (%s)', (attachDocument) => {
    expect(
      ZUpdateOrganisationSettingsRequestSchema.parse({
        organisationId: 'org_test',
        data: { emailDocumentSettings: { attachDocument } },
      }),
    ).toMatchObject({ data: { emailDocumentSettings: { attachDocument } } });
    expect(
      ZUpdateTeamSettingsRequestSchema.parse({ teamId: 1, data: { emailDocumentSettings: { attachDocument } } }),
    ).toMatchObject({ data: { emailDocumentSettings: { attachDocument } } });
  });

  it('rejects malformed organisation and team defaults', () => {
    expect(
      ZUpdateOrganisationSettingsRequestSchema.safeParse({
        organisationId: 'org_test',
        data: { emailDocumentSettings: { attachDocument: 'false' } },
      }).success,
    ).toBe(false);
    expect(
      ZUpdateTeamSettingsRequestSchema.safeParse({
        teamId: 1,
        data: { emailDocumentSettings: { attachDocument: 'false' } },
      }).success,
    ).toBe(false);
  });

  it('retains null as the team inheritance control', () => {
    expect(ZUpdateTeamSettingsRequestSchema.parse({ teamId: 1, data: { emailDocumentSettings: null } })).toMatchObject({
      data: { emailDocumentSettings: null },
    });
  });
});
