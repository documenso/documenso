import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { Button } from '@documenso/ui/primitives/button';
import { Trans, useLingui } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import {
  CopyPlusIcon,
  DownloadCloudIcon,
  FileOutputIcon,
  LinkIcon,
  type LucideIcon,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { EnvelopeDeleteDialog } from '~/components/dialogs/envelope-delete-dialog';
import { EnvelopeDistributeDialog } from '~/components/dialogs/envelope-distribute-dialog';
import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { EnvelopeDuplicateDialog } from '~/components/dialogs/envelope-duplicate-dialog';
import { EnvelopeRedistributeDialog } from '~/components/dialogs/envelope-redistribute-dialog';
import { EnvelopeSaveAsTemplateDialog } from '~/components/dialogs/envelope-save-as-template-dialog';
import { TemplateDirectLinkDialog } from '~/components/dialogs/template-direct-link-dialog';

import { EnvelopeEditorSettingsDialog } from './envelope-editor-settings-dialog';

const useEnvelopeEditorQuickActionVisibility = () => {
  const { envelope, editorConfig, isDocument, isTemplate } = useCurrentEnvelopeEditor();

  const { actions } = editorConfig;

  return {
    settings: Boolean(editorConfig.settings),
    distribute: isDocument && actions.allowDistributing,
    directLink: isTemplate && actions.allowDirectLink,
    duplicate: actions.allowDuplication,
    saveAsTemplate: isDocument && actions.allowSaveAsTemplate,
    download: actions.allowDownloadPDF,
    // Check envelope ID since it can be in embedded create mode.
    delete: actions.allowDeletion && Boolean(envelope.id),
  };
};

export const useHasEnvelopeEditorQuickActions = () =>
  Object.values(useEnvelopeEditorQuickActionVisibility()).some(Boolean);

type QuickActionButtonProps = ComponentProps<typeof Button> & {
  icon: LucideIcon;
  label: ReactNode;
  showLabel: boolean;
};

// Used as a Radix `asChild` trigger, so the injected props must reach the button.
const QuickActionButton = ({ icon: Icon, label, showLabel, ...props }: QuickActionButtonProps) => (
  <Button variant="ghost" size="sm" className="w-full justify-start" {...props}>
    <Icon className="h-4 w-4" />

    {showLabel && <span className="ml-2">{label}</span>}
  </Button>
);

export type EnvelopeEditorQuickActionsProps = {
  showLabels: boolean;
};

export const EnvelopeEditorQuickActions = ({ showLabels }: EnvelopeEditorQuickActionsProps) => {
  const { t } = useLingui();

  const navigate = useNavigate();

  const { envelope, isDocument, relativePath, syncEnvelope } = useCurrentEnvelopeEditor();

  const visibility = useEnvelopeEditorQuickActionVisibility();

  return (
    <div className="space-y-3 [&_.lucide]:text-muted-foreground">
      {visibility.settings && (
        <EnvelopeEditorSettingsDialog
          trigger={
            <QuickActionButton
              icon={SettingsIcon}
              title={t`Settings`}
              showLabel={showLabels}
              label={isDocument ? <Trans>Document Settings</Trans> : <Trans>Template Settings</Trans>}
            />
          }
        />
      )}

      {visibility.distribute && (
        <>
          <EnvelopeDistributeDialog
            documentRootPath={relativePath.documentRootPath}
            trigger={
              <QuickActionButton
                icon={SendIcon}
                title={t`Send Envelope`}
                showLabel={showLabels}
                label={<Trans>Send Document</Trans>}
              />
            }
          />

          <EnvelopeRedistributeDialog
            envelope={envelope}
            trigger={
              <QuickActionButton
                icon={SendIcon}
                title={t`Resend Envelope`}
                showLabel={showLabels}
                label={<Trans>Resend Document</Trans>}
              />
            }
          />
        </>
      )}

      {visibility.directLink && (
        <TemplateDirectLinkDialog
          templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
          directLink={envelope.directLink}
          recipients={envelope.recipients}
          onCreateSuccess={async () => await syncEnvelope()}
          onDeleteSuccess={async () => await syncEnvelope()}
          trigger={
            <QuickActionButton
              icon={LinkIcon}
              title={t`Direct Link`}
              showLabel={showLabels}
              label={<Trans>Direct Link</Trans>}
            />
          }
        />
      )}

      {visibility.duplicate && (
        <EnvelopeDuplicateDialog
          envelopeId={envelope.id}
          envelopeType={envelope.type}
          trigger={
            <QuickActionButton
              icon={CopyPlusIcon}
              title={t`Duplicate Envelope`}
              showLabel={showLabels}
              label={isDocument ? <Trans>Duplicate Document</Trans> : <Trans>Duplicate Template</Trans>}
            />
          }
        />
      )}

      {visibility.saveAsTemplate && (
        <EnvelopeSaveAsTemplateDialog
          envelopeId={envelope.id}
          trigger={
            <QuickActionButton
              icon={FileOutputIcon}
              title={t`Save as Template`}
              showLabel={showLabels}
              label={<Trans>Save as Template</Trans>}
            />
          }
        />
      )}

      {visibility.download && (
        <EnvelopeDownloadDialog
          envelopeId={envelope.id}
          envelopeStatus={envelope.status}
          isLegacy={envelope.internalVersion === 1}
          envelopeItems={envelope.envelopeItems}
          trigger={
            <QuickActionButton
              icon={DownloadCloudIcon}
              title={t`Download PDF`}
              showLabel={showLabels}
              label={<Trans>Download PDF</Trans>}
            />
          }
        />
      )}

      {visibility.delete && (
        <EnvelopeDeleteDialog
          id={envelope.id}
          type={envelope.type}
          status={envelope.status}
          title={envelope.title}
          canManageDocument={true}
          trigger={
            <QuickActionButton
              icon={Trash2Icon}
              title={t`Delete Envelope`}
              showLabel={showLabels}
              label={isDocument ? <Trans>Delete Document</Trans> : <Trans>Delete Template</Trans>}
            />
          }
          onDelete={async () => {
            await navigate(
              envelope.type === EnvelopeType.DOCUMENT ? relativePath.documentRootPath : relativePath.templateRootPath,
            );
          }}
        />
      )}
    </div>
  );
};
