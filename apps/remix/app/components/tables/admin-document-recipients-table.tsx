import { LocalTime } from '@documenso/ui/components/common/local-time';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@documenso/ui/primitives/table';
import { Trans } from '@lingui/react/macro';
import { SigningStatus } from '@prisma/client';
import { ChevronDownIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import { match } from 'ts-pattern';

import { AdminDocumentRecipientItemTable, type RecipientItemProps } from './admin-document-recipient-item-table';

export type AdminDocumentRecipientsTableProps = {
  envelopeId: string;
  isDocumentCompleted: boolean;
  recipients: RecipientItemProps['recipient'][];
};

export const AdminDocumentRecipientsTable = ({
  envelopeId,
  isDocumentCompleted,
  recipients,
}: AdminDocumentRecipientsTableProps) => {
  const [expandedRecipientIds, setExpandedRecipientIds] = useState<number[]>([]);

  const toggleRecipient = (recipientId: number) => {
    setExpandedRecipientIds((ids) =>
      ids.includes(recipientId) ? ids.filter((id) => id !== recipientId) : [...ids, recipientId],
    );
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Trans>Name</Trans>
            </TableHead>
            <TableHead>
              <Trans>Email</Trans>
            </TableHead>
            <TableHead>
              <Trans>Role</Trans>
            </TableHead>
            <TableHead>
              <Trans>Completed</Trans>
            </TableHead>
            <TableHead>
              <Trans>Completed At</Trans>
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {recipients.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center">
                <Trans>No recipients</Trans>
              </TableCell>
            </TableRow>
          )}

          {recipients.map((recipient) => {
            const isExpanded = expandedRecipientIds.includes(recipient.id);

            return (
              <Fragment key={recipient.id}>
                <TableRow
                  className="cursor-pointer"
                  data-state={isExpanded ? 'open' : 'closed'}
                  onClick={() => toggleRecipient(recipient.id)}
                >
                  <TableCell className="font-medium">{recipient.name || '-'}</TableCell>
                  <TableCell>{recipient.email}</TableCell>
                  <TableCell>
                    <Badge size="small" variant="secondary">
                      {recipient.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {match(recipient.signingStatus)
                      .with(SigningStatus.SIGNED, () => <Trans>Yes</Trans>)
                      .with(SigningStatus.REJECTED, () => <Trans>Rejected</Trans>)
                      .otherwise(() => (
                        <Trans>No</Trans>
                      ))}
                  </TableCell>
                  <TableCell>
                    {recipient.signingStatus === SigningStatus.SIGNED && recipient.signedAt ? (
                      <LocalTime date={recipient.signedAt} />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronDownIcon
                      className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')}
                    />
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-muted/30 p-4">
                      <AdminDocumentRecipientItemTable
                        envelopeId={envelopeId}
                        isDocumentCompleted={isDocumentCompleted}
                        recipient={recipient}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
