import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { sendPendingEmail } from '@documenso/lib/server-only/document/send-pending-email';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { triggerWebhook } from '@documenso/lib/server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { mapEnvelopeToWebhookDocumentPayload, ZWebhookDocumentSchema } from '@documenso/lib/types/webhook-payload';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { putPdfFileServerSide } from '@documenso/lib/universal/upload/put-file.server';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';
import { PDF } from '@libpdf/core';
import {
  type DocumentDataType,
  EnvelopeType,
  RecipientRole,
  SendStatus,
  SigningStatus,
  WebhookTriggerEvents,
} from '@prisma/client';

import { type CscDigest, hashOidForDigest, policyToLibpdfSignerAlgo } from './algorithm-resolver';
import { decodeCscCertChain } from './cert-chain';
import { decryptCscToken } from './ciphers';
import { cscSignHash } from './client/signatures';
import { loadCscCredential } from './credential';
import { buildTspAnchorName } from './pdf-names';
import { consumeCscSession, loadCscSession } from './sign-session';
import { CscCaptureSigner } from './signers/capture-signer';
import { CscFifoSigner } from './signers/fifo-signer';
import { getCscTransport } from './transport';
import { resolveCscSignTimeTsa } from './tsa-resolver';

/**
 * CSC TSP sign-time orchestrator.
 *
 * Two-pass run, both passes operating on the same prep-time-persisted PDF
 * bytes (`CscSession.items[i].documentDataId` pins an immutable rendered
 * orphan row — see `prepare-recipient-signing.ts`):
 *
 * 1. Capture re-derives each item's `signedAttrs` digest under the
 *    session-pinned `signingTime` and asserts it matches the prep-time hash
 *    bit-for-bit. Defense in depth — the bytes are identical so a mismatch
 *    means libpdf changed between prep and sign or the row was tampered
 *    with. Throws `CSC_BASE_DOCUMENT_MUTATED` on divergence.
 * 2. A single batched `signatures/signHash` (§11.9) returns position-ordered
 *    signatures that the embed pass writes back into the same anchors via
 *    `CscFifoSigner`.
 *
 * Output bytes are in-place-copied onto `envelopeItem.documentData` (the
 * row id stays stable; only `type` + `data` change) — same pattern as
 * `materializeTspAnchorsForEnvelope`. The uploaded rows from
 * `putPdfFileServerSide` orbit as orphans.
 *
 * Persistence is bundled into one outer transaction so document-content
 * updates, recipient signing-status, audit log, and session consume commit
 * atomically. Post-tx side effects (webhooks, emails) run after.
 */

export type ExecuteTspSignOptions = {
  sessionId: string;
  recipientToken: string;
  requestMetadata?: RequestMetadata;
};

export type ExecuteTspSignResult = { outcome: 'signed' } | { outcome: 'already_signed' };

type CapturedItem = {
  envelopeItemId: string;
  recapturedDigestB64: string;
  anchorName: string;
  pdfBytes: Uint8Array;
};

type SignedItemDataUpdate = {
  /** Existing `envelopeItem.documentDataId` — receives the in-place data update. */
  envelopeItemDataId: string;
  /** Payload to copy onto the existing row. */
  uploadedType: DocumentDataType;
  uploadedData: string;
};

