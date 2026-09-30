import { DocumentDistributionMethod, type DocumentMeta } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { extractDerivedDocumentMeta } from '../utils/document';
import { generateDefaultOrganisationSettings } from '../utils/organisations';
import { extractDerivedTeamSettings, generateDefaultTeamSettings } from '../utils/teams';
import {
  DEFAULT_DOCUMENT_EMAIL_SETTINGS,
  extractDerivedDocumentEmailSettings,
  ZDocumentEmailSettingsInputSchema,
  ZDocumentEmailSettingsSchema,
} from './document-email';
import { ZDocumentMetaCreateSchema, ZDocumentMetaUpdateSchema } from './document-meta';

describe('document email attachments', () => {
  it('keeps attachments enabled for absent and legacy settings', () => {
    expect(extractDerivedDocumentEmailSettings().attachDocument).toBe(true);
    expect(ZDocumentEmailSettingsSchema.parse(null).attachDocument).toBe(true);
    expect(ZDocumentEmailSettingsInputSchema.parse({ documentCompleted: false })).toMatchObject({
      attachDocument: true,
      documentCompleted: false,
    });
  });

  it('disables attachments independently of notification events', () => {
    expect(ZDocumentEmailSettingsInputSchema.parse({ attachDocument: false })).toEqual({
      ...DEFAULT_DOCUMENT_EMAIL_SETTINGS,
      attachDocument: false,
    });
  });

  it.each(['false', 0, null, [], {}])('rejects invalid attachment values: %j', (attachDocument) => {
    expect(ZDocumentEmailSettingsInputSchema.safeParse({ attachDocument }).success).toBe(false);
    expect(ZDocumentMetaCreateSchema.safeParse({ emailSettings: { attachDocument } }).success).toBe(false);
    expect(ZDocumentMetaUpdateSchema.safeParse({ emailSettings: { attachDocument } }).success).toBe(false);
  });

  it('does not replace an explicit opt-out with defaults when another input is invalid', () => {
    expect(
      ZDocumentMetaCreateSchema.safeParse({
        emailSettings: { attachDocument: false, documentCompleted: 'true' },
      }).success,
    ).toBe(false);
  });

  it('preserves the owner attachment setting when email distribution is disabled', () => {
    const settings = extractDerivedDocumentEmailSettings({
      distributionMethod: DocumentDistributionMethod.NONE,
      emailSettings: { ...DEFAULT_DOCUMENT_EMAIL_SETTINGS, attachDocument: false },
    } as DocumentMeta);

    expect(settings).toMatchObject({
      attachDocument: false,
      documentCompleted: false,
      ownerDocumentCompleted: true,
    });
  });

  it('inherits organisation defaults, allows team overrides, and restores inheritance', () => {
    const organisationSettings = generateDefaultOrganisationSettings();
    organisationSettings.emailDocumentSettings = { ...DEFAULT_DOCUMENT_EMAIL_SETTINGS, attachDocument: false };
    const teamSettings = generateDefaultTeamSettings();

    const inherited = extractDerivedTeamSettings(organisationSettings, teamSettings);
    expect(extractDerivedDocumentMeta(inherited, undefined).emailSettings.attachDocument).toBe(false);

    teamSettings.emailDocumentSettings = { ...DEFAULT_DOCUMENT_EMAIL_SETTINGS, attachDocument: true };
    const overridden = extractDerivedTeamSettings(organisationSettings, teamSettings);
    expect(extractDerivedDocumentMeta(overridden, undefined).emailSettings.attachDocument).toBe(true);

    teamSettings.emailDocumentSettings = null;
    expect(
      extractDerivedDocumentMeta(extractDerivedTeamSettings(organisationSettings, teamSettings), undefined)
        .emailSettings.attachDocument,
    ).toBe(false);
  });

  it('allows a document or template to override inherited attachment defaults in either direction', () => {
    const settings = generateDefaultOrganisationSettings();

    expect(
      extractDerivedDocumentMeta(settings, {
        emailSettings: { ...DEFAULT_DOCUMENT_EMAIL_SETTINGS, attachDocument: false },
      }).emailSettings.attachDocument,
    ).toBe(false);

    settings.emailDocumentSettings = { ...DEFAULT_DOCUMENT_EMAIL_SETTINGS, attachDocument: false };
    expect(
      extractDerivedDocumentMeta(settings, {
        emailSettings: { ...DEFAULT_DOCUMENT_EMAIL_SETTINGS, attachDocument: true },
      }).emailSettings.attachDocument,
    ).toBe(true);
  });
});
