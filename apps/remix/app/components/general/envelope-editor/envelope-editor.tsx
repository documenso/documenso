import { useEffect, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  CopyPlusIcon,
  DownloadCloudIcon,
  EyeIcon,
  LinkIcon,
  MousePointer,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
  Upload,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  mapSecondaryIdToDocumentId,
  mapSecondaryIdToTemplateId,
} from '@documenso/lib/utils/envelope';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';

import { DocumentDeleteDialog } from '~/components/dialogs/document-delete-dialog';
import { EnvelopeDistributeDialog } from '~/components/dialogs/envelope-distribute-dialog';
import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { EnvelopeDuplicateDialog } from '~/components/dialogs/envelope-duplicate-dialog';
import { EnvelopeRedistributeDialog } from '~/components/dialogs/envelope-redistribute-dialog';
import { TemplateDeleteDialog } from '~/components/dialogs/template-delete-dialog';
import { TemplateDirectLinkDialog } from '~/components/dialogs/template-direct-link-dialog';
import { EnvelopeEditorSettingsDialog } from '~/components/general/envelope-editor/envelope-editor-settings-dialog';

import { EnvelopeEditorFieldsPage } from './envelope-editor-fields-page';
import EnvelopeEditorHeader from './envelope-editor-header';
import { EnvelopeEditorPreviewPage } from './envelope-editor-preview-page';
import { EnvelopeEditorUploadPage } from './envelope-editor-upload-page';

type EnvelopeEditorStep = 'upload' | 'addFields' | 'preview';

const envelopeEditorSteps = [
  {
    id: 'upload',
    order: 1,
    title: msg`Document & Recipients`,
    icon: Upload,
    description: msg`Upload documents and add recipients`,
  },
  {
    id: 'addFields',
    order: 2,
    title: msg`Add Fields`,
    icon: MousePointer,
    description: msg`Place and configure form fields in the document`,
  },
  {
    id: 'preview',
    order: 3,
    title: msg`Preview`,
    icon: EyeIcon,
    description: msg`Preview the document before sending`,
  },
];