export const executeTspSign = async (opts: ExecuteTspSignOptions): Promise<ExecuteTspSignResult> => {
  const { sessionId, recipientToken, requestMetadata } = opts;

  const session = await loadCscSession(sessionId);

  if (!session) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `CSC session "${sessionId}" not found.`,
    });
  }

  const recipient = await getRecipientByToken({ token: recipientToken }).catch(() => null);

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: `Recipient with token "${recipientToken}" not found.`,
    });
  }

  if (recipient.id !== session.recipientId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'CSC session does not belong to the recipient identified by token.',
    });
  }

  // Idempotency: a 15s tRPC timeout that races with a successful sign can
  // leave the client retrying after the recipient row already flipped to
  // SIGNED. Return success rather than re-running.
  if (recipient.signingStatus === SigningStatus.SIGNED) {
    return { outcome: 'already_signed' };
  }

  if (!session.encryptedSad || !session.sadExpiresAt) {
    throw new AppError(AppErrorCode.CSC_SAD_EXPIRED_PRE_SIGN, {
      message: 'CSC session has no attached SAD — credential-scope OAuth must complete first.',
    });
  }

  if (session.sadExpiresAt.getTime() <= Date.now()) {
    throw new AppError(AppErrorCode.CSC_SAD_EXPIRED_PRE_SIGN, {
      message: 'CSC SAD expired before sign-time execution.',
    });
  }

  const sad = decryptCscToken(session.encryptedSad);

  if (!sad) {
    throw new AppError(AppErrorCode.CSC_SAD_EXPIRED_PRE_SIGN, {
      message: 'CSC SAD decrypt failed — key rotation or row corruption.',
    });
  }

  const credential = await loadCscCredential(recipient.id);

  if (!credential) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'CSC credential missing at sign time.',
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

  if (!credential.serviceTokenCiphertext || !credential.serviceTokenExpiresAt) {
    throw new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: 'CSC credential has no persisted service token — recipient must re-auth.',
    });
  }

  if (credential.serviceTokenExpiresAt.getTime() <= Date.now()) {
    throw new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: 'CSC service token expired — recipient must re-auth via service-scope OAuth.',
    });
  }

  const serviceToken = decryptCscToken(credential.serviceTokenCiphertext);

  if (!serviceToken) {
    throw new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: 'CSC service token decrypt failed — operator re-auth required.',
    });
  }

  const chain = decodeCscCertChain(credential.certCache);

  const algo = policyToLibpdfSignerAlgo({
    keyType: credential.keyType as 'RSA' | 'ECDSA',
    digestAlgorithm: credential.digestAlgorithm as CscDigest,
    signAlgoOid: credential.signatureAlgorithm,
    keyLenBits: credential.keyLenBits,
    hashAlgoOid: '',
  });

  const envelope = await prisma.envelope.findUniqueOrThrow({
    where: { id: session.envelopeId },
    include: {
      envelopeItems: { include: { documentData: true } },
      recipients: true,
      documentMeta: true,
    },
  });

  // Capture pass: iterate session.items in order so the resulting hash array
  // is position-bound to session.items[*].ordinal.
  const capturedItems: CapturedItem[] = [];

  for (let i = 0; i < session.items.length; i++) {
    const sessionItem = session.items[i];

    const envelopeItem = envelope.envelopeItems.find((item) => item.id === sessionItem.envelopeItemId);

    if (!envelopeItem) {
      throw new AppError(AppErrorCode.CSC_BASE_DOCUMENT_MUTATED, {
        message: `Session references envelope item "${sessionItem.envelopeItemId}" not on envelope.`,
      });
    }

    const pinnedDocumentData = await prisma.documentData.findUniqueOrThrow({
      where: { id: sessionItem.documentDataId },
    });

    const bytes = await getFileServerSide(pinnedDocumentData);
    const pdfDoc = await PDF.load(bytes);

    const captureSigner = new CscCaptureSigner({
      certificate: chain[0],
      certificateChain: chain.slice(1),
      algo,
    });

    const anchorName = buildTspAnchorName(recipient.id, envelopeItem.id);

    // Capture pass stays at B-B even though the embed pass below is B-T:
    // libpdf's B-T signature timestamp is added as a CMS *unsigned*
    // attribute *after* `signer.sign()` runs over the signed-attrs digest.
    // The signed-attrs builder (see CAdESDetachedBuilder.create in
    // @libpdf/core) takes only (signer, documentHash, digestAlgorithm,
    // signingTime) — no level-conditional attributes — so B-B and B-T
    // produce byte-identical signed-attrs for the same inputs. Capturing
    // at B-B avoids dragging the TSA into the dry-run.
    await pdfDoc.sign({
      signer: captureSigner,
      fieldName: anchorName,
      signingTime: session.signingTime,
      level: 'B-B',
      digestAlgorithm: algo.digestAlgorithm,
    });

    if (captureSigner.capturedDigest === null) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CscCaptureSigner was not invoked by pdf.sign during sign-time capture.',
      });
    }

    const recapturedDigestB64 = Buffer.from(captureSigner.capturedDigest).toString('base64');

    if (recapturedDigestB64 !== sessionItem.hashB64) {
      throw new AppError(AppErrorCode.CSC_BASE_DOCUMENT_MUTATED, {
        message: `Re-derived signedAttrs digest at sign time diverged from prep-time hash for envelope item "${envelopeItem.id}".`,
      });
    }

    capturedItems.push({
      envelopeItemId: envelopeItem.id,
      recapturedDigestB64,
      anchorName,
      pdfBytes: bytes,
    });
  }

  // Defensive: session-item / captured-item position binding must hold.
  for (let i = 0; i < capturedItems.length; i++) {
    if (capturedItems[i].envelopeItemId !== session.items[i].envelopeItemId) {
      throw new AppError(AppErrorCode.CSC_EMBED_FAILED, {
        message: 'Capture-pass item ordering diverged from session-pinned ordering.',
      });
    }
  }

  if (capturedItems.length === 0) {
    throw new AppError(AppErrorCode.CSC_EMBED_FAILED, {
      message: 'CSC session contains no items — nothing to sign.',
    });
  }

  const hashes = capturedItems.map((c) => c.recapturedDigestB64);
  // The cscSignHash request schema requires a non-empty tuple; the explicit
  // check above narrows the array literal for the type system.
  const [firstHash, ...restHashes] = hashes;

  const transport = await getCscTransport();

  const signHashResp = await cscSignHash({
    baseUrl: transport.serviceBaseUrl,
    accessToken: serviceToken,
    credentialID: credential.credentialId,
    SAD: sad,
    hash: [firstHash, ...restHashes],
    signAlgo: credential.signatureAlgorithm,
    hashAlgo: hashOidForDigest(algo.digestAlgorithm),
  });

  if (signHashResp.signatures.length !== capturedItems.length) {
    throw new AppError(AppErrorCode.CSC_EMBED_FAILED, {
      message: `CSC signHash returned ${signHashResp.signatures.length} signatures for ${capturedItems.length} hashes.`,
    });
  }

  // Embed pass: per-item, reload the same prep-persisted PDF bytes and sign
  // with a single-signature FIFO signer. No re-render — bytes are exactly
  // the ones whose digest the TSP just authorised. Level is B-T: each
  // recipient's CMS gets a TSA-attested signature timestamp embedded as an
  // unsigned attribute, binding proven time to the signature itself (the
  // actual eIDAS AES/QES requirement). The TSA is resolved per-recipient
  // via the sign-time resolver — TSP if advertised (authorised with this
  // recipient's service-scope bearer), env otherwise.
  const timestampAuthority = resolveCscSignTimeTsa(transport, serviceToken);

  const signedItemDataUpdates: SignedItemDataUpdate[] = [];

  for (let i = 0; i < capturedItems.length; i++) {
    const captured = capturedItems[i];
    const sigBytes = Buffer.from(signHashResp.signatures[i], 'base64');

    const pdfDoc = await PDF.load(captured.pdfBytes);

    const fifoSigner = new CscFifoSigner({
      certificate: chain[0],
      certificateChain: chain.slice(1),
      algo,
      signatures: [sigBytes],
    });

    const signResult = await pdfDoc.sign({
      signer: fifoSigner,
      fieldName: captured.anchorName,
      signingTime: session.signingTime,
      level: 'B-T',
      timestampAuthority,
      digestAlgorithm: algo.digestAlgorithm,
    });

    const envelopeItem = envelope.envelopeItems.find((item) => item.id === captured.envelopeItemId);

    if (!envelopeItem) {
      throw new AppError(AppErrorCode.CSC_EMBED_FAILED, {
        message: `Envelope item "${captured.envelopeItemId}" missing during embed pass.`,
      });
    }

    const fileName = envelope.title.endsWith('.pdf') ? envelope.title : `${envelope.title || 'envelope'}.pdf`;

    const uploaded = await putPdfFileServerSide(
      {
        name: fileName,
        type: 'application/pdf',
        arrayBuffer: async () => Promise.resolve(signResult.bytes),
      },
      envelopeItem.documentData.initialData ?? undefined,
    );

    // In-place data update target: the existing envelopeItem.documentDataId
    // row. `uploaded.documentData` is the freshly-created row whose payload
    // we'll copy on; that row stays orphan after the copy. Mirrors the
    // `materializeTspAnchorsForEnvelope` pattern.
    signedItemDataUpdates.push({
      envelopeItemDataId: envelopeItem.documentDataId,
      uploadedType: uploaded.documentData.type,
      uploadedData: uploaded.documentData.data,
    });
  }

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  // Single tx: per-item in-place data updates + recipient flip + audit log +
  // session consume. Atomic across items — if any write fails, the recipient
  // stays unsigned and the session row stays attached. `envelopeItem.
  // documentDataId` is preserved across the run; only `documentData.{type,
  // data}` changes. Mirrors `materializeTspAnchorsForEnvelope`.
  await prisma.$transaction(async (tx) => {
    for (const { envelopeItemDataId, uploadedType, uploadedData } of signedItemDataUpdates) {
      await tx.documentData.update({
        where: { id: envelopeItemDataId },
        data: { type: uploadedType, data: uploadedData },
      });
    }

    await tx.recipient.update({
      where: { id: recipient.id },
      data: {
        signingStatus: SigningStatus.SIGNED,
        signedAt: new Date(),
      },
    });

    const authOptions = extractDocumentAuthMethods({
      documentAuth: envelope.authOptions,
      recipientAuth: recipient.authOptions,
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
        envelopeId: envelope.id,
        user: {
          name: recipient.name,
          email: recipient.email,
        },
        requestMetadata,
        data: {
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientId: recipient.id,
          recipientRole: recipient.role,
          actionAuth: authOptions.derivedRecipientActionAuth,
        },
      }),
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_CSC_SIGNED,
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
          sessionId,
          numItemsSigned: signedItemDataUpdates.length,
          signatureAlgorithm: credential.signatureAlgorithm,
          digestAlgorithm: credential.digestAlgorithm,
        },
      }),
    });

    await consumeCscSession(sessionId, tx);
  });

  // Post-tx side effects (webhooks, emails, next-signer advancement, seal
  // job dispatch). Inlined rather than shared with the SES completion path —
  // the in-tx shape diverges enough (TSP swaps documentDataIds + consumes
  // the CSC session; SES doesn't) that a shared helper would obscure both.
  const envelopeWithRelations = await prisma.envelope.findUniqueOrThrow({
    where: { id: envelope.id },
    include: { documentMeta: true, recipients: true },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_RECIPIENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(envelopeWithRelations)),
    userId: envelope.userId,
    teamId: envelope.teamId,
  });

  await jobs.triggerJob({
    name: 'send.recipient.signed.email',
    payload: {
      documentId: legacyDocumentId,
      recipientId: recipient.id,
    },
  });

  const pendingRecipients = await prisma.recipient.findMany({
    select: {
      id: true,
      signingOrder: true,
      role: true,
    },
    where: {
      envelopeId: envelope.id,
      signingStatus: { not: SigningStatus.SIGNED },
      role: { not: RecipientRole.CC },
    },
    orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });

  if (pendingRecipients.length > 0) {
    await sendPendingEmail({
      id: { type: 'envelopeId', id: envelope.id },
      recipientId: recipient.id,
    });

    // TSP envelopes are forced SEQUENTIAL at send-time; this branch always
    // fires when pending recipients exist. No `nextSigner` dictation path
    // — `prepareCscRecipientSigning` doesn't accept one.
    const [nextRecipient] = pendingRecipients;

    await prisma.recipient.update({
      where: { id: nextRecipient.id },
      data: {
        sendStatus: SendStatus.SENT,
        sentAt: new Date(),
      },
    });

    await jobs.triggerJob({
      name: 'send.signing.requested.email',
      payload: {
        userId: envelope.userId,
        documentId: legacyDocumentId,
        recipientId: nextRecipient.id,
        requestMetadata,
      },
    });
  }

  const haveAllRecipientsSigned = await prisma.envelope.findFirst({
    where: {
      id: envelope.id,
      recipients: {
        every: {
          OR: [{ signingStatus: SigningStatus.SIGNED }, { role: RecipientRole.CC }],
        },
      },
    },
  });

  if (haveAllRecipientsSigned) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId: legacyDocumentId,
        requestMetadata,
      },
    });
  }

  const updatedDocument = await prisma.envelope.findFirstOrThrow({
    where: {
      id: envelope.id,
      type: EnvelopeType.DOCUMENT,
    },
    include: {
      documentMeta: true,
      recipients: true,
    },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_SIGNED,
    data: ZWebhookDocumentSchema.parse(mapEnvelopeToWebhookDocumentPayload(updatedDocument)),
    userId: updatedDocument.userId,
    teamId: updatedDocument.teamId ?? undefined,
  });

  return { outcome: 'signed' };
};
