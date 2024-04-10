import React from 'react';

import { redirect } from 'next/navigation';

import { match } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';

import {
  RECIPIENT_ROLES_DESCRIPTION,
  RECIPIENT_ROLE_SIGNING_REASONS,
} from '@documenso/lib/constants/recipient-roles';
import { getEntireDocument } from '@documenso/lib/server-only/admin/get-entire-document';
import { decryptSecondaryData } from '@documenso/lib/server-only/crypto/decrypt';
import { getDocumentCertificateAuditLogs } from '@documenso/lib/server-only/document/get-document-certificate-audit-logs';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { FieldType } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import { Logo } from '~/components/branding/logo';
import { LocaleDate } from '~/components/formatter/locale-date';

type SigningCertificateProps = {
  searchParams: {
    d: string;
  };
};

const FRIENDLY_SIGNING_REASONS = {
  ['__OWNER__']: 'I am the owner of this document',
  ...RECIPIENT_ROLE_SIGNING_REASONS,
};

export default async function SigningCertificate({ searchParams }: SigningCertificateProps) {
  const { d } = searchParams;

  if (typeof d !== 'string' || !d) {
    return redirect('/');
  }

  const rawDocumentId = decryptSecondaryData(d);

  if (!rawDocumentId || isNaN(Number(rawDocumentId))) {
    return redirect('/');
  }

  const documentId = Number(rawDocumentId);

  const document = await getEntireDocument({
    id: documentId,
  }).catch(() => null);

  if (!document) {
    return redirect('/');
  }

  const auditLogs = await getDocumentCertificateAuditLogs({
    id: documentId,
  });

  const isOwner = (email: string) => {
    return email.toLowerCase() === document.User.email.toLowerCase();
  };

  const getDevice = (userAgent?: string | null) => {
    if (!userAgent) {
      return 'Unknown';
    }

    const parser = new UAParser(userAgent);

    parser.setUA(userAgent);

    const result = parser.getResult();

    return `${result.os.name} - ${result.browser.name} ${result.browser.version}`;
  };

  const getAuthenticationLevel = (recipientId: number) => {
    const recipient = document.Recipient.find((recipient) => recipient.id === recipientId);

    if (!recipient) {
      return 'Unknown';
    }

    const extractedAuthMethods = extractDocumentAuthMethods({
      documentAuth: document.authOptions,
      recipientAuth: recipient.authOptions,
    });

    let authLevel = match(extractedAuthMethods.derivedRecipientActionAuth)
      .with('ACCOUNT', () => 'Account Re-Authentication')
      .with('TWO_FACTOR_AUTH', () => 'Two-Factor Re-Authentication')
      .with('PASSKEY', () => 'Passkey Re-Authentication')
      .with('EXPLICIT_NONE', () => 'Email')
      .with(null, () => null)
      .exhaustive();

    if (!authLevel) {
      authLevel = match(extractedAuthMethods.derivedRecipientAccessAuth)
        .with('ACCOUNT', () => 'Account Authentication')
        .with(null, () => 'Email')
        .exhaustive();
    }

    return authLevel;
  };

  const getRecipientAuditLogs = (recipientId: number) => {
    return {
      [DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT]: auditLogs[DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT && log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED &&
          log.data.recipientId === recipientId,
      ),
      [DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED]: auditLogs[
        DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED
      ].filter(
        (log) =>
          log.type === DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED &&
          log.data.recipientId === recipientId,
      ),
    };
  };

  const getRecipientSignatureField = (recipientId: number) => {
    return document.Recipient.find((recipient) => recipient.id === recipientId)?.Field.find(
      (field) => field.type === FieldType.SIGNATURE || field.type === FieldType.FREE_SIGNATURE,
    );
  };

  return (
    <div className="print-provider pointer-events-none mx-auto max-w-screen-md">
      <div className="flex items-center">
        <h1 className="my-8 text-2xl font-bold">Signing Certificate</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table overflowHidden>
            <TableHeader>
              <TableRow>
                <TableHead>Signer Events</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Details</TableHead>
                {/* <TableHead>Security</TableHead> */}
              </TableRow>
            </TableHeader>

            <TableBody className="print:text-xs">
              {document.Recipient.map((recipient, i) => {
                const logs = getRecipientAuditLogs(recipient.id);
                const signature = getRecipientSignatureField(recipient.id);

                return (
                  <TableRow key={i} className="print:break-inside-avoid">
                    <TableCell truncate={false} className="w-[min-content] max-w-[220px] align-top">
                      <div className="hyphens-auto break-words font-medium">{recipient.name}</div>
                      <div className="break-all">{recipient.email}</div>
                      <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                        {RECIPIENT_ROLES_DESCRIPTION[recipient.role].roleName}
                      </p>

                      <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                        <span className="font-medium">Authentication Level:</span>{' '}
                        <span className="block">{getAuthenticationLevel(recipient.id)}</span>
                      </p>
                    </TableCell>

                    <TableCell truncate={false} className="w-[min-content] align-top">
                      {signature ? (
                        <>
                          <div
                            className="inline-block rounded-lg p-1"
                            style={{
                              boxShadow: `0px 0px 0px 4.88px rgba(122, 196, 85, 0.1), 0px 0px 0px 1.22px rgba(122, 196, 85, 0.6), 0px 0px 0px 0.61px rgba(122, 196, 85, 1)`,
                            }}
                          >
                            <img
                              src={`${signature.Signature?.signatureImageAsBase64}`}
                              alt="Signature"
                              className="max-h-12 max-w-full"
                            />
                          </div>

                          <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                            <span className="font-medium">Signature ID:</span>{' '}
                            <span className="block font-mono uppercase">
                              {signature.secondaryId}
                            </span>
                          </p>

                          <p className="text-muted-foreground mt-2 text-sm print:text-xs">
                            <span className="font-medium">IP Address:</span>{' '}
                            <span className="inline-block">
                              {logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.ipAddress ?? 'Unknown'}
                            </span>
                          </p>

                          <p className="text-muted-foreground mt-1 text-sm print:text-xs">
                            <span className="font-medium">Device:</span>{' '}
                            <span className="inline-block">
                              {getDevice(logs.DOCUMENT_RECIPIENT_COMPLETED[0]?.userAgent)}
                            </span>
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">N/A</p>
                      )}
                    </TableCell>

                    <TableCell truncate={false} className="w-[min-content] align-top">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-sm print:text-xs">
                          <span className="font-medium">Sent:</span>{' '}
                          <span className="inline-block">
                            {logs.EMAIL_SENT[0] ? (
                              <LocaleDate
                                date={logs.EMAIL_SENT[0].createdAt}
                                format="yyyy-MM-dd hh:mm:ss a (ZZZZ)"
                              />
                            ) : (
                              'Unknown'
                            )}
                          </span>
                        </p>

                        <p className="text-muted-foreground text-sm print:text-xs">
                          <span className="font-medium">Viewed:</span>{' '}
                          <span className="inline-block">
                            {logs.DOCUMENT_OPENED[0] ? (
                              <LocaleDate
                                date={logs.DOCUMENT_OPENED[0].createdAt}
                                format="yyyy-MM-dd hh:mm:ss a (ZZZZ)"
                              />
                            ) : (
                              'Unknown'
                            )}
                          </span>
                        </p>

                        <p className="text-muted-foreground text-sm print:text-xs">
                          <span className="font-medium">Signed:</span>{' '}
                          <span className="inline-block">
                            {logs.DOCUMENT_RECIPIENT_COMPLETED[0] ? (
                              <LocaleDate
                                date={logs.DOCUMENT_RECIPIENT_COMPLETED[0].createdAt}
                                format="yyyy-MM-dd hh:mm:ss a (ZZZZ)"
                              />
                            ) : (
                              'Unknown'
                            )}
                          </span>
                        </p>

                        <p className="text-muted-foreground text-sm print:text-xs">
                          <span className="font-medium">Reason:</span>{' '}
                          <span className="inline-block">
                            {isOwner(recipient.email)
                              ? FRIENDLY_SIGNING_REASONS['__OWNER__']
                              : FRIENDLY_SIGNING_REASONS[recipient.role]}
                          </span>
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="my-8 flex-row-reverse">
        <div className="flex items-end justify-end gap-x-4">
          <p className="flex-shrink-0 text-sm font-medium print:text-xs">
            Signing certificate provided by:
          </p>

          <Logo className="max-h-6 print:max-h-4" />
        </div>
      </div>
    </div>
  );
}
