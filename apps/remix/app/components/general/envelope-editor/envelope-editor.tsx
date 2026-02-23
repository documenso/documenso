import { useEffect, useMemo, useState } from 'react';

import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  CopyPlusIcon,
  DownloadCloudIcon,
  EyeIcon,
  LinkIcon,
  type LucideIcon,
  MousePointerIcon,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
  UploadIcon,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

import type { EnvelopeEditorStep } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Separator } from '@documenso/ui/primitives/separator';
import { SpinnerBox } from '@documenso/ui/primitives/spinner';

import { EnvelopeDeleteDialog } from '~/components/dialogs/envelope-delete-dialog';
import { EnvelopeDistributeDialog } from '~/components/dialogs/envelope-distribute-dialog';
import { EnvelopeDownloadDialog } from '~/components/dialogs/envelope-download-dialog';
import { EnvelopeDuplicateDialog } from '~/components/dialogs/envelope-duplicate-dialog';
import { EnvelopeRedistributeDialog } from '~/components/dialogs/envelope-redistribute-dialog';
import { TemplateDirectLinkDialog } from '~/components/dialogs/template-direct-link-dialog';
import { EnvelopeEditorSettingsDialog } from '~/components/general/envelope-editor/envelope-editor-settings-dialog';

import { EnvelopeEditorFieldsPage } from './envelope-editor-fields-page';
import EnvelopeEditorHeader from './envelope-editor-header';
import { EnvelopeEditorPreviewPage } from './envelope-editor-preview-page';
import { EnvelopeEditorUploadPage } from './envelope-editor-upload-page';

type EnvelopeEditorStepData = {
  id: string;
  title: MessageDescriptor;
  icon: LucideIcon;
  description: MessageDescriptor;
};

const UPLOAD_STEP = {
  id: 'upload',
  title: msg`Document & Recipients`,
  icon: UploadIcon,
  description: msg`Upload documents and add recipients`,
};

const ADD_FIELDS_STEP = {
  id: 'addFields',
  title: msg`Add Fields`,
  icon: MousePointerIcon,
  description: msg`Place and configure form fields in the document`,
};

const PREVIEW_STEP = {
  id: 'preview',
  title: msg`Preview`,
  icon: EyeIcon,
  description: msg`Preview the document before sending`,
};

