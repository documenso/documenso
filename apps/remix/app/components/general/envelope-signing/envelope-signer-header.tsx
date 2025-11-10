import { Plural, Trans } from '@lingui/react/macro';
import { EnvelopeType, RecipientRole } from '@prisma/client';
import { BanIcon, DownloadCloudIcon } from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@documenso/ui/primitives/dropdown-menu';
import { Separator } from '@documenso/ui/primitives/separator';

import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { useEmbedSigningContext } from '~/components/embed/embed-signing-context';
import { BrandingLogo } from '~/components/general/branding-logo';

import { BrandingLogoIcon } from '../branding-logo-icon';
import { DocumentSigningRejectDialog } from '../document-signing/document-signing-reject-dialog';
import { useRequiredEnvelopeSigningContext } from '../document-signing/envelope-signing-provider';
import { EnvelopeSignerCompleteDialog } from './envelope-signing-complete-dialog';

export const EnvelopeSignerHeader = () => {
  const { envelopeData, envelope, recipientFieldsRemaining, recipient } =
    useRequiredEnvelopeSigningContext();

  return (
    <nav className="embed--DocumentWidgetHeader bg-background border-border max-w-screen flex flex-row justify-between border-b px-4 py-3 md:px-6">
      {/* Left side - Logo and title */}
      <div className="flex min-w-0 flex-1 items-center space-x-2 md:w-auto md:flex-none">
        <Link to="/" className="flex-shrink-0">
          {envelopeData.settings.brandingEnabled && envelopeData.settings.brandingLogo ? (
            <img
              src={`/api/branding/logo/team/${envelope.teamId}`}
              alt={`${envelope.team.name}'s Logo`}
              className="h-6 w-auto"
            />
          ) : (
            <>
              <BrandingLogo className="hidden h-6 w-auto md:block" />
              <BrandingLogoIcon className="h-6 w-auto md:hidden" />
            </>
          )}
        </Link>

        <h1
          title={envelope.title}
          className="text-foreground min-w-0 truncate text-base font-semibold md:hidden"
        >
          {envelope.title}
        </h1>

        <Separator orientation="vertical" className="hidden h-6 md:block" />

        <div className="hidden items-center space-x-2 md:flex">
          <h1 className="text-foreground whitespace-nowrap text-sm font-medium">
            {envelope.title}
          </h1>

          <Badge>
            {match(recipient.role)
              .with(RecipientRole.VIEWER, () => <Trans>Viewer</Trans>)
              .with(RecipientRole.SIGNER, () => <Trans>Signer</Trans>)
              .with(RecipientRole.APPROVER, () => <Trans>Approver</Trans>)
              .with(RecipientRole.ASSISTANT, () => <Trans>Assistant</Trans>)
              .otherwise(() => null)}
          </Badge>
        </div>
      </div>

      {/* Right side - Desktop content */}
      <div className="hidden items-center space-x-2 lg:flex">
        <p className="text-muted-foreground mr-2 flex-shrink-0 text-sm">
          <Plural
            one="1 Field Remaining"
            other="# Fields Remaining"
            value={recipientFieldsRemaining.length}
          />
        </p>

        <EnvelopeSignerCompleteDialog />
      </div>

      {/* Mobile Actions button */}
      <div className="flex-shrink-0 lg:hidden">
        <MobileDropdownMenu />
      </div>
    </nav>
  );
};

const MobileDropdownMenu = () => {
  const { envelope, recipient } = useRequiredEnvelopeSigningContext();

  const { allowDocumentRejection } = useEmbedSigningContext() || {};

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Trans>Actions</Trans>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <EnvelopeDownloadDialog
          envelopeId={envelope.id}
          envelopeStatus={envelope.status}
          envelopeItems={envelope.envelopeItems}
          token={recipient.token}
          trigger={
            <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
              <div>
                <DownloadCloudIcon className="mr-2 h-4 w-4" />
                <Trans>Download PDF</Trans>
              </div>
            </DropdownMenuItem>
          }
        />

        {envelope.type === EnvelopeType.DOCUMENT && allowDocumentRejection !== false && (
          <DocumentSigningRejectDialog
            documentId={mapSecondaryIdToDocumentId(envelope.secondaryId)}
            token={recipient.token}
            trigger={
              <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                <div>
                  <BanIcon className="mr-2 h-4 w-4" />
                  <Trans>Reject</Trans>
                </div>
              </DropdownMenuItem>
            }
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
