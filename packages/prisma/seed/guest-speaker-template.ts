import fs from 'node:fs';
import path from 'node:path';

import { incrementTemplateId } from '@documenso/lib/server-only/envelope/increment-id';
import {
  FIELD_DATE_META_DEFAULT_VALUES,
  FIELD_NAME_META_DEFAULT_VALUES,
  FIELD_SIGNATURE_META_DEFAULT_VALUES,
  FIELD_TEXT_META_DEFAULT_VALUES,
} from '@documenso/lib/types/field-meta';
import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { prefixedId } from '@documenso/lib/universal/id';

import { prisma } from '..';
import {
  DocumentDataType,
  DocumentSigningOrder,
  DocumentSource,
  EnvelopeType,
  FieldType,
  ReadStatus,
  RecipientRole,
  SendStatus,
  SigningStatus,
  TemplateType,
} from '../client';

/**
 * Reusable "Guest Speaker form" template (psd401/documenso#46).
 *
 * Provisions a single organisation-wide Documenso template so building staff can
 * start a guest-speaker submission without rebuilding the document each time. The
 * template routes to two signers in order (requesting staff, then a building
 * administrator for approval) and ships with the signature/name/date fields
 * pre-placed on the form.
 *
 * The PDF asset and the field coordinates below are kept in sync with
 * scripts/generate-guest-speaker-pdf.cjs. Positions are percentages of the page
 * (0-100, top-left origin) — see packages/lib/server-only/pdf/insert-field-in-pdf-v1.ts.
 */

const GUEST_SPEAKER_PDF_PATH = path.join(__dirname, '../../../assets/guest-speaker-form.pdf');

export const GUEST_SPEAKER_TEMPLATE_TITLE = 'Guest Speaker Request & Approval Form';

/** Placeholder recipients. Staff fill in the real signer details per submission. */
export const REQUESTING_STAFF_EMAIL = 'requesting.staff@documenso.placeholder';
export const ADMINISTRATOR_EMAIL = 'building.administrator@documenso.placeholder';

type SignerKey = 'staff' | 'administrator';

type TemplateFieldSpec = {
  signer: SignerKey;
  type: FieldType;
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  fieldMeta: TFieldMetaSchema;
};

/**
 * Field layout, expressed as percentages of the page. Each entry overlays a line
 * or labelled blank drawn by the PDF generator.
 */
const TEMPLATE_FIELDS: TemplateFieldSpec[] = [
  // Event details — filled in by the requesting staff member.
  staffText(32.68, 18.69, 'Speaker Name'),
  staffText(32.68, 23.11, 'Speaker Organization'),
  staffText(32.68, 27.53, 'Presentation Topic'),
  staffText(32.68, 31.94, 'Presentation Date(s)'),
  staffText(32.68, 36.36, 'Building / School'),

  // Requesting staff signature block.
  {
    signer: 'staff',
    type: FieldType.SIGNATURE,
    page: 1,
    positionX: 9.8,
    positionY: 53.03,
    width: 39.22,
    height: 5.05,
    fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
  },
  {
    signer: 'staff',
    type: FieldType.NAME,
    page: 1,
    positionX: 52.29,
    positionY: 55.56,
    width: 37.91,
    height: 2.53,
    fieldMeta: FIELD_NAME_META_DEFAULT_VALUES,
  },
  {
    signer: 'staff',
    type: FieldType.DATE,
    page: 1,
    positionX: 9.8,
    positionY: 61.24,
    width: 39.22,
    height: 2.53,
    fieldMeta: FIELD_DATE_META_DEFAULT_VALUES,
  },

  // Building administrator approval block.
  {
    signer: 'administrator',
    type: FieldType.SIGNATURE,
    page: 1,
    positionX: 9.8,
    positionY: 72.6,
    width: 39.22,
    height: 5.05,
    fieldMeta: FIELD_SIGNATURE_META_DEFAULT_VALUES,
  },
  {
    signer: 'administrator',
    type: FieldType.NAME,
    page: 1,
    positionX: 52.29,
    positionY: 75.13,
    width: 37.91,
    height: 2.53,
    fieldMeta: FIELD_NAME_META_DEFAULT_VALUES,
  },
  {
    signer: 'administrator',
    type: FieldType.DATE,
    page: 1,
    positionX: 9.8,
    positionY: 80.81,
    width: 39.22,
    height: 2.53,
    fieldMeta: FIELD_DATE_META_DEFAULT_VALUES,
  },
];

function staffText(positionX: number, positionY: number, label: string): TemplateFieldSpec {
  return {
    signer: 'staff',
    type: FieldType.TEXT,
    page: 1,
    positionX,
    positionY,
    width: 57.52,
    height: 2.53,
    fieldMeta: { ...FIELD_TEXT_META_DEFAULT_VALUES, label, required: true },
  };
}

export type ProvisionGuestSpeakerTemplateOptions = {
  /** Team the template belongs to. */
  teamId: number;
  /** User recorded as the template owner. */
  userId: number;
  /** Override the template title (defaults to the standard form name). */
  title?: string;
  /** Create a fresh copy even if a same-titled template already exists in the team. */
  force?: boolean;
};

/**
 * Idempotent by default: if a template with the same title already exists in the
 * team it is returned untouched, so re-running (e.g. across environments) is safe.
 */