export const EnvelopeEditor = () => {
  const { t } = useLingui();

  const navigate = useNavigate();

  const {
    envelope,
    editorConfig,
    isDocument,
    isTemplate,
    relativePath,
    syncEnvelope,
    navigateToStep,
  } = useCurrentEnvelopeEditor();

  const [searchParams, setSearchParams] = useSearchParams();

  const {
    general: {
      minimizeLeftSidebar,
      allowUploadAndRecipientStep,
      allowAddFieldsStep,
      allowPreviewStep,
    },
    actions: {
      allowDistributing,
      allowDirectLink,
      allowDuplication,
      allowDownloadPDF,
      allowDeletion,
      allowReturnToPreviousPage,
    },
  } = editorConfig;

  const envelopeEditorSteps = useMemo(() => {
    const steps: EnvelopeEditorStepData[] = [];

    if (allowUploadAndRecipientStep) {
      steps.push(UPLOAD_STEP);
    }

    if (allowAddFieldsStep) {
      steps.push(ADD_FIELDS_STEP);
    }

    if (allowPreviewStep) {
      steps.push(PREVIEW_STEP);
    }

    return steps.map((step, index) => ({
      ...step,
      order: index + 1,
    }));
  }, [editorConfig]);

  const [currentStep, setCurrentStep] = useState<{ step: EnvelopeEditorStep; isLoading: boolean }>(
    () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const searchParamStep = searchParams.get('step') as EnvelopeEditorStep | undefined;

      // Empty URL param equals upload, otherwise use the step URL param
      if (!searchParamStep) {
        return { step: 'upload', isLoading: false };
      }

      const validSteps: EnvelopeEditorStep[] = ['upload', 'addFields', 'preview'];

      if (validSteps.includes(searchParamStep)) {
        return { step: searchParamStep, isLoading: false };
      }

      return { step: 'upload', isLoading: false };
    },
  );

  // Watch the URL params and setStep if the step changes.
  useEffect(() => {
    const stepParam = searchParams.get('step') || envelopeEditorSteps[0].id;

    const foundStep = envelopeEditorSteps.find((step) => step.id === stepParam);

    if (foundStep && foundStep.id !== currentStep.step) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      void navigateToStep(foundStep.id as EnvelopeEditorStep).then(() => {
        setCurrentStep({
          step: foundStep.id as EnvelopeEditorStep,
          isLoading: false,
        });
      });
    }
  }, [searchParams]);

  const currentStepData =
    envelopeEditorSteps.find((step) => step.id === currentStep.step) || envelopeEditorSteps[0];

  return (
    <div className="h-screen w-screen bg-gray-50 dark:bg-background">
      <EnvelopeEditorHeader />

      {/* Main Content Area */}
      <div className="flex h-[calc(100vh-4rem)] w-screen">
        {/* Left Section - Step Navigation */}
        <div
          className={cn(
            'flex w-80 flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-background py-4',
            {
              'w-14': minimizeLeftSidebar,
            },
          )}
        >
          {/* Left section step selector. */}
          {minimizeLeftSidebar ? (
            <div className="flex justify-center px-4">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <svg className="size-10 -rotate-90" viewBox="0 0 40 40" aria-hidden>
                  {/* Track circle */}
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-muted"
                  />
                  {/* Progress arc */}
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-primary"
                    strokeDasharray={2 * Math.PI * 16}
                    initial={false}
                    animate={{
                      strokeDashoffset:
                        2 *
                        Math.PI *
                        16 *
                        (1 - (currentStepData.order ?? 0) / envelopeEditorSteps.length),
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
                  <Trans context="The step counter">
                    {currentStepData.order}/{envelopeEditorSteps.length}
                  </Trans>
                </span>
              </div>
            </div>
          ) : (
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
                  className="absolute inset-y-0 left-0 bg-primary"
                  style={{
                    width: `${(100 / envelopeEditorSteps.length) * (currentStepData.order ?? 0)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div
            className={cn('space-y-3', {
              'px-4': !minimizeLeftSidebar,
              'mt-4 flex flex-col items-center': minimizeLeftSidebar,
            })}
          >
            {envelopeEditorSteps.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep.step === step.id;

              return (
                <button
                  key={step.id}
                  data-testid={`envelope-editor-step-${step.id}`}
                  type="button"
                  className={cn(
                    `cursor-pointer rounded-lg text-left transition-colors ${
                      isActive
                        ? 'border border-green-200 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10'
                        : 'border border-gray-200 hover:bg-gray-50 dark:border-gray-400/20 dark:hover:bg-gray-400/10'
                    }`,
                    {
                      'p-3': !minimizeLeftSidebar,
                    },
                  )}
                  onClick={() => void navigateToStep(step.id as EnvelopeEditorStep)}
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

                    {!minimizeLeftSidebar && (
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
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <Separator
            className={cn('my-6', {
              'mx-auto mb-4 w-4/5': minimizeLeftSidebar,
            })}
          />

          {/* Quick Actions. */}
          <div
            className={cn('space-y-3 px-4 [&_.lucide]:text-muted-foreground', {
              'px-2': minimizeLeftSidebar,
            })}
          >
            {!minimizeLeftSidebar && (
              <h4 className="text-sm font-semibold text-foreground">
                <Trans>Quick Actions</Trans>
              </h4>
            )}

            {editorConfig.settings && (
              <EnvelopeEditorSettingsDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    title={t(msg`Settings`)}
                  >
                    <SettingsIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        {isDocument ? (
                          <Trans>Document Settings</Trans>
                        ) : (
                          <Trans>Template Settings</Trans>
                        )}
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {isDocument && allowDistributing && (
              <>
                <EnvelopeDistributeDialog
                  documentRootPath={relativePath.documentRootPath}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      title={t(msg`Send Envelope`)}
                    >
                      <SendIcon className="h-4 w-4" />

                      {!minimizeLeftSidebar && (
                        <span className="ml-2">
                          <Trans>Send Document</Trans>
                        </span>
                      )}
                    </Button>
                  }
                />

                <EnvelopeRedistributeDialog
                  envelope={envelope}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      title={t(msg`Resend Envelope`)}
                    >
                      <SendIcon className="h-4 w-4" />

                      {!minimizeLeftSidebar && (
                        <span className="ml-2">
                          <Trans>Resend Document</Trans>
                        </span>
                      )}
                    </Button>
                  }
                />
              </>
            )}

            {isTemplate && allowDirectLink && (
              <TemplateDirectLinkDialog
                templateId={mapSecondaryIdToTemplateId(envelope.secondaryId)}
                directLink={envelope.directLink}
                recipients={envelope.recipients}
                onCreateSuccess={async () => await syncEnvelope()}
                onDeleteSuccess={async () => await syncEnvelope()}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    title={t(msg`Direct Link`)}
                  >
                    <LinkIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        <Trans>Direct Link</Trans>
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {allowDuplication && (
              <EnvelopeDuplicateDialog
                envelopeId={envelope.id}
                envelopeType={envelope.type}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    title={t(msg`Duplicate Envelope`)}
                  >
                    <CopyPlusIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        {isDocument ? (
                          <Trans>Duplicate Document</Trans>
                        ) : (
                          <Trans>Duplicate Template</Trans>
                        )}
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {allowDownloadPDF && (
              <EnvelopeDownloadDialog
                envelopeId={envelope.id}
                envelopeStatus={envelope.status}
                envelopeItems={envelope.envelopeItems}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    title={t(msg`Download PDF`)}
                  >
                    <DownloadCloudIcon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        <Trans>Download PDF</Trans>
                      </span>
                    )}
                  </Button>
                }
              />
            )}

            {/* Check envelope ID since it can be in embedded create mode. */}
            {allowDeletion && envelope.id && (
              <EnvelopeDeleteDialog
                id={envelope.id}
                type={envelope.type}
                status={envelope.status}
                title={envelope.title}
                canManageDocument={true}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    title={t(msg`Delete Envelope`)}
                  >
                    <Trash2Icon className="h-4 w-4" />

                    {!minimizeLeftSidebar && (
                      <span className="ml-2">
                        {isDocument ? (
                          <Trans>Delete Document</Trans>
                        ) : (
                          <Trans>Delete Template</Trans>
                        )}
                      </span>
                    )}
                  </Button>
                }
                onDelete={async () => {
                  // Todo: Embed - Where to navigate?
                  await navigate(
                    envelope.type === EnvelopeType.DOCUMENT
                      ? relativePath.documentRootPath
                      : relativePath.templateRootPath,
                  );
                }}
              />
            )}
          </div>

          {/* Footer of left sidebar. */}
          {allowReturnToPreviousPage && (
            <div
              className={cn('mt-auto px-4', {
                'px-2': minimizeLeftSidebar,
              })}
            >
              <Button
                variant="ghost"
                className={cn('w-full justify-start', {
                  'flex items-center justify-center': minimizeLeftSidebar,
                })}
                asChild
              >
                <Link to={relativePath.basePath}>
                  <ArrowLeftIcon className="h-4 w-4 flex-shrink-0" />

                  {!minimizeLeftSidebar && (
                    <span className="ml-2">
                      {isDocument ? (
                        <Trans>Return to documents</Trans>
                      ) : (
                        <Trans>Return to templates</Trans>
                      )}
                    </span>
                  )}
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Main Content - Changes based on current step */}
        <AnimateGenericFadeInOut
          className="flex-1 overflow-y-auto"
          key={currentStep.isLoading ? `loading-${currentStep.step}` : currentStep.step}
        >
          {match({
            isStepLoading: currentStep.isLoading,
            currentStep: currentStep.step,
            allowUploadAndRecipientStep,
            allowAddFieldsStep,
            allowPreviewStep,
          })
            .with({ isStepLoading: true }, () => <SpinnerBox className="py-32" />)
            .with({ currentStep: 'upload', allowUploadAndRecipientStep: true }, () => (
              <EnvelopeEditorUploadPage />
            ))
            .with({ currentStep: 'addFields', allowAddFieldsStep: true }, () => (
              <EnvelopeEditorFieldsPage />
            ))
            .with({ currentStep: 'preview', allowPreviewStep: true }, () => (
              <EnvelopeEditorPreviewPage />
            ))
            .otherwise(() => null)}
        </AnimateGenericFadeInOut>
      </div>
    </div>
  );
};