export default function EnvelopeEditor() {
  const { t } = useLingui();

  const navigate = useNavigate();

  const {
    envelope,
    isDocument,
    isTemplate,
    isAutosaving,
    flushAutosave,
    relativePath,
    editorFields,
  } = useCurrentEnvelopeEditor();

  const [searchParams, setSearchParams] = useSearchParams();
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isStepLoading, setIsStepLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState<EnvelopeEditorStep>(() => {
    const searchParamStep = searchParams.get('step') as EnvelopeEditorStep | undefined;

    // Empty URL param equals upload, otherwise use the step URL param
    if (!searchParamStep) {
      return 'upload';
    }

    const validSteps: EnvelopeEditorStep[] = ['upload', 'addFields', 'preview'];

    if (validSteps.includes(searchParamStep)) {
      return searchParamStep;
    }

    return 'upload';
  });

  const navigateToStep = (step: EnvelopeEditorStep) => {
    setCurrentStep(step);

    void flushAutosave();

    if (!isStepLoading && isAutosaving) {
      setIsStepLoading(true);
    }

    // Update URL params: empty for upload, otherwise set the step
    if (step === 'upload') {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('step');
        return newParams;
      });
    } else {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set('step', step);
        return newParams;
      });
    }
  };

  // Watch the URL params and setStep if the step changes.
  useEffect(() => {
    const stepParam = searchParams.get('step') || envelopeEditorSteps[0].id;

    const foundStep = envelopeEditorSteps.find((step) => step.id === stepParam);

    if (foundStep && foundStep.id !== currentStep) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      navigateToStep(foundStep.id as EnvelopeEditorStep);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isAutosaving) {
      setIsStepLoading(false);
    }
  }, [isAutosaving]);

  const currentStepData =
    envelopeEditorSteps.find((step) => step.id === currentStep) || envelopeEditorSteps[0];

  return (
    <div className="h-screen w-screen bg-gray-50 dark:bg-background">
      <EnvelopeEditorHeader />

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-4rem)] w-screen">
        {/* Left Section - Step Navigation */}
        <div className="flex w-80 flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-background py-4">
          {/* Left section step selector. */}
          <div className="px-4">
            <h3 className="flex items-end justify-between text-sm font-semibold text-foreground">
              {isDocument ? <Trans>Document Editor</Trans> : <Trans>Template Editor</Trans>}

              <span className="ml-2 rounded border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                <Trans context="The step counter">
                  Step {currentStepData.order}/{envelopeEditorSteps.length}
                </Trans>
              </span>
            </h3>

            <div className="relative my-4 h-[4px] rounded-md bg-muted">
              <motion.div
                layout="size"
                layoutId="document-flow-container-step"
                className="absolute inset-y-0 left-0 bg-documenso"
                style={{
                  width: `${(100 / envelopeEditorSteps.length) * (currentStepData.order ?? 0)}%`,
                }}
              />
            </div>

            <div className="space-y-3">
              {envelopeEditorSteps.map((step) => {
                const Icon = step.icon;
                const isActive = currentStep === step.id;

                return (
                  <div
                    key={step.id}
                    className={`cursor-pointer rounded-lg p-3 transition-colors ${
                      isActive
                        ? 'border border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10'
                        : 'border border-gray-200 hover:bg-gray-50 dark:border-gray-400/20 dark:hover:bg-gray-400/10'
                    }`}
                    onClick={() => navigateToStep(step.id as EnvelopeEditorStep)}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`rounded border p-2 ${
                          isActive
                            ? 'border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10'
                            : 'border-gray-100 bg-gray-100 dark:border-gray-400/20 dark:bg-gray-400/10'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 ${isActive ? 'text-green-600' : 'text-gray-600'}`}
                        />
                      </div>
                      <div>
                        <div
                          className={`text-sm font-medium ${
                            isActive
                              ? 'text-green-900 dark:text-green-400'
                              : 'text-foreground dark:text-muted-foreground'
                          }`}
                        >
                          {t(step.title)}
                        </div>
                        <div className="text-xs text-muted-foreground">{t(step.description)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="my-6" />

          {/* Quick Actions. */}
          <div className="space-y-3 px-4">
            <h4 className="text-sm font-semibold text-foreground">
              <Trans>Quick Actions</Trans>
            </h4>
            <EnvelopeEditorSettingsDialog
              trigger={
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  {isDocument ? <Trans>Document Settings</Trans> : <Trans>Template Settings</Trans>}
                </Button>
              }
            />

            {isDocument && (
              <EnvelopeDistributeDialog
                documentRootPath={relativePath.documentRootPath}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <SendIcon className="mr-2 h-4 w-4" />
                    <Trans>Send Document</Trans>
                  </Button>
                }
              />
            )}

            {isDocument && (
              <EnvelopeRedistributeDialog
                envelope={envelope}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <SendIcon className="mr-2 h-4 w-4" />
                    <Trans>Resend Document</Trans>
                  </Button>
                }
              />
            )}

            {/* <Button variant="ghost" size="sm" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Save as Template
            </Button> */}

            {isTemplate && (
              <TemplateDirectLinkDialog
                templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
                directLink={envelope.directLink}
                recipients={envelope.recipients}
                trigger={
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    <Trans>Direct Link</Trans>
                  </Button>
                }
              />
            )}

            <EnvelopeDuplicateDialog
              envelopeId={envelope.id}
              envelopeType={envelope.type}
              trigger={
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <CopyPlusIcon className="mr-2 h-4 w-4" />
                  {isDocument ? (
                    <Trans>Duplicate Document</Trans>
                  ) : (
                    <Trans>Duplicate Template</Trans>
                  )}
                </Button>
              }
            />

            <EnvelopeDownloadDialog
              envelopeId={envelope.id}
              envelopeStatus={envelope.status}
              envelopeItems={envelope.envelopeItems}
              trigger={
                <Button variant="ghost" size="sm" className="w-full justify-start">
                  <DownloadCloudIcon className="mr-2 h-4 w-4" />
                  <Trans>Download PDF</Trans>
                </Button>
              }
            />

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2Icon className="mr-2 h-4 w-4" />
              {isDocument ? <Trans>Delete Document</Trans> : <Trans>Delete Template</Trans>}
            </Button>
          </div>

          {isDocument ? (
            <DocumentDeleteDialog
              id={mapSecondaryIdToDocumentId(envelope.secondaryId)}
              status={envelope.status}
              documentTitle={envelope.title}
              canManageDocument={true}
              open={isDeleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onDelete={async () => {
                await navigate(relativePath.documentRootPath);
              }}
            />
          ) : (
            <TemplateDeleteDialog
              id={mapSecondaryIdToTemplateId(envelope.secondaryId)}
              open={isDeleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              onDelete={async () => {
                await navigate(relativePath.templateRootPath);
              }}
            />
          )}

          {/* Footer of left sidebar. */}
          <div className="mt-auto px-4">
            <Button variant="ghost" className="w-full justify-start" asChild>
              <Link to={relativePath.basePath}>
                <ArrowLeftIcon className="mr-2 h-4 w-4" />
                {isDocument ? (
                  <Trans>Return to documents</Trans>
                ) : (
                  <Trans>Return to templates</Trans>
                )}
              </Link>
            </Button>
          </div>
        </div>

        {/* Main Content - Changes based on current step */}
        <AnimateGenericFadeInOut className="flex-1 overflow-y-auto" key={currentStep}>
          {match({ currentStep, isStepLoading })
            .with({ isStepLoading: true }, () => <SpinnerBox className="py-32" />)
            .with({ currentStep: 'upload' }, () => <EnvelopeEditorUploadPage />)
            .with({ currentStep: 'addFields' }, () => <EnvelopeEditorFieldsPage />)
            .with({ currentStep: 'preview' }, () => <EnvelopeEditorPreviewPage />)
            .exhaustive()}
        </AnimateGenericFadeInOut>
      </div>
    </div>
  );
}