export const provisionGuestSpeakerTemplate = async (
  options: ProvisionGuestSpeakerTemplateOptions,
) => {
  const { teamId, userId, title = GUEST_SPEAKER_TEMPLATE_TITLE, force = false } = options;

  if (!force) {
    const existing = await prisma.envelope.findFirst({
      where: { type: EnvelopeType.TEMPLATE, teamId, title },
    });

    if (existing) {
      return { template: existing, created: false };
    }
  }

  const pdfBase64 = fs.readFileSync(GUEST_SPEAKER_PDF_PATH).toString('base64');

  // incrementTemplateId uses its own internal prisma counter — keep it outside the
  // transaction so a rollback doesn't leave the counter in an inconsistent state.
  // Skipped counter values are harmless.
  const templateId = await incrementTemplateId();

  const template = await prisma.$transaction(async (tx) => {
    const documentData = await tx.documentData.create({
      data: {
        type: DocumentDataType.BYTES_64,
        data: pdfBase64,
        initialData: pdfBase64,
      },
    });

    const documentMeta = await tx.documentMeta.create({
      data: {
        signingOrder: DocumentSigningOrder.SEQUENTIAL,
        subject: 'Guest Speaker Request & Approval',
        message:
          'Please review and sign the guest speaker request. It will route to the building administrator for approval once you sign.',
      },
    });

    const createdEnvelope = await tx.envelope.create({
      data: {
        id: prefixedId('envelope'),
        secondaryId: templateId.formattedTemplateId,
        internalVersion: 1,
        type: EnvelopeType.TEMPLATE,
        title,
        templateType: TemplateType.ORGANISATION,
        publicTitle: 'Guest Speaker Request & Approval Form',
        publicDescription:
          'Submit a guest speaker request and route it for the required signatures.',
        source: DocumentSource.TEMPLATE,
        documentMetaId: documentMeta.id,
        userId,
        teamId,
        envelopeItems: {
          create: {
            id: prefixedId('envelope_item'),
            title,
            documentDataId: documentData.id,
            order: 1,
          },
        },
        recipients: {
          create: [
            {
              email: REQUESTING_STAFF_EMAIL,
              name: 'Requesting Staff Member',
              token: prefixedId('recipient'),
              signingOrder: 1,
              role: RecipientRole.SIGNER,
              sendStatus: SendStatus.NOT_SENT,
              signingStatus: SigningStatus.NOT_SIGNED,
              readStatus: ReadStatus.NOT_OPENED,
            },
            {
              email: ADMINISTRATOR_EMAIL,
              name: 'Building Administrator',
              token: prefixedId('recipient'),
              signingOrder: 2,
              role: RecipientRole.APPROVER,
              sendStatus: SendStatus.NOT_SENT,
              signingStatus: SigningStatus.NOT_SIGNED,
              readStatus: ReadStatus.NOT_OPENED,
            },
          ],
        },
      },
      include: {
        recipients: true,
        envelopeItems: true,
      },
    });

    const envelopeItem = createdEnvelope.envelopeItems[0];
    const recipientBySigner: Record<SignerKey, number> = {
      staff: getRecipientId(createdEnvelope.recipients, REQUESTING_STAFF_EMAIL),
      administrator: getRecipientId(createdEnvelope.recipients, ADMINISTRATOR_EMAIL),
    };

    await tx.field.createMany({
      data: TEMPLATE_FIELDS.map((field) => ({
        envelopeId: createdEnvelope.id,
        envelopeItemId: envelopeItem.id,
        recipientId: recipientBySigner[field.signer],
        type: field.type,
        page: field.page,
        positionX: field.positionX,
        positionY: field.positionY,
        width: field.width,
        height: field.height,
        customText: '',
        inserted: false,
        fieldMeta: field.fieldMeta,
      })),
    });

    return createdEnvelope;
  });

  return { template, created: true };
};

function getRecipientId(recipients: { id: number; email: string }[], email: string): number {
  const recipient = recipients.find((item) => item.email === email);

  if (!recipient) {
    throw new Error(`Could not find seeded recipient for ${email}`);
  }

  return recipient.id;
}

/** Resolve the owner user for a team, falling back to the organisation owner. */
const resolveOwnerUserId = async (teamId: number): Promise<number> => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { organisation: { select: { ownerUserId: true } } },
  });

  if (!team) {
    throw new Error(`Team ${teamId} not found`);
  }

  return team.organisation.ownerUserId;
};

const parseArgs = (argv: string[]) => {
  const args: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];

    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const teamId = Number(args.team);

  if (!Number.isInteger(teamId) || teamId <= 0) {
    console.error(
      'Usage: npx tsx packages/prisma/seed/guest-speaker-template.ts --team <teamId> [--owner <userId>] [--title "..."] [--force]',
    );
    process.exit(1);
  }

  const userId = args.owner ? Number(args.owner) : await resolveOwnerUserId(teamId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`Invalid owner user id: ${String(args.owner)}`);
  }

  const result = await provisionGuestSpeakerTemplate({
    teamId,
    userId,
    title: typeof args.title === 'string' ? args.title : undefined,
    force: args.force === true,
  });

  if (result.created) {
    console.log(
      `Created Guest Speaker template "${result.template.title}" (${result.template.id}) for team ${teamId}.`,
    );
  } else {
    console.log(
      `Guest Speaker template already exists for team ${teamId} (${result.template.id}); use --force to create another.`,
    );
  }
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
