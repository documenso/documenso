import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TCscSessionItems } from '@documenso/lib/types/csc-session';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { isTspEnvelope } from '@documenso/lib/types/signature-level';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { PDF } from '@libpdf/core';

import { type CscDigest, policyToLibpdfSignerAlgo } from './algorithm-resolver';
import { decodeCscCertChain } from './cert-chain';
import { loadCscCredential } from './credential';
import { buildTspAnchorName, buildTspStampName } from './pdf-names';
import { renderRecipientOverlay } from './render-overlay';
import { upsertCscSession } from './sign-session';
import { CscCaptureSigner } from './signers/capture-signer';

/**
 * CSC TSP prep-phase orchestrator.
 *
 * Per envelope item:
 *
 * 1. Render the recipient's overlay into the materialised PDF in memory.
 * 2. Persist the rendered bytes as a fresh `DocumentData` row — this is the
 *    immutable byte-source the sign pass will load. Pinning the rendered PDF
 *    (rather than re-rendering at sign time) eliminates the determinism risk
 *    of running Konva twice across the OAuth round-trip.
 * 3. Reload `pdfDoc` from the persisted bytes and dry-run `pdf.sign` with
 *    `CscCaptureSigner` to derive the `signedAttrs` digest — captured over
 *    the same bytes the sign pass will load.
 *
 * The resulting `{ envelopeItemId, documentDataId, hashB64, ordinal }` tuples
 * are stored on `CscSession.itemsJson`. `documentDataId` pins the orphan
 * rendered row, not `envelopeItem.documentDataId` — the latter stays stable
 * (in-place data updates only, mirroring the materialise pattern).
 *
 * Sequential per item — PDF parse + libpdf sign is CPU-heavy and per-recipient
 * concurrency is wasted on a single Node event loop.
 */

export type PrepareCscRecipientSigningOptions = {
  /** Recipient token from `/sign/{token}` URL. */
  recipientToken: string;
  /** Forwarded for audit log attribution. */
  requestMetadata?: RequestMetadata;
};

export type PrepareCscRecipientSigningResult = {
  status: 'REDIRECT';
  redirectUrl: string;
};

