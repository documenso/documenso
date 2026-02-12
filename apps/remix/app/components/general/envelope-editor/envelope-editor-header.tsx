import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentStatus, EnvelopeType } from '@prisma/client';
import {
  AlertTriangleIcon,
  Globe2Icon,
  LockIcon,
  RefreshCwIcon,
  SendIcon,
  SettingsIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';

import { EnvelopeDistributeDialog } from '~/components/dialogs/envelope-distribute-dialog';
import { EnvelopeRedistributeDialog } from '~/components/dialogs/envelope-redistribute-dialog';
import { TemplateUseDialog } from '~/components/dialogs/template-use-dialog';
import { BrandingLogo } from '~/components/general/branding-logo';
import { DocumentAttachmentsPopover } from '~/components/general/document/document-attachments-popover';
import { EnvelopeEditorSettingsDialog } from '~/components/general/envelope-editor/envelope-editor-settings-dialog';

import { TemplateDirectLinkBadge } from '../template/template-direct-link-badge';
import { EnvelopeItemTitleInput } from './envelope-editor-title-input';

export default function EnvelopeEditorHeader() {
  const { t } = useLingui();

  const {
    envelope,
    isDocument,
    isTemplate,
    isEmbedded,
    updateEnvelope,
    autosaveError,
    relativePath,
    editorConfig,
    flushAutosave,
  } = useCurrentEnvelopeEditor();

  const {
    embeded,
    general: { allowConfigureEnvelopeTitle },
    actions: { allowAttachments, allowDistributing },
  } = editorConfig;

  const handleCreateEmbeddedEnvelope = async () => {
    const latestEnvelope = await flushAutosave();

    embeded?.onCreate?.(latestEnvelope);
  };

  const handleUpdateEmbeddedEnvelope = async () => {
    const latestEnvelope = await flushAutosave();

    embeded?.onUpdate?.(latestEnvelope);
  };

  return (
    <nav className="w-full border-b border-border bg-background px-4 py-3 md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {editorConfig.embeded?.customBrandingLogo ? (
            <img
              src={`/api/branding/logo/team/${envelope.teamId}`}
              alt="Logo"
              className="h-6 w-auto"
            />
          ) : (
            <Link to="/">
              <BrandingLogo className="h-6 w-auto" />
            </Link>
          )}
          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center space-x-2">
            <EnvelopeItemTitleInput
              disabled={envelope.status !== DocumentStatus.DRAFT || !allowConfigureEnvelopeTitle}
              value={envelope.title}
              onChange={(title) => {
                updateEnvelope({
                  data: {
                    title,
                  },
                });
              }}
              placeholder={t`Envelope Title`}
            />

            {envelope.type === EnvelopeType.TEMPLATE && (
              <>
                {envelope.templateType === 'PRIVATE' ? (
                  <Badge variant="secondary">
                    <LockIcon className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-300" />
                    <Trans>Private Template</Trans>
                  </Badge>
                ) : (
                  <Badge variant="default">
                    <Globe2Icon className="mr-2 h-4 w-4 text-green-500 dark:text-green-300" />
                    <Trans>Public Template</Trans>
                  </Badge>
                )}

                {envelope.directLink?.token && (
                  <TemplateDirectLinkBadge
                    className="py-1"
                    token={envelope.directLink.token}
                    enabled={envelope.directLink.enabled}
                  />
                )}
              </>
            )}

            {envelope.type === EnvelopeType.DOCUMENT &&
              match(envelope.status)
                .with(DocumentStatus.DRAFT, () => (
                  <Badge variant="warning">
                    <Trans>Draft</Trans>
                  </Badge>
                ))
                .with(DocumentStatus.PENDING, () => (
                  <Badge variant="secondary">
                    <Trans>Pending</Trans>
                  </Badge>
                ))
                .with(DocumentStatus.COMPLETED, () => (
                  <Badge variant="default">
                    <Trans>Completed</Trans>
                  </Badge>
                ))
                .with(DocumentStatus.REJECTED, () => (
                  <Badge variant="destructive">
                    <Trans>Rejected</Trans>
                  </Badge>
                ))
                .exhaustive()}

            {autosaveError && (
              <>
                <Badge variant="destructive">
                  <AlertTriangleIcon className="mr-2 h-4 w-4" />
                  <Trans>Sync failed, changes not saved</Trans>
                </Badge>

                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  <Badge variant="destructive">
                    <RefreshCwIcon className="mr-2 h-4 w-4" />
                    <Trans>Reload</Trans>
                  </Badge>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {allowAttachments && (
            <DocumentAttachmentsPopover envelopeId={envelope.id} buttonSize="sm" />
          )}

          {editorConfig.settings && (
            <EnvelopeEditorSettingsDialog
              trigger={
                <Button variant="outline" size="sm">
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              }
            />
          )}

          {match({ isEmbedded, isDocument, isTemplate, allowDistributing })
            .with({ isEmbedded: false, isDocument: true, allowDistributing: true }, () => (
              <>
                <EnvelopeDistributeDialog
                  documentRootPath={relativePath.documentRootPath}
                  trigger={
                    <Button size="sm">
                      <SendIcon className="mr-2 h-4 w-4" />
                      <Trans>Send Document</Trans>
                    </Button>
                  }
                />

                <EnvelopeRedistributeDialog
                  envelope={envelope}
                  trigger={
                    <Button size="sm">
                      <SendIcon className="mr-2 h-4 w-4" />
                      <Trans>Resend Document</Trans>
                    </Button>
                  }
                />
              </>
            ))
            .with({ isEmbedded: false, isTemplate: true, allowDistributing: true }, () => (
              <TemplateUseDialog
                envelopeId={envelope.id}
                templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
                templateSigningOrder={envelope.documentMeta?.signingOrder}
                recipients={envelope.recipients}
                documentRootPath={relativePath.documentRootPath}
                trigger={
                  <Button size="sm">
                    <Trans>Use Template</Trans>
                  </Button>
                }
              />
            ))

            .otherwise(() => null)}

          {embeded?.mode === 'create' && (
            <Button size="sm" onClick={handleCreateEmbeddedEnvelope}>
              {isDocument ? <Trans>Create Document</Trans> : <Trans>Create Template</Trans>}
            </Button>
          )}

          {embeded?.mode === 'edit' && (
            <Button size="sm" onClick={handleUpdateEmbeddedEnvelope}>
              {isDocument ? <Trans>Update Document</Trans> : <Trans>Update Template</Trans>}
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