export const prepareCscRecipientSigning = async (
  opts: PrepareCscRecipientSigningOptions,
): Promise<PrepareCscRecipientSigningResult> => {
  const { recipientToken, requestMetadata } = opts;

  const recipient = await prisma.recipient
    .findFirst({
      where: { token: recipientToken },
      // `signature` must be eager-loaded — `renderRecipientOverlay` runs the
      // field renderer in `export` mode, which throws `MISSING_SIGNATURE` for
      // any inserted SIGNATURE field without signature data. Mirrors the
      // include pattern in `seal-document.handler.ts`.
      include: { fields: { include: { signature: true } } },
    })
    .catch(() => null);

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Recipient with token "${recipientToken}" not found.`,
    });
  }

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: recipient.envelopeId },
    include: {
      envelopeItems: {
        include: {
          documentData: true,
        },
      },
      recipients: true,
    },
  });

  if (!isTspEnvelope(envelope)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'prepareCscRecipientSigning called for a non-TSP envelope.',
    });
  }

  const credential = await loadCscCredential(recipient.id);

  if (!credential) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'CSC credential missing — service-scope OAuth must complete first.',
    });
  }

  if (!credential.certCache) {
    throw new AppError(AppErrorCode.CSC_CERT_INVALID, {
      message: 'CSC credential has no persisted certificate chain.',
    });
  }

  if (credential.keyLenBits === null) {
    throw new AppError(AppErrorCode.CSC_ALGORITHM_REFUSED, {
      message: 'CSC credential omits persisted keyLenBits — service-scope OAuth must re-run.',
    });
  }

  const chain = decodeCscCertChain(credential.certCache);

  const algo = policyToLibpdfSignerAlgo({
    keyType: credential.keyType as 'RSA' | 'ECDSA',
    digestAlgorithm: credential.digestAlgorithm as CscDigest,
    signAlgoOid: credential.signatureAlgorithm,
    keyLenBits: credential.keyLenBits,
    // `policyToLibpdfSignerAlgo` does not read `hashAlgoOid`; passing empty
    // string keeps the synthetic policy type-correct without re-derivation.
    hashAlgoOid: '',
  });

  // Pin a single signingTime for every per-item capture so the embed pass
  // re-derives byte-identical signedAttrs digests.
  const signingTime = new Date();

  const items: TCscSessionItems = [];

  for (const envelopeItem of envelope.envelopeItems) {
    const recipientFieldsOnItem = recipient.fields.filter((field) => field.envelopeItemId === envelopeItem.id);

    const pagesWithFields = new Set<number>();

    for (const field of recipientFieldsOnItem) {
      pagesWithFields.add(field.page);
    }

    const bytes = await getFileServerSide(envelopeItem.documentData);
    const pdfDoc = await PDF.load(bytes);

    for (const pageNumber of pagesWithFields) {
      const fieldsOnPage: FieldWithSignature[] = recipientFieldsOnItem.filter((field) => field.page === pageNumber);

      await renderRecipientOverlay({
        pdfDoc,
        stampName: buildTspStampName(recipient.id, envelopeItem.id, pageNumber),
        pageNumber,
        fields: fieldsOnPage,
      });
    }

    // Persist the rendered PDF as an orphan `DocumentData` row before the
    // capture pass so sign-time can load byte-identical input — eliminates
    // the determinism risk of running Konva again after the OAuth round-trip.
    const renderedBytes = await pdfDoc.save({ incremental: true });

    const fileName = envelope.title.endsWith('.pdf') ? envelope.title : `${envelope.title || 'envelope'}.pdf`;

    const renderedUpload = await putPdfFileServerSide(
      {
        name: fileName,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(renderedBytes),
      },
      envelopeItem.documentData.initialData ?? undefined,
    );

    // Reload from the persisted bytes so the capture pass operates on the
    // exact same bytes the sign pass will fetch from storage. Skipping the
    // reload would compute the digest over an in-memory incremental update
    // that diverges from what `PDF.load(renderedBytes)` produces.
    const capturePdfDoc = await PDF.load(renderedBytes);

    const captureSigner = new CscCaptureSigner({
      certificate: chain[0],
      certificateChain: chain.slice(1),
      algo,
    });

    const anchorName = buildTspAnchorName(recipient.id, envelopeItem.id);

    // Capture at B-B even though the eventual embed pass is B-T. The B-T
    // signature timestamp is a CMS *unsigned* attribute, added by libpdf
    // after `signer.sign()` runs over the signed-attrs digest — so B-B and
    // B-T produce byte-identical signed-attrs for the same `(signer,
    // documentHash, digestAlgorithm, signingTime)` tuple. See the matching
    // note in `execute-tsp-sign.ts`.
    await capturePdfDoc.sign({
      signer: captureSigner,
      fieldName: anchorName,
      signingTime,
      level: 'B-B',
      digestAlgorithm: algo.digestAlgorithm,
    });

    if (captureSigner.capturedDigest === null) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CscCaptureSigner was not invoked by pdf.sign during prep.',
      });
    }

    items.push({
      envelopeItemId: envelopeItem.id,
      documentDataId: renderedUpload.documentData.id,
      hashB64: Buffer.from(captureSigner.capturedDigest).toString('base64'),
      ordinal: items.length,
    });
  }

  const session = await upsertCscSession({
    recipientId: recipient.id,
    envelopeId: envelope.id,
    signingTime,
    items,
  });

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_CSC_SIGN_REQUESTED,
      envelopeId: envelope.id,
      user: { name: recipient.name, email: recipient.email },
      requestMetadata,
      data: {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        providerId: credential.providerId,
        credentialId: credential.credentialId,
        sessionId: session.id,
        numSignatures: items.length,
      },
    }),
  });

  const redirectUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/csc/oauth/authorize?scope=credential&session=${session.id}`;

  return {
    status: 'REDIRECT',
    redirectUrl,
  };
};
